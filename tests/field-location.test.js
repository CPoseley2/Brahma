import { test } from "node:test";
import assert from "node:assert/strict";
import { eventWithField, fieldMapAsset, fieldSnapshot, gameEventMapFeed, gameMapDetails, hasExactPin, hasFieldMap, locationForEvent, resolveEventField } from "../src/shared/field-location.js";
import { ALL_FIELD_MAP_LOCATIONS, confirmedEventsAtArchive, confirmedEventsForMapSelection } from "../src/shared/field-map-explorer.js";
import { fieldMapArchives } from "../src/data/field-map-archives.js";

const field = {
  id: "field-two", name: "Fair Oaks Park · Field 2", park: "Fair Oaks Park", address: "11549 Fair Oaks Blvd, Fair Oaks, CA",
  latitude: 38.644123, longitude: -121.271234, arrivalLabel: "North touchline", arrivalInstructions: "Follow the gold flags.", parking: "Use the east lot.",
};

test("legacy exact coordinates remain valid data without creating map-provider links", () => {
  assert.equal(hasExactPin(field), true);
});

test("assigning a field snapshots the game-day location into the event", () => {
  const assignment = eventWithField({ fieldId: field.id, location: "Old value" }, [field]);
  assert.equal(assignment.location, field.name);
  assert.deepEqual(assignment.fieldLocation, fieldSnapshot(field));
  assert.equal(assignment.fieldLocation.arrivalInstructions, "Follow the gold flags.");
});

test("event locations use the live directory and fall back to their published snapshot", () => {
  const snapshot = fieldSnapshot(field);
  const event = { fieldId: field.id, location: field.name, fieldLocation: snapshot };
  assert.equal(locationForEvent(event, []).latitude, field.latitude);
  assert.equal(locationForEvent(event, [{ ...field, arrivalLabel: "Corrected check-in point" }]).arrivalLabel, "Corrected check-in point");
});

test("legacy free-text locations remain readable without map-provider behavior", () => {
  const location = locationForEvent({ location: "Community Center", address: "123 Main St" }, []);
  assert.equal(hasExactPin(location), false);
  assert.equal(location.address, "123 Main St");
});

test("Phoenix field codes resolve to the 2026 archival PNG and PDF", () => {
  const phoenix = { id: "phoenix-p1", name: "Phoenix Park · P1", park: "Phoenix Park", code: "P1" };
  const asset = fieldMapAsset(phoenix);
  assert.equal(asset.previewUrl, "/field-maps/phoenix-park-2026.png");
  assert.equal(asset.url, "/field-maps/phoenix-park-2026.pdf");
  assert.equal(asset.archiveId, "phoenix-park-2026");
  assert.deepEqual(asset.position, { x: 787, y: 374, xPercent: 62.76, yPercent: 29.82, widthPercent: 12.8, heightPercent: 16.3, rotation: -17, labelPlacement: "below" });
  assert.equal(hasFieldMap(phoenix), true);
});

test("a scheduled Phoenix game inherits event facts on its field hotspot", () => {
  const phoenix = { id: "phoenix-p2", name: "Phoenix Park · P2", park: "Phoenix Park", code: "P2" };
  const event = { fieldId: phoenix.id, date: "2026-09-12", time: "09:30", gameDetails: { homeTeamName: "Brahma", awayTeamName: "Comets", ageGroup: "U6", homeCoachName: "Alex", awayCoachName: "Sam" } };
  const details = gameMapDetails(event, {}, [phoenix]);
  assert.deepEqual({ home: details.homeTeamName, away: details.awayTeamName, field: details.fieldCode, date: details.date, time: details.time }, { home: "Brahma", away: "Comets", field: "P2", date: "2026-09-12", time: "09:30" });
  assert.deepEqual(details.mapAsset.position, { x: 521, y: 299, xPercent: 41.55, yPercent: 23.84, widthPercent: 10.4, heightPercent: 13.1, rotation: -7, labelPlacement: "below" });
});

test("the location picker receives every confirmed Phoenix date in chronological order", () => {
  const fields = [{ id: "phoenix-p1", name: "Phoenix Park · P1", park: "Phoenix Park", code: "P1", mapAssetId: "phoenix-park-2026" }];
  const events = [
    { id: "later", fieldId: "phoenix-p1", status: "Scheduled", date: "2026-09-19", time: "10:00" },
    { id: "canceled", fieldId: "phoenix-p1", status: "Canceled", date: "2026-09-05", time: "09:00" },
    { id: "first", fieldId: "phoenix-p1", status: "Scheduled", date: "2026-09-12", time: "09:30" },
  ];
  assert.deepEqual(confirmedEventsAtArchive(events, fields, fieldMapArchives, "phoenix-park-2026").map(event => event.id), ["first", "later"]);
});

test("the All locations filter browses every confirmed mapped game in chronological order", () => {
  const fields = [
    { id: "phoenix-p1", name: "Phoenix Park · P1", park: "Phoenix Park", code: "P1", mapAssetId: "phoenix-park-2026" },
    { id: "carnegie-c1-n", name: "Carnegie Middle · C1-N", park: "Carnegie Middle", code: "C1-N", mapAssetId: "carnegie-middle-2026" },
  ];
  const events = [
    { id: "phoenix-later", fieldId: "phoenix-p1", status: "Scheduled", date: "2026-09-19", time: "10:00" },
    { id: "carnegie-first", fieldId: "carnegie-c1-n", status: "Scheduled", date: "2026-09-12", time: "09:30" },
    { id: "canceled", fieldId: "phoenix-p1", status: "Canceled", date: "2026-09-05", time: "09:00" },
    { id: "unmapped", location: "Other Park", status: "Scheduled", date: "2026-09-06", time: "09:00" },
  ];
  assert.deepEqual(confirmedEventsForMapSelection(events, fields, fieldMapArchives, ALL_FIELD_MAP_LOCATIONS).map(event => event.id), ["carnegie-first", "phoenix-later"]);
  assert.deepEqual(confirmedEventsForMapSelection(events, fields, fieldMapArchives, "phoenix-park-2026").map(event => event.id), ["phoenix-later"]);
});

test("all seven 2026 locations expose only permitted mapped field regions", () => {
  assert.equal(fieldMapArchives.length, 7);
  assert.equal(fieldMapArchives.reduce((total, archive) => total + Object.keys(archive.fields).length, 0), 29);
  const orangevale = fieldMapArchives.find(archive => archive.id === "orangevale-open-2026");
  assert.deepEqual(Object.keys(orangevale.fields).sort(), ["O1-E", "O1-W"]);
  assert.equal(Object.hasOwn(orangevale.fields, "O2"), false);
  fieldMapArchives.forEach(archive => Object.values(archive.fields).forEach(position => {
    assert.ok(position.xPercent >= 0 && position.xPercent <= 100);
    assert.ok(position.yPercent >= 0 && position.yPercent <= 100);
    assert.ok(position.widthPercent > 0 && position.heightPercent > 0);
  }));
});

test("legacy scheduled games automatically resolve a field and produce the map feed", () => {
  const fields = [
    { id: "carnegie-c2-n", name: "Carnegie Middle · C2-N", park: "Carnegie Middle", code: "C2-N", mapAssetId: "carnegie-middle-2026" },
    { id: "carnegie-c2-s", name: "Carnegie Middle · C2-S", park: "Carnegie Middle", code: "C2-S", mapAssetId: "carnegie-middle-2026" },
  ];
  const event = {
    id: "scheduled-game", type: "Game", status: "Scheduled", date: "2026-09-26", time: "11:15",
    location: "Andrew Carnegie Middle School C2-S", opponent: "Comets", homeCoachName: "Alex",
  };
  assert.equal(resolveEventField(event, fields)?.id, "carnegie-c2-s");
  const feed = gameEventMapFeed(event, { name: "Brahma U10", division: "U10" }, fields, fieldMapArchives);
  assert.deepEqual({ confirmed: feed.confirmed, fieldId: feed.fieldId, fieldCode: feed.fieldCode, mapAssetId: feed.mapAssetId }, {
    confirmed: true, fieldId: "carnegie-c2-s", fieldCode: "C2-S", mapAssetId: "carnegie-middle-2026",
  });
  assert.equal(feed.homeTeamName, "Brahma U10");
  assert.equal(feed.awayTeamName, "Comets");
  assert.equal(feed.homeCoachName, "Alex");
});

test("a field diagram uses normalized percentages and survives the event snapshot", () => {
  const mappedField = {
    ...field,
    code: "F2",
    mapAsset: {
      url: "https://example.com/fair-oaks-fields.pdf",
      previewUrl: "https://example.com/fair-oaks-fields.png",
      contentType: "application/pdf",
      page: 2,
      position: { xPercent: 62.5, yPercent: 38 },
    },
  };
  assert.equal(hasFieldMap(mappedField), true);
  assert.deepEqual(fieldMapAsset(mappedField).position, { xPercent: 62.5, yPercent: 38 });
  assert.deepEqual(fieldSnapshot(mappedField).mapAsset, fieldMapAsset(mappedField));
  assert.equal(fieldSnapshot(mappedField).code, "F2");
});

test("game map details combine matchup data with the trusted field", () => {
  const mappedField = { ...field, code: "2A", mapAsset: { url: "https://example.com/map.png", contentType: "image/png", position: { xPercent: 25, yPercent: 70 } } };
  const event = {
    fieldId: mappedField.id, date: "2026-09-12", time: "09:30", type: "Game", opponent: "Legacy opponent",
    gameDetails: { homeTeamName: "Brahma", awayTeamName: "Comets", ageGroup: "U6", homeCoachName: "Alex", awayCoachName: "Sam" },
  };
  const details = gameMapDetails(event, { name: "Team fallback" }, [mappedField]);
  assert.deepEqual({ home: details.homeTeamName, away: details.awayTeamName, field: details.fieldCode, location: details.locationName }, {
    home: "Brahma", away: "Comets", field: "2A", location: "Fair Oaks Park",
  });
  assert.equal(details.mapAsset.position.yPercent, 70);
});
