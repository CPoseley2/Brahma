import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRosterRows } from "../src/import/roster-importer.js";

const headers = ["Athlete Last Name", "Athlete First Name", "Gender", "Birthdate", "Parent Email", "Parent Phone"];

describe("roster importer", () => {
  test("normalizes the required roster fields", () => {
    const result = normalizeRosterRows([headers, [" Poseley ", " Alex ", "F", "9/3/2020", "PARENT@EXAMPLE.COM ", "555-0100"]]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.rows[0], { rowNumber: 2, lastName: "Poseley", firstName: "Alex", gender: "F", dateOfBirth: "2020-09-03", familyEmail: "parent@example.com", familyPhone: "555-0100" });
  });

  test("accepts Excel Date objects and serial dates", () => {
    const result = normalizeRosterRows([headers,
      ["One", "Player", "", new Date(2020, 0, 2), "one@example.com", ""],
      ["Two", "Player", "", 43832, "two@example.com", ""],
    ]);
    assert.equal(result.rows[0].dateOfBirth, "2020-01-02");
    assert.equal(result.rows[1].dateOfBirth, "2020-01-02");
  });

  test("reports missing columns and invalid rows", () => {
    assert.throws(() => normalizeRosterRows([["Name"], ["Player"]]), /Missing required columns/);
    const result = normalizeRosterRows([headers, ["", "Player", "", "not-a-date", "bad", ""]]);
    assert.equal(result.errors.length, 3);
  });

  test("skips duplicate athletes within a file", () => {
    const row = ["One", "Player", "", "2020-01-02", "one@example.com", ""];
    const result = normalizeRosterRows([headers, row, row]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.warnings.length, 1);
  });
});
