import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonPlan } from "../src/data/season-playbook.js";
import { FieldModeViewModel } from "../src/viewmodels/field-mode-view-model.js";

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
