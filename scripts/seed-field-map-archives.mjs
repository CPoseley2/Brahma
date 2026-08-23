import { fieldMapArchives } from "../src/data/field-map-archives.js";

const PROJECT_ID = "fair-oaks-u6-team-hub";
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) throw new Error("FIREBASE_ACCESS_TOKEN is required.");

const fieldPrefixes = {
  "phoenix-park-2026": "phoenix",
  "carnegie-middle-2026": "carnegie",
  "orangevale-open-2026": "orangevale-open",
  "legette-elementary-2026": "legette",
  "northridge-elementary-2026": "northridge",
  "dewey-elementary-north-2026": "dewey-north",
  "dewey-elementary-south-2026": "dewey-south",
};

const valueFor = value => {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valueFor) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, valueFor(item)])) } };
  throw new TypeError(`Unsupported Firestore value: ${typeof value}`);
};

const documentWrite = (path, data) => ({
  update: {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, valueFor(value)])),
  },
});

const updatedAt = new Date().toISOString();
const writes = [];

for (const archive of fieldMapArchives) {
  const assetDocument = { ...archive, updatedAt };
  delete assetDocument.id;
  writes.push(documentWrite(`fieldMapAssets/${archive.id}`, assetDocument));
  const prefix = fieldPrefixes[archive.id];
  if (!prefix) throw new Error(`No Firestore field prefix is configured for ${archive.id}.`);
  for (const code of Object.keys(archive.fields || {})) {
    const id = `${prefix}-${code.toLowerCase()}`;
    writes.push(documentWrite(`fields/${id}`, {
      name: `${archive.park} · ${code}`,
      code,
      park: archive.park,
      address: archive.address,
      mapAssetId: archive.id,
      arrivalLabel: `${archive.park} · Field ${code}`,
      arrivalInstructions: archive.arrivalInstructions,
      parking: archive.parking,
      status: "Open",
      lights: false,
      updatedAt,
    }));
  }
}

const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Goog-User-Project": PROJECT_ID },
  body: JSON.stringify({ writes }),
});

if (!response.ok) throw new Error(`Field-map archive seed failed (${response.status}): ${await response.text()}`);
console.log(`Saved ${fieldMapArchives.length} map assets and ${writes.length - fieldMapArchives.length} field records to Firestore.`);
