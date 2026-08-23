import { fieldMapAsset, locationForEvent } from "./field-location.js";

const eventKey = event => `${event.date || ""}${event.time || ""}`;

export function confirmedEventsAtArchive(events = [], fields = [], archives = [], archiveId = "") {
  return events.filter(event => {
    if (event.status !== "Scheduled") return false;
    const location = locationForEvent(event, fields);
    return fieldMapAsset(location || {}, archives)?.archiveId === archiveId;
  }).sort((a, b) => eventKey(a).localeCompare(eventKey(b)));
}
