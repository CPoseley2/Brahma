import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { recurringDates, scheduleDates } from "../src/shared/recurrence.js";

describe("recurring event dates", () => {
  test("creates inclusive Tuesday and Thursday occurrences", () => {
    assert.deepEqual(recurringDates("2026-08-04", "2026-08-13", [2, 4]), [
      "2026-08-04", "2026-08-06", "2026-08-11", "2026-08-13",
    ]);
  });

  test("remains stable across daylight-saving transitions", () => {
    assert.deepEqual(recurringDates("2026-10-27", "2026-11-05", [2, 4]), [
      "2026-10-27", "2026-10-29", "2026-11-03", "2026-11-05",
    ]);
  });

  test("validates ranges and weekday selection", () => {
    assert.throws(() => recurringDates("2026-09-10", "2026-09-01", [2]), /end date/);
    assert.throws(() => recurringDates("2026-09-01", "2026-09-10", []), /practice day/);
  });

  test("supports a one-time event", () => {
    assert.deepEqual(scheduleDates({ scheduleMode: "once", date: "2026-09-01" }), ["2026-09-01"]);
  });
});
