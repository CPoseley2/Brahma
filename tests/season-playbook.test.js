import { test } from "node:test";
import assert from "node:assert/strict";
import { drillLibrary, seasonPlan, sessionMinutes, tokenDomains } from "../src/data/season-playbook.js";
import { AppViewModel } from "../src/viewmodels/app-view-model.js";

test("the season provides a 30-minute first observation and complete 60-minute practices after it", () => {
  assert.equal(seasonPlan.length, 26);
  for (let week = 1; week <= 13; week += 1) assert.equal(seasonPlan.filter(item => item.week === week).length, 2);
  assert.equal(sessionMinutes(seasonPlan[0]), 30);
  assert.ok(seasonPlan.slice(1).every(item => sessionMinutes(item) === 60));
});

test("every practice activity and token focus resolves to the playbook", () => {
  const drillIds = new Set(drillLibrary.map(item => item.id));
  const tokenIds = new Set(tokenDomains.map(item => item.id));
  assert.equal(drillIds.size, drillLibrary.length);
  seasonPlan.forEach(item => {
    assert.ok(tokenIds.has(item.tokenFocus));
    item.blocks.filter(block => block.drillId).forEach(block => assert.ok(drillIds.has(block.drillId), block.drillId));
  });
  drillLibrary.forEach(item => item.tokenIds.forEach(id => assert.ok(tokenIds.has(id), `${item.id}:${id}`)));
});

test("scheduled practices map chronologically onto the season curriculum", () => {
  global.localStorage = { getItem: () => null, setItem: () => {} };
  const games = Array.from({ length: 26 }, (_, index) => ({ id: `practice-${index}`, type: "Practice", date: `2026-${String(8 + Math.floor(index / 9)).padStart(2, "0")}-${String((index % 9) + 1).padStart(2, "0")}`, time: "17:00" }));
  const state = { team: {}, players: [], families: [], games, sessions: [], volunteerSlots: [], observations: [], rsvps: [], broadcasts: [], messages: [], drillCards: [], skillFramework: [] };
  const vm = new AppViewModel({ state }, { user: { uid: "coach" }, membership: { role: "headCoach", familyId: null } });
  assert.equal(vm.lessonForPractice("practice-0").id, "week-1-a");
  assert.equal(vm.lessonForPractice("practice-25").id, "week-13-b");
});
