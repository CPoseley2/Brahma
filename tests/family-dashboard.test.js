import test from "node:test";
import assert from "node:assert/strict";
import { FamilyDashboardViewModel } from "../src/viewmodels/family-dashboard-view-model.js";

const skillFramework = [
  {
    id: "social",
    skills: [
      { id: "simple-direction", familyText: "Following one simple direction" },
      { id: "space-sharing", familyText: "Sharing space and equipment" },
      { id: "kind-play", familyText: "Kind and fair play" },
      { id: "joy", familyText: "Enjoying and exploring the game" },
    ],
  },
];

const makeApp = () => ({
  selectedFamily: {
    id: "family-own",
    displayName: "Own family",
    players: [{ id: "player-own", firstName: "River" }],
  },
  state: {
    skillFramework,
    observations: [
      {
        id: "shared",
        playerId: "player-own",
        date: "2026-07-20",
        shared: true,
        celebration: "River welcomed a teammate.",
        ratings: { "kind-play": 3 },
      },
      {
        id: "private",
        playerId: "player-own",
        date: "2026-07-21",
        shared: false,
        privateNote: "Coach-only note",
        ratings: { "simple-direction": 3, "space-sharing": 3 },
      },
      {
        id: "other-family",
        playerId: "player-other",
        date: "2026-07-22",
        shared: true,
        celebration: "Must never appear.",
        ratings: { joy: 3 },
      },
    ],
    games: [
      { id: "past", date: "2026-07-01", time: "17:00", status: "Scheduled" },
      { id: "canceled", date: "2026-07-29", time: "17:00", status: "Canceled" },
      { id: "next", date: "2026-07-30", time: "17:00", status: "Scheduled", type: "Practice", slotCapacity: 10 },
    ],
    eventSlots: Array.from({ length: 10 }, (_, index) => ({ id: `slot-${index + 1}`, eventId: "next", playerId: index === 0 ? "player-own" : null })),
    rsvps: [{ gameId: "next", playerId: "player-own", status: "yes" }],
    volunteerSlots: [
      { id: "open", assigneeFamilyId: null },
      { id: "mine", assigneeFamilyId: "family-own" },
    ],
    broadcasts: [{ id: "news", title: "Pizza night", sentAt: "2026-07-27T10:00:00Z" }],
    messages: [{ id: "message", familyId: "family-own" }],
  },
  eventAvailability() {
    const slots = this.state.eventSlots.filter(slot => slot.eventId === "next");
    const assigned = slots.filter(slot => slot.playerId).length;
    return { limited: true, capacity: 10, assigned, available: 10 - assigned };
  },
});

test("the family dashboard uses only shared observations for its milestone story", () => {
  const snapshot = new FamilyDashboardViewModel(makeApp(), "2026-07-28").snapshot("player-own");
  const teamwork = snapshot.tokens.find(token => token.id === "teamwork");
  assert.equal(snapshot.timeline.length, 1);
  assert.equal(snapshot.timeline[0].celebration, "River welcomed a teammate.");
  assert.equal(teamwork.progress, 33);
  assert.deepEqual(teamwork.noticed, ["Kind and fair play"]);
  assert.doesNotMatch(JSON.stringify(snapshot), /Coach-only note|Must never appear/);
});

test("the family dashboard chooses the next active event and the player's own RSVP", () => {
  const snapshot = new FamilyDashboardViewModel(makeApp(), "2026-07-28").snapshot("player-own");
  assert.equal(snapshot.nextEvent.id, "next");
  assert.equal(snapshot.nextEvent.when, "In 2 days");
  assert.equal(snapshot.nextEvent.rsvp, "yes");
  assert.equal(snapshot.nextEvent.available, 9);
  assert.equal(snapshot.actions.openVolunteers, 1);
  assert.equal(snapshot.actions.familyVolunteers, 1);
});

test("a requested player outside the selected family cannot be selected", () => {
  const snapshot = new FamilyDashboardViewModel(makeApp(), "2026-07-28").snapshot("player-other");
  assert.equal(snapshot.player.id, "player-own");
});
