import { after, before, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

// Cross-service Storage rules resolve Firestore documents through the emulator's
// configured project, so this suite must use the Firebase CLI project id.
const projectId = "fair-oaks-u6-team-hub";
const teamId = "fair-oaks-u6";
let environment;

const storage = (uid, email) => environment.authenticatedContext(uid, { email, email_verified: true }).storage();
const documentPath = name => `teams/${teamId}/documents/${name}/${name}.pdf`;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
    storage: { rules: await readFile("storage.rules", "utf8") },
  });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `teams/${teamId}/members/coach`), { role: "headCoach", active: true, email: "coach@example.com" });
    await setDoc(doc(db, `teams/${teamId}/members/assistant`), { role: "assistantCoach", active: true, email: "assistant@example.com" });
    await setDoc(doc(db, `teams/${teamId}/members/parent`), { role: "guardian", active: true, email: "parent@example.com" });
    await uploadBytes(ref(context.storage(), documentPath("existing")), new Blob(["team document"], { type: "application/pdf" }), { contentType: "application/pdf" });
  });
});

after(async () => environment?.cleanup());

describe("team document storage", () => {
  test("active coaches and parents can read documents while anonymous users cannot", async () => {
    await assertSucceeds(getBytes(ref(storage("coach", "coach@example.com"), documentPath("existing"))));
    await assertSucceeds(getBytes(ref(storage("parent", "parent@example.com"), documentPath("existing"))));
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), documentPath("existing"))));
  });

  test("any coach can upload, physically copy, and delete an allowed document", async () => {
    const assistant = storage("assistant", "assistant@example.com");
    const source = ref(assistant, documentPath("assistant-source"));
    const copy = ref(assistant, documentPath("assistant-copy"));
    const pdf = new Blob(["coach document"], { type: "application/pdf" });
    await assertSucceeds(uploadBytes(source, pdf, { contentType: "application/pdf" }));
    const bytes = await getBytes(source);
    await assertSucceeds(uploadBytes(copy, new Blob([bytes], { type: "application/pdf" }), { contentType: "application/pdf" }));
    await assertSucceeds(deleteObject(source));
    await assertSucceeds(deleteObject(copy));
  });

  test("parents cannot upload or delete documents", async () => {
    const parent = storage("parent", "parent@example.com");
    await assertFails(uploadBytes(ref(parent, documentPath("parent-upload")), new Blob(["blocked"], { type: "application/pdf" }), { contentType: "application/pdf" }));
    await assertFails(deleteObject(ref(parent, documentPath("existing"))));
  });

  test("coaches cannot upload unsupported types, oversized files, or files outside Docs", async () => {
    const coach = storage("coach", "coach@example.com");
    await assertFails(uploadBytes(ref(coach, `teams/${teamId}/documents/bad/bad.gif`), new Blob(["gif"], { type: "image/gif" }), { contentType: "image/gif" }));
    await assertFails(uploadBytes(ref(coach, `teams/${teamId}/other/file.pdf`), new Blob(["outside"], { type: "application/pdf" }), { contentType: "application/pdf" }));
    const oversized = new Blob([new Uint8Array(10 * 1024 * 1024)], { type: "application/pdf" });
    await assertFails(uploadBytes(ref(coach, documentPath("oversized")), oversized, { contentType: "application/pdf" }));
  });
});
