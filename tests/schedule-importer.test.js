import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScheduleRows, scheduleHeaders } from "../src/import/schedule-importer.js";

const teams = [{ id: "u8-comets", name: "U8 Comets", division: "U8" }];
const fields = [{ id: "field-north", name: "Fair Oaks Park · North" }];
const valid = ["practice-1", "u8-comets", "U8 Comets", "U8", "field-north", "Fair Oaks Park · North", "2026-08-03", "17:00", "60", "Scheduled", "Technical training"];

test("schedule CSV accepts the predetermined value scheme", () => {
  const result = normalizeScheduleRows([scheduleHeaders, valid], { teams, fields, practices: [] });
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].durationMinutes, 60);
  assert.equal(result.rows[0].importAction, "Add");
});

test("schedule CSV rejects unknown references and nonstandard time values", () => {
  const row = [...valid]; row[1] = "missing-team"; row[7] = "17:10";
  const result = normalizeScheduleRows([scheduleHeaders, row], { teams, fields, practices: [] });
  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some(error => error.includes("Team ID")));
  assert.ok(result.errors.some(error => error.includes("Practice Start Time")));
});

test("schedule CSV blocks field conflicts before import", () => {
  const existing = [{ id: "existing", teamId: "u8-comets", fieldId: "field-north", date: "2026-08-03", time: "17:30", durationMinutes: 60, status: "Scheduled" }];
  const result = normalizeScheduleRows([scheduleHeaders, valid], { teams, fields, practices: existing });
  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some(error => error.includes("conflicts")));
});
