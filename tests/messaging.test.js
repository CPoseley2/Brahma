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
