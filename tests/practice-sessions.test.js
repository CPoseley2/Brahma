import { test } from "node:test";
import assert from "node:assert/strict";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

const identity = { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } };
const base = {
  team: {}, families: [], players: [], volunteerSlots: [], observations: [], rsvps: [], broadcasts: [], messages: [], skillFramework: [],
};

test("Practice Sessions are derived only from scheduled Practice events", () => {
  const model = { state: { ...base, games: [
    { id: "game", type: "Game", date: "2026-08-01", time: "09:00" },
    { id: "practice-b", type: "Practice", date: "2026-08-04", time: "17:00" },
    { id: "practice-a", type: "practice", date: "2026-08-02", time: "17:00" },
  ], sessions: [] } };
  const vm = new AppViewModel(model, identity);
  assert.deepEqual(vm.practiceEvents.map(event => event.id), ["practice-a", "practice-b"]);
});

test("attendance records link to a practice event and legacy records can be recovered", () => {
  const model = { state: { ...base, games: [
    { id: "practice-a", type: "Practice", date: "2026-08-02", time: "17:00", opponent: "Core Practice" },
    { id: "practice-b", type: "Practice", date: "2026-08-04", time: "17:00", opponent: "Core Practice" },
  ], sessions: [
    { id: "linked", eventId: "practice-a", date: "2026-08-02" },
    { id: "legacy", date: "2026-08-04", title: "Core Practice" },
  ] } };
  const vm = new AppViewModel(model, identity);
  assert.equal(vm.sessionForPractice("practice-a").id, "linked");
  assert.equal(vm.sessionForPractice("practice-b").id, "legacy");
});

test("the dashboard chooses today's practice, then the next scheduled practice", () => {
  const model = { state: { ...base, games: [
    { id: "canceled", type: "Practice", status: "Canceled", date: "2026-08-04", time: "17:00" },
    { id: "today", type: "Practice", status: "Scheduled", date: "2026-08-04", time: "17:00" },
    { id: "next", type: "Practice", status: "Scheduled", date: "2026-08-06", time: "17:00" },
  ], sessions: [] } };
  const vm = new AppViewModel(model, identity);
  assert.deepEqual(vm.practiceSpotlight("2026-08-04"), { event: model.state.games[1], lesson: vm.lessonForPractice("today"), isToday: true });
  assert.equal(vm.practiceSpotlight("2026-08-05").event.id, "next");
  assert.equal(vm.practiceSpotlight("2026-08-07"), null);
});

test("a coach can manually preview any active practice without changing curriculum order", () => {
  const model = { state: { ...base, games: [
    { id: "past", type: "Practice", status: "Scheduled", date: "2026-08-02", time: "17:00" },
    { id: "canceled", type: "Practice", status: "Canceled", date: "2026-08-04", time: "17:00" },
    { id: "future", type: "Practice", status: "Scheduled", date: "2026-09-03", time: "17:00" },
  ], sessions: [] } };
  const vm = new AppViewModel(model, identity);
  assert.equal(vm.practiceSpotlightFor("past", "2026-08-10").event.id, "past");
  assert.equal(vm.practiceSpotlightFor("future", "2026-08-10").lesson, vm.lessonForPractice("future"));
  assert.equal(vm.practiceSpotlightFor("canceled", "2026-08-10"), null);
  assert.equal(vm.practiceSpotlightFor("missing", "2026-08-10"), null);
});
