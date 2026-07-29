import { test } from "node:test";
import assert from "node:assert/strict";
import { TeamHubRepository } from "../src/firebase/team-hub-repository.js";

test("loading an active membership records the successful login time", async () => {
  let updated;
  const firestore = {
    fetch: async () => ({ id: "guardian-user", email: "guardian@example.com", role: "guardian", active: true }),
    update: async (_model, id, fields) => { updated = { id, ...fields }; },
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const membership = await repository.fetchMembership("guardian-user");
  assert.equal(updated.id, "guardian-user");
  assert.match(updated.lastLoginAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(membership.lastLoginAt, updated.lastLoginAt);
});

test("roster ingestion groups families and preserves coach invitations", async () => {
  const saved = [];
  const firestore = {
    fetch: async (_model, id) => id === "coach@example.com" ? { id, role: "headCoach", active: true } : null,
    saveMultiple: async entries => saved.push(...entries),
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const rows = [
    { firstName: "One", lastName: "Family", dateOfBirth: "2020-01-02", gender: "", familyEmail: "parent@example.com", familyPhone: "555-0100" },
    { firstName: "Two", lastName: "Family", dateOfBirth: "2021-03-04", gender: "", familyEmail: "parent@example.com", familyPhone: "555-0100" },
    { firstName: "Coach Child", lastName: "Coach", dateOfBirth: "2020-05-06", gender: "", familyEmail: "coach@example.com", familyPhone: "" },
  ];
  const result = await repository.importRoster(rows, { families: [], players: [] });
  assert.equal(result.families.length, 2);
  assert.equal(result.players.length, 3);
  assert.equal(result.inviteCount, 1);
  assert.equal(saved.filter(entry => entry.value.role === "guardian").length, 1);
  assert.equal(saved.length, 6);
  assert.ok(result.players.every(player => player.id.startsWith("player-") && player.familyId.startsWith("family-")));
});

test("adding a guardian grants only the selected player and updates an existing member", async () => {
  const saved = [];
  const firestore = {
    fetch: async (_model, id) => id === "guardian@example.com"
      ? { id, email: id, role: "guardian", familyId: null, playerIds: [], guardianIds: [], active: true }
      : null,
    fetchWhere: async () => [{ id: "member-existing", email: "guardian@example.com", role: "guardian", familyId: null, playerIds: [], guardianIds: [], active: true }],
    saveMultiple: async entries => saved.push(...entries),
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const guardian = { id: "relationship-a", playerId: "player-a", name: "Grandma Jo", email: "GUARDIAN@example.com", relationship: "grandparent", active: true };
  const result = await repository.saveGuardian(guardian, { guardians: [] });
  assert.equal(result.email, "guardian@example.com");
  const invite = saved.find(entry => entry.value.id === "guardian@example.com").value;
  assert.deepEqual(invite.playerIds, ["player-a"]);
  assert.deepEqual(invite.guardianIds, ["relationship-a"]);
  const member = saved.find(entry => entry.value.id === "member-existing").value;
  assert.deepEqual(member.playerIds, ["player-a"]);
  assert.deepEqual(member.guardianIds, ["relationship-a"]);
});

test("revoking one guardian relationship preserves another relationship for the same email", async () => {
  const saved = [];
  const firestore = {
    fetch: async () => ({ id: "guardian@example.com", email: "guardian@example.com", role: "guardian", familyId: null, playerIds: ["player-a", "player-b"], guardianIds: ["relationship-a", "relationship-b"], active: true }),
    fetchWhere: async () => [],
    saveMultiple: async entries => saved.push(...entries),
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const guardian = { id: "relationship-a", playerId: "player-a", name: "Guardian", email: "guardian@example.com", relationship: "parent", active: true };
  await repository.revokeGuardian(guardian, {
    guardians: [
      guardian,
      { id: "relationship-b", playerId: "player-b", name: "Guardian", email: "guardian@example.com", relationship: "parent", active: true },
    ],
  });
  const invite = saved.find(entry => entry.value.id === "guardian@example.com").value;
  assert.equal(invite.active, true);
  assert.deepEqual(invite.playerIds, ["player-b"]);
  assert.deepEqual(invite.guardianIds, ["relationship-b"]);
});
