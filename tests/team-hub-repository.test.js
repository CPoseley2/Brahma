import { test } from "node:test";
import assert from "node:assert/strict";
import { TeamHubRepository } from "../src/firebase/team-hub-repository.js";
import { FirestoreTeamHubModel } from "../src/models/firestore-team-hub-model.js";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

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

test("legacy parent roles use the guardian-safe data path", async () => {
  const fetchedCollections = [];
  const firestore = {
    fetch: async model => {
      const collection = model.collectionPath({ teamId: "fair-oaks-u6", eventId: "event-1" });
      if (collection === "teams") return { id: "fair-oaks-u6", name: "Team", skillFramework: [] };
      if (collection.endsWith("/families")) return { id: "family-a", displayName: "Family A" };
      return null;
    },
    fetchAll: async (model, context = {}) => {
      const collection = model.collectionPath({ teamId: "fair-oaks-u6", ...context });
      fetchedCollections.push(collection);
      if (collection.endsWith("/events")) return [];
      return [];
    },
    fetchWhere: async (model, _conditions, context = {}) => {
      const collection = model.collectionPath({ teamId: "fair-oaks-u6", ...context });
      fetchedCollections.push(collection);
      return collection.endsWith("/players") ? [{ id: "player-a", familyId: "family-a", active: true }] : [];
    },
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const result = await repository.loadTeamHub({ role: "parent", familyId: "family-a", active: true });
  assert.deepEqual(result.players.map(player => player.id), ["player-a"]);
  assert.ok(!fetchedCollections.some(path => path.endsWith("/members")));
  assert.ok(!fetchedCollections.some(path => path.endsWith("/sessions")));
  assert.ok(!fetchedCollections.some(path => path.endsWith("/drillCards")));
  assert.ok(!fetchedCollections.some(path => path.endsWith("/privateObservations")));
});

test("legacy parent roles render the family workspace", () => {
  const model = { state: { players: [], games: [], families: [], guardians: [], observations: [], rsvps: [], volunteerSlots: [] } };
  const vm = new AppViewModel(model, { user: { uid: "legacy-parent" }, membership: { role: "parent", familyId: "family-a" } });
  assert.equal(vm.role, "family");
  assert.equal(vm.defaultRoute, "family-home");
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

test("adding a capacity creates deterministic slots and assigns existing attendees", async () => {
  let batch;
  const firestore = {
    fetchAll: async model => model.collectionPath({ teamId: "fair-oaks-u6", eventId: "event-1" }).endsWith("/rsvps")
      ? [{ id: "player-a", playerId: "player-a", userId: "guardian-a", status: "yes", updatedAt: "2026-07-29T20:00:00.000Z" }]
      : [],
    applyBatch: async (entries, deletions) => { batch = { entries, deletions }; },
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const slots = await repository.configureEventSlots("event-1", 3);
  assert.deepEqual(slots.map(slot => slot.id), ["slot-001", "slot-002", "slot-003"]);
  assert.equal(slots[0].playerId, "player-a");
  assert.equal(slots[1].playerId, null);
  assert.equal(batch.entries.find(entry => entry.model.collectionPath({ teamId: "fair-oaks-u6", eventId: "event-1" }).endsWith("/rsvps")).value.slotId, "slot-001");
  assert.equal(batch.deletions.length, 0);
});

test("an RSVP atomically claims an available event slot", async () => {
  const updates = []; let saved;
  const slot = { id: "slot-001", eventId: "event-1", position: 1, playerId: null, userId: null, assignedAt: null };
  const firestore = {
    fetchAll: async () => [slot],
    transaction: async handler => handler({}, firestore),
    fetchInTransaction: async (_transaction, model, id) => {
      const path = model.collectionPath({ teamId: "fair-oaks-u6", eventId: "event-1" });
      if (path.endsWith("/events")) return { id, status: "Scheduled", slotCapacity: 1 };
      if (path.endsWith("/slots")) return slot;
      return null;
    },
    updateInTransaction: (_transaction, _model, id, fields) => updates.push({ id, fields }),
    setInTransaction: (_transaction, _model, value) => { saved = value; },
  };
  const repository = new TeamHubRepository(firestore, "fair-oaks-u6");
  const result = await repository.saveRsvp({ id: "player-a", gameId: "event-1", playerId: "player-a", userId: "guardian-a", status: "yes" });
  assert.equal(updates[0].id, "slot-001");
  assert.equal(updates[0].fields.playerId, "player-a");
  assert.equal(saved.slotId, "slot-001");
  assert.equal(result.rsvp.status, "yes");
  assert.equal(result.slots[0].playerId, "player-a");
});

test("updating one event RSVP does not overwrite the same player's other event", async () => {
  const state = {
    rsvps: [
      { id: "player-a", gameId: "event-1", playerId: "player-a", status: "yes" },
      { id: "player-a", gameId: "event-2", playerId: "player-a", status: "maybe" },
    ],
    eventSlots: [],
  };
  const repository = {
    saveRsvp: async value => ({ rsvp: { ...value, status: "no" }, slots: [] }),
  };
  const model = new FirestoreTeamHubModel(repository, state, { role: "guardian" });
  await model.upsert("rsvps", { id: "player-a", gameId: "event-2", playerId: "player-a", status: "no" });
  assert.equal(state.rsvps.find(item => item.gameId === "event-1").status, "yes");
  assert.equal(state.rsvps.find(item => item.gameId === "event-2").status, "no");
});
