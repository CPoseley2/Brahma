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

test("Docs is available to both portals and only coaches can upload", async () => {
  let saved;
  const model = { state: state(), saveDocument: async value => { saved = value; return value; } };
  const media = { upload: async () => [{ fileName: "field-map.pdf", url: "https://example.com/field-map.pdf", path: "teams/team-a/documents/file.pdf", contentType: "application/pdf", size: 2400 }] };
  const coach = new AppViewModel(model, { user: { uid: "assistant" }, membership: { role: "assistantCoach" } }, { media, teamId: "team-a" });
  const parent = new AppViewModel(model, { user: { uid: "parent" }, membership: { role: "guardian", familyId: "family-a" } }, { media, teamId: "team-a" });

  assert.ok(coach.navigation.some(([route]) => route === "documents"));
  assert.ok(parent.navigation.some(([route]) => route === "documents"));
  assert.equal(coach.canUploadDocuments, true);
  assert.equal(parent.canUploadDocuments, false);

  const document = await coach.uploadDocument({ title: " Field map ", category: "map", file: { name: "field-map.pdf", type: "application/pdf", size: 2400 } });
  assert.equal(saved.title, "Field map");
  assert.equal(document.category, "map");
  assert.equal(model.state.documents.length, 1);
  await assert.rejects(() => parent.uploadDocument({ title: "Photo", category: "photo", file: { name: "photo.png", type: "image/png", size: 100 } }), /Only coaches/);
});

test("Docs rejects mismatched and unsupported uploads before storage", async () => {
  let uploadCalls = 0;
  const model = { state: state(), saveDocument: async value => value };
  const media = { upload: async () => { uploadCalls += 1; return []; } };
  const coach = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach" } }, { media, teamId: "team-a" });

  await assert.rejects(() => coach.uploadDocument({ title: "Not a photo", category: "photo", file: { name: "guide.pdf", type: "application/pdf", size: 100 } }), /Photo category/);
  await assert.rejects(() => coach.uploadDocument({ title: "Animation", category: "map", file: { name: "map.gif", type: "image/gif", size: 100 } }), /Docs accepts/);
  await assert.rejects(() => coach.uploadDocument({ title: "Empty", category: "pdf", file: { name: "empty.pdf", type: "application/pdf", size: 0 } }), /empty/);
  assert.equal(uploadCalls, 0);
});
