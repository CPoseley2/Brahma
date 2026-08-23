import test from "node:test";
import assert from "node:assert/strict";
import { partitionScheduleEvents } from "../src/shared/schedule.js";

test("schedule separates the next event, later events, and chronological history", () => {
  const events = [
    { id: "later", date: "2026-08-24", time: "18:00" },
    { id: "past-late", date: "2026-08-21", time: "18:00" },
    { id: "next", date: "2026-08-23", time: "09:00" },
    { id: "past-early", date: "2026-08-20", time: "17:00" },
  ];

  const result = partitionScheduleEvents(events, new Date("2026-08-22T12:00:00"));

  assert.equal(result.next.id, "next");
  assert.deepEqual(result.upcoming.map(event => event.id), ["later"]);
  assert.deepEqual(result.past.map(event => event.id), ["past-early", "past-late"]);
});

test("an event becomes past after its local start time", () => {
  const events = [
    { id: "already-started", date: "2026-08-22", time: "09:00" },
    { id: "later-today", date: "2026-08-22", time: "18:00" },
    { id: "date-only", date: "2026-08-22", time: "" },
  ];

  const result = partitionScheduleEvents(events, new Date("2026-08-22T12:00:00"));

  assert.deepEqual(result.past.map(event => event.id), ["already-started"]);
  assert.equal(result.next.id, "later-today");
  assert.deepEqual(result.upcoming.map(event => event.id), ["date-only"]);
});
