import { test } from "node:test";
import assert from "node:assert/strict";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

const state = () => ({
  team: {}, families: [{ id: "family-a", displayName: "Alpha family" }, { id: "family-b", displayName: "Beta family" }],
  guardians: [], members: [], players: [], games: [], sessions: [], volunteerSlots: [], observations: [], rsvps: [], broadcasts: [], messages: [], skillFramework: [],
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
