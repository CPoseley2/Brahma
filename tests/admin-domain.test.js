import test from "node:test";
import assert from "node:assert/strict";
import { filterPractices, findPracticeConflicts, practicesOverlap, recommendPracticeAssignments, resolveBroadcastTeamIds, scenarioMetrics, seasonWeeks, startOfWeek, weekDates } from "../src/admin/admin-domain.js";
import { createAdminDemoData } from "../src/admin/demo-data.js";

test("practice overlap requires the same field and date", () => {
  const base = { id: "a", fieldId: "north", date: "2026-08-04", time: "17:00", durationMinutes: 60 };
  assert.equal(practicesOverlap(base, { ...base, id: "b", time: "17:45" }), true);
  assert.equal(practicesOverlap(base, { ...base, id: "c", time: "18:00" }), false);
  assert.equal(practicesOverlap(base, { ...base, id: "d", fieldId: "south" }), false);
});

test("conflict finder returns each conflicting pair once", () => {
  const values = [
    { id: "a", fieldId: "north", date: "2026-08-04", time: "17:00", durationMinutes: 60 },
    { id: "b", fieldId: "north", date: "2026-08-04", time: "17:30", durationMinutes: 60 },
    { id: "c", fieldId: "north", date: "2026-08-04", time: "19:00", durationMinutes: 60 },
  ];
  assert.deepEqual(findPracticeConflicts(values).map(pair => pair.map(item => item.id)), [["a", "b"]]);
});

test("broadcast audience resolves all, division, and selected team scopes", () => {
  const teams = [{ id: "u6", division: "U6", status: "Active" }, { id: "u8", division: "U8", status: "Active" }, { id: "old", division: "U6", status: "Inactive" }];
  assert.deepEqual(resolveBroadcastTeamIds({ scope: "all" }, teams), ["u6", "u8"]);
  assert.deepEqual(resolveBroadcastTeamIds({ scope: "division", division: "U6" }, teams), ["u6"]);
  assert.deepEqual(resolveBroadcastTeamIds({ scope: "teams", selectedTeamIds: ["u8", "old", "u8"] }, teams), ["u8"]);
});

test("calendar helpers produce a Monday through Sunday week and combine filters", () => {
  assert.equal(startOfWeek("2026-07-31"), "2026-07-27");
  assert.deepEqual(weekDates("2026-07-31"), ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]);
  const teams = [{ id: "a", division: "U8" }, { id: "b", division: "U10" }];
  const practices = [{ id: "1", teamId: "a", fieldId: "north", time: "17:00" }, { id: "2", teamId: "b", fieldId: "north", time: "18:00" }, { id: "3", teamId: "a", fieldId: "south", time: "18:00" }];
  assert.deepEqual(filterPractices(practices, { fieldId: "north", startTime: "18:00", division: "U10" }, teams).map(item => item.id), ["2"]);
});

test("admin demo models a full club scheduling operation", () => {
  const state = createAdminDemoData();
  assert.equal(state.teams.length, 100);
  assert.equal(state.players.length, 1200);
  assert.ok(state.teams.every(team => state.players.filter(player => player.teamId === team.id).length === 12));
  assert.equal(state.fields.length, 20);
  assert.equal(state.practices.length, 200);
  assert.equal(state.scenarios.length, 5);
  assert.equal(state.budgetItems.length, 12);
  assert.equal(state.gearItems.length, 8);
  assert.equal(state.gearDistributions.length, 100);
  assert.equal(findPracticeConflicts(state.practices).length, 0);
  assert.equal(findPracticeConflicts(state.scenarios.find(item => item.id === "scenario-imported").practices).length, 1);
  assert.equal(scenarioMetrics(state.scenarios[0], state.teams, state.fields).assignedTeams, 100);
});

test("season planning marks blackout weeks without losing the full range", () => {
  const weeks = seasonWeeks("2026-08-03", "2026-10-25", ["2026-09-07"]);
  assert.equal(weeks.length, 12);
  assert.deepEqual(weeks[5].blackoutDates, ["2026-09-07"]);
});

test("smart allocator gives an unplaced team two conflict-free, age-appropriate practices", () => {
  const scenario = { id: "draft", practices: [], closedFieldIds: [] };
  const teams = [{ id: "u6-a", name: "U6 Comets", division: "U6", status: "Active", defaultFieldId: "north" }];
  const fields = [{ id: "north", name: "North", status: "Open", lights: false }];
  const result = recommendPracticeAssignments({ scenario, teams, fields, weekStart: "2026-08-03", teamIds: ["u6-a"] });
  assert.equal(result.created.length, 2);
  assert.equal(result.unresolved.length, 0);
  assert.equal(findPracticeConflicts(result.practices).length, 0);
  assert.ok(result.created.every(item => item.time <= "18:00"));
});
