import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonPlan } from "../src/data/season-playbook.js";
import { FieldModeViewModel } from "../src/viewmodels/field-mode-view-model.js";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

test("field mode opens on the first block and tracks elapsed time accurately", () => {
  let now = 0; let tick = null; let cleared = false;
  const vm = new FieldModeViewModel({ now: () => now, setTimer: callback => { tick = callback; return 42; }, clearTimer: id => { if (id === 42) cleared = true; } });
  vm.open({ id: "practice-1", date: "2026-08-04" }, seasonPlan[0]);
  assert.equal(vm.currentBlock.label, "Arrival Ball Adventure");
  assert.equal(vm.currentDrill.id, "arrival-adventure");
  assert.equal(vm.remainingSeconds, 3 * 60);
  assert.equal(vm.totalSeconds, 30 * 60);
  vm.start(); now = 3_000; tick();
  assert.equal(vm.remainingSeconds, 177);
  assert.equal(vm.running, true);
  vm.pause();
  assert.equal(vm.running, false);
  assert.equal(cleared, true);
});

test("field mode advances, jumps, and clearly finishes a block", () => {
  let now = 0; let tick = null;
  const vm = new FieldModeViewModel({ now: () => now, setTimer: callback => { tick = callback; return 1; }, clearTimer: () => {} });
  vm.open({ id: "practice-1" }, seasonPlan[0]);
  vm.next();
  assert.equal(vm.blockIndex, 1);
  assert.equal(vm.remainingSeconds, 3 * 60);
  vm.jump(5);
  assert.equal(vm.currentBlock.label, "2v2 — Quiet Coach");
  vm.start(); now = 601_000; tick();
  assert.equal(vm.remainingSeconds, 0);
  assert.equal(vm.finished, true);
  assert.equal(vm.running, false);
});

test("first session observation provides explicit guidance for every field mode block", () => {
  const lesson = seasonPlan[0];
  assert.equal(lesson.sessionType, "baseline-observation");
  assert.equal(lesson.blocks.length, 8);
  lesson.blocks.forEach(block => {
    assert.ok(block.guidance.setup, block.label);
    assert.ok(block.guidance.run, block.label);
    assert.ok(block.guidance.say.length, block.label);
    assert.ok(block.guidance.watch.length, block.label);
    assert.ok(block.guidance.skillIds.length, block.label);
    assert.ok(block.guidance.record, block.label);
  });
  assert.deepEqual(lesson.blocks.map(block => block.minutes), [3, 3, 6, 5, 1, 4, 5, 3]);
});

test("switching practices stops the timer and resets Field Mode to the first block", () => {
  let now = 0; let cleared = 0;
  const vm = new FieldModeViewModel({ now: () => now, setTimer: () => 7, clearTimer: id => { if (id === 7) cleared += 1; } });
  vm.open({ id: "practice-1" }, seasonPlan[0]);
  vm.jump(4);
  vm.start();
  vm.open({ id: "practice-2" }, seasonPlan[1]);
  assert.equal(cleared, 1);
  assert.equal(vm.event.id, "practice-2");
  assert.equal(vm.lesson, seasonPlan[1]);
  assert.equal(vm.blockIndex, 0);
  assert.equal(vm.remainingSeconds, seasonPlan[1].blocks[0].minutes * 60);
  assert.equal(vm.running, false);
});

test("Field Mode saves one shared, additive profile observation for every selected player", async () => {
  const saved = [];
  const state = {
    team: {},
    players: [
      { id: "player-a", firstName: "Avery", lastName: "One", active: true },
      { id: "player-b", firstName: "Blake", lastName: "Two", active: true },
    ],
    games: [{ id: "practice-1", date: "2026-08-04", type: "Practice" }],
    observations: [{ id: "manual", playerId: "player-a", date: "2026-08-01", ratings: { "start-stop": 2 }, shared: true }],
    skillFramework: [{
      id: "movement",
      name: "Movement",
      skills: [
        { id: "start-stop", name: "Starts and stops safely", familyText: "Starting and stopping" },
        { id: "change-direction", name: "Changes direction", familyText: "Changing direction" },
      ],
    }],
    families: [], guardians: [], members: [], eventSlots: [], sessions: [], volunteerSlots: [],
    rsvps: [], broadcasts: [], messages: [], drillCards: [],
  };
  const model = { state, async upsert(collection, item) { saved.push({ collection, item }); } };
  const identity = { user: { uid: "coach-1" }, membership: { role: "headCoach" } };
  const app = new AppViewModel(model, identity);

  const message = await app.recordFieldObservation({
    eventId: "practice-1",
    blockLabel: "Arrival Ball Adventure",
    skillId: "start-stop",
    playerIds: ["player-a", "player-b", "player-a"],
  });

  assert.match(message, /Avery and Blake/);
  assert.equal(saved.length, 2);
  const avery = state.observations.find(item => item.id === "field-practice-1-player-a");
  const blake = state.observations.find(item => item.id === "field-practice-1-player-b");
  assert.equal(avery.ratings["start-stop"], 2, "a quick mark never lowers the current level");
  assert.equal(blake.ratings["start-stop"], 1);
  assert.equal(avery.shared, true);
  assert.deepEqual(avery.fieldObservation.skillIds, ["start-stop"]);

  await app.recordFieldObservation({
    eventId: "practice-1",
    blockLabel: "Animal Moves",
    skillId: "change-direction",
    playerIds: ["player-a"],
  });

  assert.equal(saved.length, 3);
  assert.equal(state.observations.filter(item => item.playerId === "player-a").length, 2, "the practice quick marks merge into one timeline entry");
  assert.deepEqual(avery.fieldObservation.skillIds, ["start-stop"]);
  const updated = state.observations.find(item => item.id === "field-practice-1-player-a");
  assert.deepEqual(updated.fieldObservation.skillIds, ["start-stop", "change-direction"]);
  assert.deepEqual(updated.fieldObservation.blockLabels, ["Arrival Ball Adventure", "Animal Moves"]);
  assert.match(updated.celebration, /Starting and stopping and Changing direction/);
});
