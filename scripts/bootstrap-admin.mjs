const PROJECT_ID = "fair-oaks-u6-team-hub";
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN;
const uid = process.argv[2]?.trim();
const email = process.argv[3]?.trim().toLowerCase();

if (!ACCESS_TOKEN) throw new Error("FIREBASE_ACCESS_TOKEN is required.");
if (!uid || uid.includes("/")) throw new Error("Pass the Firebase Authentication user UID.");
if (!email || !email.includes("@")) throw new Error("Pass the administrator email address.");

const valueFor = value => {
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: value };
};

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
      writes: [{
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/clubAdmins/${uid}`,
          fields: {
            active: valueFor(true), email: valueFor(email), role: valueFor("clubAdmin"), superUser: valueFor(true),
            grantedAt: valueFor(new Date().toISOString()),
          },
        },
      }],
    }),
  },
);

if (!response.ok) throw new Error(`Admin bootstrap failed (${response.status}): ${await response.text()}`);
console.log(`Granted club administrator access to ${email}.`);
