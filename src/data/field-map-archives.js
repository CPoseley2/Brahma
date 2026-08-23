const phoenix2026 = {
  id: "phoenix-park-2026",
  name: "Phoenix Park Map Asset",
  park: "Phoenix Park",
  season: 2026,
  previewUrl: "/field-maps/phoenix-park-2026.png",
  originalUrl: "/field-maps/phoenix-park-2026.pdf",
  contentType: "application/pdf",
  page: 1,
  imageWidth: 1254,
  imageHeight: 1254,
  alt: "Phoenix Park 2026 field layout",
  sourceLabel: "FOSC Phoenix map · 2026 archive",
  fields: {
    P1: { x: 787, y: 374, xPercent: 62.76, yPercent: 29.82, widthPercent: 12.8, heightPercent: 16.3, rotation: -17, labelPlacement: "below" },
    P2: { x: 521, y: 299, xPercent: 41.55, yPercent: 23.84, widthPercent: 10.4, heightPercent: 13.1, rotation: -7, labelPlacement: "below" },
    P3: { x: 211, y: 1081, xPercent: 16.83, yPercent: 86.2, widthPercent: 11.6, heightPercent: 18.3, rotation: 7, labelPlacement: "above" },
    P4: { x: 521, y: 1145, xPercent: 41.55, yPercent: 91.31, widthPercent: 17.5, heightPercent: 10.8, rotation: 0, labelPlacement: "above" },
    P5: { x: 831, y: 1132, xPercent: 66.27, yPercent: 90.27, widthPercent: 7.7, heightPercent: 11.9, rotation: 0, labelPlacement: "above" },
    P7: { x: 1097, y: 1133, xPercent: 87.48, yPercent: 90.35, widthPercent: 12.3, heightPercent: 7.2, rotation: 0, labelPlacement: "above" },
  },
};

export const fieldMapArchives = [phoenix2026];

const normalized = value => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const fieldCode = field => {
  const explicit = normalized(field.code || field.fieldCode);
  if (explicit) return explicit;
  return normalized(`${field.name || ""} ${field.park || ""}`).match(/P[1-7]\b/)?.[0] || "";
};

export function archiveForField(field = {}, archives = fieldMapArchives) {
  const requestedArchive = normalized(field.mapAssetId || field.archiveId || field.mapArchiveId || field.mapAsset?.archiveId);
  const venue = normalized(`${field.park || ""} ${field.name || ""}`);
  const archive = archives.find(item => requestedArchive === normalized(item.id)
    || (venue.includes("PHOENIX") && normalized(item.park).includes("PHOENIX")));
  if (!archive) return null;
  const code = fieldCode(field);
  const position = archive.fields[code];
  return position ? { archive, code, position } : null;
}

export function archiveMapAssetFor(field = {}, archives = fieldMapArchives) {
  const match = archiveForField(field, archives);
  if (!match) return null;
  const { archive, code, position } = match;
  return {
    url: archive.originalUrl,
    previewUrl: archive.previewUrl,
    contentType: archive.contentType,
    page: archive.page,
    position: { ...position },
    alt: archive.alt,
    archiveId: archive.id,
    season: archive.season,
    sourceLabel: archive.sourceLabel,
    fieldCode: code,
  };
}
