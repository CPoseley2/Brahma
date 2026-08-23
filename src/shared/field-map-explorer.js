import { fieldMapAsset, locationForEvent } from "./field-location.js";

const eventKey = event => `${event.date || ""}${event.time || ""}`;
export const ALL_FIELD_MAP_LOCATIONS = "all";

const archiveIdForEvent = (event, fields, archives) => {
  const location = locationForEvent(event, fields);
  return fieldMapAsset(location || {}, archives)?.archiveId || "";
};

export function confirmedEventsAtArchive(events = [], fields = [], archives = [], archiveId = "") {
  return events.filter(event => {
    if (event.status !== "Scheduled") return false;
    return archiveIdForEvent(event, fields, archives) === archiveId;
  }).sort((a, b) => eventKey(a).localeCompare(eventKey(b)));
}

export function confirmedEventsForMapSelection(events = [], fields = [], archives = [], archiveId = ALL_FIELD_MAP_LOCATIONS) {
  if (archiveId !== ALL_FIELD_MAP_LOCATIONS) return confirmedEventsAtArchive(events, fields, archives, archiveId);
  const availableArchiveIds = new Set(archives.map(archive => archive.id));
  return events.filter(event => event.status === "Scheduled" && availableArchiveIds.has(archiveIdForEvent(event, fields, archives)))
    .sort((a, b) => eventKey(a).localeCompare(eventKey(b)));
}
