import { test } from "node:test";
import assert from "node:assert/strict";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

const state = () => ({
  team: {}, families: [{ id: "family-a", displayName: "Alpha family" }, { id: "family-b", displayName: "Beta family" }],
  guardians: [], members: [], players: [], games: [], sessions: [], volunteerSlots: [], observations: [], rsvps: [], broadcasts: [], messages: [], documents: [], skillFramework: [],
});

test("a guardian message is always confined to their own family thread", async () => {
  let saved;
  const model = { state: state(), sendMessage: async value => { saved = value; model.state.messages.push(value); } };
  const vm = new AppViewModel(model, { user: { uid: "guardian-a" }, membership: { role: "guardian", familyId: "family-a" } });
  await vm.sendPrivateMessage("family:family-a", " Could a coach call me? ");
  assert.equal(saved.familyId, "family-a");
  assert.equal(saved.senderRole, "guardian");
  assert.equal(saved.body, "Could a coach call me?");
  await assert.rejects(() => vm.sendTeamBroadcast("Not allowed", "Parents cannot broadcast."), /Only a coach/);
});

test("two guardians of one player have independent coach conversations", async () => {
  let saved;
  const modelState = state();
  modelState.players.push({ id: "player-a", firstName: "Tallac", lastName: "Player", active: true });
  modelState.guardians.push(
    { id: "guardian-one", playerId: "player-a", name: "Guardian One", email: "one@example.com", relationship: "parent", active: true },
    { id: "guardian-two", playerId: "player-a", name: "Guardian Two", email: "two@example.com", relationship: "grandparent", active: true },
  );
  const model = { state: modelState, sendMessage: async value => { saved = value; model.state.messages.push(value); } };
  const vm = new AppViewModel(model, {
    user: { uid: "guardian-one-user" },
    membership: { role: "guardian", familyId: null, playerIds: ["player-a"], guardianIds: ["guardian-one"] },
  });
  assert.deepEqual(vm.privateConversations.map(item => item.id), ["guardian:guardian-one"]);
  await vm.sendPrivateMessage("guardian:guardian-two", "Private question");
  assert.equal(saved.guardianId, "guardian-one");
  assert.equal(saved.playerId, "player-a");
  assert.equal(saved.familyId, undefined);
});

test("only the head coach can add a guardian relationship", async () => {
  let saved;
  const modelState = state();
  modelState.players.push({ id: "player-a", firstName: "Tallac", lastName: "Player", active: true });
  const model = { state: modelState, saveGuardian: async value => { saved = value; model.state.guardians.push(value); } };
  const headCoach = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  await headCoach.addGuardian({ playerId: "player-a", name: "Grandma Jo", email: "jo@example.com", relationship: "grandparent" });
  assert.equal(saved.playerId, "player-a");
  assert.equal(saved.email, "jo@example.com");
  const assistant = new AppViewModel(model, { user: { uid: "assistant" }, membership: { role: "assistantCoach", familyId: null } });
  await assert.rejects(
    () => assistant.addGuardian({ playerId: "player-a", name: "Friend", email: "friend@example.com", relationship: "friend" }),
    /Only the head coach/,
  );
});

test("coach roster membership lookup reports accepted guardian accounts", () => {
  const modelState = state();
  modelState.members.push({ id: "joined-user", email: "Guardian@Example.com", role: "guardian", active: true, lastLoginAt: "2026-07-29T20:00:00.000Z" });
  const vm = new AppViewModel({ state: modelState }, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  assert.equal(vm.memberForEmail("guardian@example.com")?.id, "joined-user");
  assert.equal(vm.memberForEmail("not-joined@example.com"), null);
});

test("coach promotion candidates combine primary and guardian contacts and exclude coaches", () => {
  const modelState = state();
  modelState.players.push({ id: "player-a", firstName: "Tallac", lastName: "Player", familyId: "family-a", familyEmail: "primary@example.com", active: true });
  modelState.guardians.push({ id: "guardian-a", playerId: "player-a", name: "Pat Parent", email: "parent@example.com", relationship: "parent", active: true });
  modelState.members.push({ id: "coach-user", email: "primary@example.com", role: "assistantCoach", active: true });
  const vm = new AppViewModel({ state: modelState }, { user: { uid: "assistant" }, membership: { role: "assistantCoach", familyId: null } });
  assert.deepEqual(vm.coachPromotionCandidates.map(item => item.email), ["parent@example.com"]);
  assert.equal(vm.coachPromotionCandidates[0].guardianId, "guardian-a");
});

test("an assistant coach can initiate a parent promotion", async () => {
  let saved;
  const modelState = state();
  modelState.players.push({ id: "player-a", firstName: "Tallac", lastName: "Player", familyId: "family-a", familyEmail: "parent@example.com", active: true });
  const model = { state: modelState, promoteParentToCoach: async value => { saved = value; return { ...value, name: value.name }; } };
  const vm = new AppViewModel(model, { user: { uid: "assistant" }, membership: { role: "assistantCoach", familyId: null } });
  const feedback = await vm.promoteParentToCoach(vm.coachPromotionCandidates[0]);
  assert.equal(saved.promotedByUid, "assistant");
  assert.match(saved.readmeUrl, /coach-readme\.html$/);
  assert.match(feedback, /assistant coach/);
});

test("a dual-access coach can open Parent view without seeing unrelated players", () => {
  const modelState = state();
  modelState.players.push(
    { id: "player-a", firstName: "Alpha", lastName: "Player", familyId: "family-a", active: true },
    { id: "player-b", firstName: "Beta", lastName: "Player", familyId: "family-b", active: true },
  );
  const vm = new AppViewModel({ state: modelState }, {
    user: { uid: "assistant", email: "assistant@example.com" },
    membership: { role: "assistantCoach", familyId: null, playerIds: ["player-a"], guardianIds: ["guardian-a"] },
  }, { experienceRole: "family" });
  assert.equal(vm.role, "family");
  assert.deepEqual(vm.activePlayers.map(player => player.id), ["player-a"]);
  assert.deepEqual(vm.families.map(family => family.id), ["family-a"]);
});

test("any coach can invite a new assistant coach and send a secure sign-in link", async () => {
  let saved; let emailed;
  const modelState = state();
  modelState.invites = [];
  const model = { state: modelState, inviteCoach: async value => { saved = value; return value; } };
  const vm = new AppViewModel(model, {
    user: { uid: "assistant", email: "assistant@example.com" },
    membership: { role: "assistantCoach", familyId: null },
  }, { sendCoachInvite: async (email, url) => { emailed = { email, url }; } });
  const feedback = await vm.inviteCoach({ name: " New Coach ", email: "NEW@EXAMPLE.COM" });
  assert.equal(saved.email, "new@example.com");
  assert.equal(saved.invitedByUid, "assistant");
  assert.equal(emailed.email, "new@example.com");
  assert.match(emailed.url, /workspace=coach/);
  assert.match(feedback, /secure sign-in link/);
});

test("a coach can claim a player only for their own account", async () => {
  let saved;
  const modelState = state();
  modelState.players.push({ id: "player-a", firstName: "Alpha", lastName: "Player", familyId: "family-a", active: true });
  const membership = { role: "assistantCoach", email: "assistant@example.com", familyId: null, playerIds: [], guardianIds: [] };
  const model = {
    state: modelState,
    claimPlayerForCoach: async value => {
      saved = value;
      return { guardian: { id: value.guardianId, playerId: value.playerId }, member: { ...membership, playerIds: [value.playerId], guardianIds: [value.guardianId] } };
    },
  };
  const vm = new AppViewModel(model, { user: { uid: "assistant", email: "assistant@example.com", displayName: "Coach Alex" }, membership });
  const feedback = await vm.claimPlayer("player-a");
  assert.equal(saved.email, "assistant@example.com");
  assert.equal(saved.name, "Coach Alex");
  assert.deepEqual(vm.identity.membership.playerIds, ["player-a"]);
  assert.match(feedback, /Parent view/);
  await assert.rejects(() => vm.claimPlayer("player-a"), /already have Parent access/);
});

test("Docs is visible in both portals and coaches can upload valid files", async () => {
  let saved; let uploaded;
  const modelState = state();
  const model = { state: modelState, saveDocument: async value => { saved = value; return value; }, deleteDocument: async () => {} };
  const media = {
    upload: async (files, directory, ownerId) => {
      uploaded = { files, directory, ownerId };
      return [{ fileName: "field-map.pdf", url: "https://example.com/field-map.pdf", path: `teams/team-a/documents/${ownerId}/field-map.pdf`, contentType: "application/pdf", size: 2400 }];
    },
    delete: async () => {},
  };
  const coach = new AppViewModel(model, { user: { uid: "assistant" }, membership: { role: "assistantCoach" } }, { media, teamId: "team-a" });
  const parent = new AppViewModel({ state: modelState }, { user: { uid: "parent" }, membership: { role: "guardian", familyId: "family-a" } });
  assert.ok(coach.navigation.some(([route]) => route === "documents"));
  assert.ok(parent.navigation.some(([route]) => route === "documents"));
  const document = await coach.uploadDocument({ title: " Field map ", category: "map", file: { name: "field-map.pdf", type: "application/pdf", size: 2400 } });
  assert.equal(saved.title, "Field map");
  assert.equal(document.category, "map");
  assert.equal(uploaded.directory, "teams/team-a/documents");
  assert.equal(modelState.documents.length, 1);
  await assert.rejects(() => parent.uploadDocument({ title: "Photo", category: "photo", file: { name: "photo.png", type: "image/png", size: 100 } }), /Only coaches/);
});

test("coaches can edit, physically duplicate, and delete Docs while parents cannot", async () => {
  const operations = [];
  const original = {
    id: "document-a", title: "Field map", category: "map", fileName: "map.png", url: "https://example.com/map.png",
    path: "teams/team-a/documents/document-a/map.png", contentType: "image/png", size: 1200,
    uploadedAt: "2026-08-16T12:00:00.000Z", uploadedByUid: "coach", updatedAt: "2026-08-16T12:00:00.000Z", updatedByUid: "coach",
  };
  const modelState = state(); modelState.documents.push(original);
  const model = {
    state: modelState,
    saveDocument: async value => { operations.push(["save", value]); return value; },
    deleteDocument: async id => { operations.push(["delete-metadata", id]); },
  };
  const media = {
    copy: async value => { operations.push(["copy-file", value]); return { fileName: "map.png", url: "https://example.com/map-copy.png", path: `teams/team-a/documents/${value.ownerId}/map.png`, contentType: "image/png", size: 1200 }; },
    delete: async path => { operations.push(["delete-file", path]); },
  };
  const coach = new AppViewModel(model, { user: { uid: "assistant" }, membership: { role: "assistantCoach" } }, { media, teamId: "team-a" });
  const edited = await coach.updateDocument("document-a", { title: "Updated map", category: "map" });
  assert.equal(edited.title, "Updated map");
  const copied = await coach.copyDocument("document-a");
  assert.match(copied.title, /copy$/);
  assert.equal(copied.copiedFromId, "document-a");
  assert.notEqual(copied.path, original.path);
  const deleted = await coach.deleteDocument("document-a");
  assert.equal(deleted.cleanupFailed, false);
  assert.deepEqual(operations.slice(-2), [["delete-metadata", "document-a"], ["delete-file", original.path]]);

  const parent = new AppViewModel({ state: modelState }, { user: { uid: "parent" }, membership: { role: "guardian", familyId: "family-a" } });
  await assert.rejects(() => parent.updateDocument(copied.id, { title: "Blocked", category: "map" }), /Only coaches/);
  await assert.rejects(() => parent.copyDocument(copied.id), /Only coaches/);
  await assert.rejects(() => parent.deleteDocument(copied.id), /Only coaches/);
});

test("Docs rejects mismatched and unsupported uploads before Storage", async () => {
  const modelState = state();
  const model = { state: modelState, saveDocument: async value => value, deleteDocument: async () => {} };
  const media = { upload: async () => { throw new Error("Storage should not be reached."); }, delete: async () => {} };
  const coach = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach" } }, { media, teamId: "team-a" });
  await assert.rejects(() => coach.uploadDocument({ title: "Not a photo", category: "photo", file: { name: "guide.pdf", type: "application/pdf", size: 100 } }), /Photo category/);
  await assert.rejects(() => coach.uploadDocument({ title: "Animation", category: "map", file: { name: "map.gif", type: "image/gif", size: 100 } }), /Docs accepts/);
  await assert.rejects(() => coach.uploadDocument({ title: "Empty", category: "pdf", file: { name: "empty.pdf", type: "application/pdf", size: 0 } }), /empty/);
});

test("a coach can create a team-wide broadcast", async () => {
  let saved;
  const model = { state: state(), sendBroadcast: async value => { saved = value; model.state.broadcasts.push(value); } };
  const vm = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  const feedback = await vm.sendTeamBroadcast(" Practice update ", " Bring water. ");
  assert.deepEqual(saved.familyIds, []);
  assert.equal(saved.sentByUid, "coach");
  assert.equal(saved.title, "Practice update");
  assert.match(feedback, /entire team/);
});
