import { archiveMapAssetFor } from "../data/field-map-archives.js";

const coordinate = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function hasExactPin(value = {}) {
  const latitude = coordinate(value.latitude);
  const longitude = coordinate(value.longitude);
  return latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

const percent = value => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
};

const regionPosition = position => {
  const xPercent = percent(position?.xPercent);
  const yPercent = percent(position?.yPercent);
  if (xPercent === null || yPercent === null) return null;
  const widthPercent = percent(position.widthPercent);
  const heightPercent = percent(position.heightPercent);
  return {
    xPercent, yPercent,
    ...(widthPercent === null ? {} : { widthPercent }),
    ...(heightPercent === null ? {} : { heightPercent }),
    ...(position.rotation === undefined || !Number.isFinite(Number(position.rotation)) ? {} : { rotation: Number(position.rotation) }),
    ...(position.labelPlacement ? { labelPlacement: position.labelPlacement === "above" ? "above" : "below" } : {}),
  };
};

const mapContentType = (value = "", url = "") => {
  const type = String(value || "").toLowerCase();
  if (type === "application/pdf" || type === "pdf") return "application/pdf";
  if (type.startsWith("image/")) return type;
  return /\.pdf(?:$|[?#])/i.test(url) ? "application/pdf" : "image/*";
};

export function fieldMapAsset(field = {}, archives = []) {
  const source = field.mapAsset || {};
  const archiveAsset = archiveMapAssetFor(field, archives.length ? archives : undefined);
  if (archiveAsset) return archiveAsset;
  const url = String(source.url || field.mapUrl || "").trim();
  if (!url) return null;
  const previewUrl = String(source.previewUrl || field.mapPreviewUrl || "").trim();
  const position = source.position || field.mapPosition || {};
  const normalizedPosition = regionPosition({ ...position, xPercent: position.xPercent ?? field.mapXPercent, yPercent: position.yPercent ?? field.mapYPercent });
  return {
    url,
    previewUrl,
    contentType: mapContentType(source.contentType || field.mapContentType, url),
    page: Math.max(1, Number(source.page || 1)),
    position: normalizedPosition,
    alt: String(source.alt || `${field.park || field.name || "Venue"} field map`).trim(),
    archiveId: String(source.archiveId || field.archiveId || "").trim(),
    season: Number(source.season) || null,
    sourceLabel: String(source.sourceLabel || "Club field archive").trim(),
    fieldCode: String(source.fieldCode || field.code || field.fieldCode || "").trim(),
  };
}

export function hasFieldMap(field = {}, archives = []) {
  const asset = fieldMapAsset(field, archives);
  return Boolean(asset?.url && asset.position);
}

export function fieldSnapshot(field = {}, archives = []) {
  if (!field?.id) return null;
  return {
    id: field.id,
    code: field.code || field.fieldCode || "",
    name: field.name || "",
    park: field.park || "",
    address: field.address || "",
    latitude: hasExactPin(field) ? Number(field.latitude) : null,
    longitude: hasExactPin(field) ? Number(field.longitude) : null,
    arrivalLabel: field.arrivalLabel || "",
    arrivalInstructions: field.arrivalInstructions || "",
    parking: field.parking || "",
    mapAssetId: field.mapAssetId || field.mapAsset?.archiveId || "",
    mapAsset: fieldMapAsset(field, archives),
  };
}

export function resolveEventField(event = {}, fields = []) {
  const requestedIds = [event.fieldId, event.locationId, event.venueFieldId, event.fieldLocation?.id].filter(Boolean).map(normalized => String(normalized));
  const byId = fields.find(field => requestedIds.includes(String(field.id)));
  if (byId) return byId;
  const requestedCode = String(event.fieldCode || event.gameMapFeed?.fieldCode || event.fieldLocation?.code || event.fieldLocation?.fieldCode || "").trim().toUpperCase();
  if (requestedCode) {
    const byCode = fields.find(field => String(field.code || field.fieldCode || "").trim().toUpperCase() === requestedCode);
    if (byCode) return byCode;
  }
  const locationText = String(event.location || event.venue || event.fieldName || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!locationText) return null;
  const matches = fields.filter(field => {
    const code = String(field.code || field.fieldCode || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const venue = String(`${field.park || ""} ${field.name || ""}`).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (code && locationText.includes(code)) || (venue.length >= 6 && (locationText.includes(venue) || venue.includes(locationText)));
  });
  return matches.length === 1 ? matches[0] : null;
}

export function locationForEvent(event = {}, fields = []) {
  const current = resolveEventField(event, fields);
  const snapshot = event.fieldLocation;
  const field = current || snapshot || null;
  if (!field && !event.location) return null;
  return {
    ...(field || {}),
    id: field?.id || event.fieldId || "",
    code: field?.code || field?.fieldCode || event.fieldCode || "",
    name: field?.name || event.location || "Location TBD",
    address: field?.address || event.address || "",
    arrivalLabel: field?.arrivalLabel || "",
    arrivalInstructions: field?.arrivalInstructions || "",
    parking: field?.parking || "",
  };
}

const ageGroupFromTeam = team => team?.ageGroup || team?.division || String(team?.name || "").match(/\bU\d+\b/i)?.[0]?.toUpperCase() || "";
const homeCoachFromTeam = team => team?.headCoachName || team?.coachName || team?.coaches?.find(coach => ["headCoach", "head coach"].includes(coach.role))?.name || team?.coaches?.[0]?.name || "";
const entityName = value => typeof value === "string" ? value : value?.name || "";

export function gameMapDetails(event = {}, team = {}, fields = [], archives = []) {
  const location = locationForEvent(event, fields);
  const details = event.gameDetails || {};
  const feed = event.gameMapFeed || {};
  return {
    homeTeamName: details.homeTeamName || event.homeTeamName || entityName(event.homeTeam) || feed.homeTeamName || team.name || "Home team TBD",
    awayTeamName: details.awayTeamName || event.awayTeamName || entityName(event.awayTeam) || feed.awayTeamName || event.opponent || "Away team TBD",
    date: event.date || "",
    time: event.time || "",
    ageGroup: details.ageGroup || event.ageGroup || event.division || feed.ageGroup || ageGroupFromTeam(team) || "Age group TBD",
    homeCoachName: details.homeCoachName || event.homeCoachName || entityName(event.homeCoach) || feed.homeCoachName || homeCoachFromTeam(team) || "Coach TBD",
    awayCoachName: details.awayCoachName || event.awayCoachName || entityName(event.awayCoach) || feed.awayCoachName || "Coach TBD",
    locationName: location?.park || location?.name || event.location || "Location TBD",
    fieldCode: location?.code || event.fieldCode || location?.name || "Field TBD",
    location,
    mapAsset: fieldMapAsset(location || {}, archives),
  };
}

export function gameEventMapFeed(event = {}, team = {}, fields = [], archives = []) {
  const details = gameMapDetails(event, team, fields, archives);
  return {
    version: 1,
    confirmed: event.status === "Scheduled",
    date: details.date,
    time: details.time,
    homeTeamName: details.homeTeamName,
    awayTeamName: details.awayTeamName,
    ageGroup: details.ageGroup,
    homeCoachName: details.homeCoachName,
    awayCoachName: details.awayCoachName,
    fieldId: details.location?.id || event.fieldId || "",
    fieldCode: details.fieldCode,
    locationName: details.locationName,
    mapAssetId: details.mapAsset?.archiveId || details.location?.mapAssetId || "",
  };
}

export function eventWithField(draft, fields = [], archives = []) {
  const field = resolveEventField(draft, fields);
  return field
    ? { fieldId: field.id, location: field.name, fieldLocation: fieldSnapshot(field, archives) }
    : { fieldId: "", location: draft.location || "", fieldLocation: null };
}
