import { readFile } from "node:fs/promises";

const PROJECT_ID = "fair-oaks-u6-team-hub";
const TEAM_ID = "fair-oaks-u6";
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN;
const coachEmail = process.argv[2]?.trim().toLowerCase();

if (!ACCESS_TOKEN) throw new Error("FIREBASE_ACCESS_TOKEN is required.");
if (!coachEmail || !coachEmail.includes("@")) throw new Error("Pass the first coach email address.");

const seed = JSON.parse(await readFile(new URL("../private/team-data.private.json", import.meta.url)));
const team = { ...seed.team, skillFramework: seed.skillFramework || [] };

function valueFor(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valueFor) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, valueFor(item)])) } };
  }
  throw new TypeError(`Unsupported Firestore value: ${typeof value}`);
}

function documentWrite(path, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
      fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, valueFor(value)])),
    },
  };
}

const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": PROJECT_ID,
    },
    body: JSON.stringify({
      writes: [
        documentWrite(`teams/${TEAM_ID}`, team),
        documentWrite(`teams/${TEAM_ID}/invites/${coachEmail}`, {
          active: true,
          email: coachEmail,
          role: "headCoach",
          familyId: null,
        }),
      ],
    }),
  },
);

if (!response.ok) throw new Error(`Firestore bootstrap failed (${response.status}): ${await response.text()}`);

console.log(`Bootstrapped ${team.name} and invited ${coachEmail} as head coach.`);
