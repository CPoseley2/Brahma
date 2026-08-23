import { fieldMapArchives } from "../src/data/field-map-archives.js";

const PROJECT_ID = "fair-oaks-u6-team-hub";
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) throw new Error("FIREBASE_ACCESS_TOKEN is required.");

const asset = fieldMapArchives.find(item => item.id === "phoenix-park-2026");
if (!asset) throw new Error("Phoenix Park map asset definition was not found.");

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
const assetDocument = { ...asset, updatedAt };
delete assetDocument.id;

const fields = Object.keys(asset.fields).map(code => ({
  id: `phoenix-${code.toLowerCase()}`,
  name: `Phoenix Park · ${code}`,
  code,
  park: "Phoenix Park",
  address: "9050 Sunset Ave, Fair Oaks, CA",
  mapAssetId: asset.id,
  arrivalLabel: `Phoenix Park · Field ${code}`,
  arrivalInstructions: "Use the VFW parking area shown on the archival field map, then follow the field highlight for this event.",
  parking: "VFW parking only.",
  status: "Open",
  lights: false,
  updatedAt,
}));

const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
  method: "POST",
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Goog-User-Project": PROJECT_ID },
  body: JSON.stringify({ writes: [documentWrite(`fieldMapAssets/${asset.id}`, assetDocument), ...fields.map(({ id, ...field }) => documentWrite(`fields/${id}`, field))] }),
});

if (!response.ok) throw new Error(`Phoenix field-map seed failed (${response.status}): ${await response.text()}`);
console.log(`Saved ${asset.name} and ${fields.length} Phoenix field records to Firestore.`);
