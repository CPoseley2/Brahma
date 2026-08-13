import { test } from "node:test";
import assert from "node:assert/strict";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

const draft = {
  scheduleMode: "weekly", seriesStartDate: "2026-08-04", seriesEndDate: "2026-08-13", seriesWeekdays: [2, 4],
  type: "Practice", status: "Scheduled", time: "17:30", opponent: "Team practice", location: "Fair Oaks Park", notes: "Bring water.", slotCapacity: 12,
};

test("creates one Firestore event for every recurring date", async () => {
  const state = { games: [] };
  const model = { state, saveEvents: async events => { state.games.push(...events); } };
  const vm = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: "coach" } });
  const result = await vm.saveEventSchedule(draft);
  assert.equal(result.count, 4);
  assert.deepEqual(state.games.map(event => event.date), ["2026-08-04", "2026-08-06", "2026-08-11", "2026-08-13"]);
  assert.equal(new Set(state.games.map(event => event.seriesId)).size, 1);
  assert.ok(state.games.every(event => event.occurrenceDate === event.date && event.time === "17:30"));
  assert.ok(state.games.every(event => event.slotCapacity === 12));
});

test("reconciles an edited series when the end date changes", async () => {
  const existing = ["2026-08-04", "2026-08-06"].map((date, index) => ({ id: `event-${index}`, date, occurrenceDate: date, seriesId: "series-1", type: "Practice" }));
  const state = { games: existing };
  const model = {
    state,
    replaceEventSeries: async (seriesId, events) => { state.games = [...state.games.filter(event => event.seriesId !== seriesId), ...events]; },
  };
  const vm = new AppViewModel(model, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: "coach" } });
  const result = await vm.saveEventSchedule({ ...draft, seriesId: "series-1", editScope: "series" }, "event-0", "series");
  assert.equal(result.count, 4);
  assert.equal(state.games.length, 4);
  assert.equal(state.games[0].id, "event-0");
});

test("reports event availability from assigned slots", () => {
  const state = {
    games: [{ id: "event-1", slotCapacity: 3 }],
    eventSlots: [
      { id: "slot-001", eventId: "event-1", playerId: "player-a" },
      { id: "slot-002", eventId: "event-1", playerId: null },
      { id: "slot-003", eventId: "event-1", playerId: "player-b" },
    ],
    rsvps: [],
  };
  const vm = new AppViewModel({ state }, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  assert.deepEqual(vm.eventAvailability("event-1"), { limited: true, capacity: 3, assigned: 2, available: 1 });
});

test("does not reduce a limited event below current attendance", async () => {
  const state = {
    games: [{ id: "event-1", slotCapacity: 3 }],
    eventSlots: [
      { id: "slot-001", eventId: "event-1", playerId: "player-a" },
      { id: "slot-002", eventId: "event-1", playerId: "player-b" },
      { id: "slot-003", eventId: "event-1", playerId: null },
    ],
    rsvps: [],
  };
  const vm = new AppViewModel({ state }, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  await assert.rejects(
    vm.saveEventSchedule({ ...draft, scheduleMode: "once", date: "2026-08-04", slotCapacity: 1 }, "event-1"),
    /cannot be reduced below current attendance/,
  );
});

test("coach RSVP roster summarizes every active player consistently", () => {
  const state = {
    games: [{ id: "practice-1", type: "Practice", slotCapacity: 0 }],
    players: [
      { id: "player-b", firstName: "Bailey", lastName: "Zulu", active: true },
      { id: "player-a", firstName: "Alex", lastName: "Alpha", active: true },
      { id: "player-c", firstName: "Casey", lastName: "Middle", active: true },
      { id: "player-d", firstName: "Drew", lastName: "Later", active: true },
      { id: "inactive", firstName: "Inactive", lastName: "Player", active: false },
    ],
    rsvps: [
      { gameId: "practice-1", playerId: "player-a", status: "yes" },
      { gameId: "practice-1", playerId: "player-b", status: "no" },
      { gameId: "practice-1", playerId: "player-c", status: "maybe" },
      { gameId: "other-event", playerId: "player-d", status: "yes" },
    ],
  };
  const vm = new AppViewModel({ state }, { user: { uid: "coach" }, membership: { role: "assistantCoach" } });
  const roster = vm.eventRsvpRoster("practice-1");
  assert.deepEqual({ attending: roster.attending, declined: roster.declined, maybe: roster.maybe, noResponse: roster.noResponse, responded: roster.responded, total: roster.total }, {
    attending: 1, declined: 1, maybe: 1, noResponse: 1, responded: 3, total: 4,
  });
  assert.deepEqual(roster.players.map(player => [player.id, player.rsvpStatus]), [
    ["player-a", "yes"], ["player-d", ""], ["player-c", "maybe"], ["player-b", "no"],
  ]);
});
