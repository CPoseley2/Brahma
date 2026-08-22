import { test } from "node:test";
import assert from "node:assert/strict";
import { eventWithField, fieldMapAsset, fieldSnapshot, gameMapDetails, hasExactPin, hasFieldMap, locationForEvent, locationLinks } from "../src/shared/field-location.js";

const field = {
  id: "field-two", name: "Fair Oaks Park · Field 2", park: "Fair Oaks Park", address: "11549 Fair Oaks Blvd, Fair Oaks, CA",
  latitude: 38.644123, longitude: -121.271234, arrivalLabel: "North touchline", arrivalInstructions: "Follow the gold flags.", parking: "Use the east lot.",
};

test("a trusted field produces an exact coordinate destination for map apps", () => {
  assert.equal(hasExactPin(field), true);
  const links = locationLinks(field);
  assert.match(links.directions, /destination=38\.644123%2C-121\.271234/);
  assert.match(links.appleMaps, /daddr=38\.644123%2C-121\.271234/);
  assert.match(links.embed, /output=embed/);
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

test("legacy locations still open address-based directions", () => {
  const location = locationForEvent({ location: "Community Center", address: "123 Main St" }, []);
  assert.equal(hasExactPin(location), false);
  assert.match(locationLinks(location).directions, /123%20Main%20St/);
});

test("TBD locations do not create misleading map links", () => {
  assert.equal(locationLinks(locationForEvent({ location: "Location TBD" }, [])), null);
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
