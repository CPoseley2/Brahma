import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const projectId = "fair-oaks-u6-team-hub-test";
const teamId = "fair-oaks-u6";
let environment;

const auth = (uid, email, extra = {}) => environment.authenticatedContext(uid, { email, email_verified: true, ...extra }).firestore();
const path = value => `teams/${teamId}/${value}`;

async function seed() {
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `teams/${teamId}`), { name: "Fair Oaks Soccer Club U6" });
    await setDoc(doc(db, path("members/coach")), { role: "headCoach", familyId: null, active: true, email: "coach@example.com" });
    await setDoc(doc(db, path("members/assistant")), { role: "assistantCoach", familyId: null, active: true, email: "assistant@example.com" });
    await setDoc(doc(db, path("members/guardian-a")), { role: "guardian", familyId: "family-a", active: true, email: "a@example.com" });
    await setDoc(doc(db, path("members/guardian-b")), { role: "guardian", familyId: "family-b", active: true, email: "b@example.com" });
    await setDoc(doc(db, path("members/guardian-one")), { role: "guardian", familyId: null, playerIds: ["player-a"], guardianIds: ["relationship-one"], active: true, email: "one@example.com" });
    await setDoc(doc(db, path("members/guardian-two")), { role: "guardian", familyId: null, playerIds: ["player-a"], guardianIds: ["relationship-two"], active: true, email: "two@example.com" });
    await setDoc(doc(db, path("players/player-a")), { firstName: "Alpha", familyId: "family-a" });
    await setDoc(doc(db, path("players/player-b")), { firstName: "Beta", familyId: "family-b" });
    await setDoc(doc(db, path("players/player-a/sharedObservations/shared-1")), { celebration: "Great play" });
    await setDoc(doc(db, path("players/player-a/privateObservations/private-1")), { privateNote: "Coach only" });
    await setDoc(doc(db, path("events/event-1")), { type: "Game", status: "Scheduled" });
    await setDoc(doc(db, path("events/event-1/rsvps/player-a")), { playerId: "player-a", userId: "guardian-a", status: "yes" });
    await setDoc(doc(db, path("events/event-1/rsvps/player-b")), { playerId: "player-b", userId: "guardian-b", status: "no" });
    await setDoc(doc(db, path("volunteerSlots/slot-1")), { role: "Snacks", assigneeFamilyId: null });
    await setDoc(doc(db, path("families/family-a")), { displayName: "Alpha family" });
    await setDoc(doc(db, path("families/family-b")), { displayName: "Beta family" });
    await setDoc(doc(db, path("guardians/relationship-one")), { playerId: "player-a", name: "Guardian One", email: "one@example.com", relationship: "parent", active: true });
    await setDoc(doc(db, path("guardians/relationship-two")), { playerId: "player-a", name: "Guardian Two", email: "two@example.com", relationship: "grandparent", active: true });
    await setDoc(doc(db, path("broadcasts/broadcast-1")), { title: "Welcome", body: "Hello team", familyIds: [], sentByUid: "coach", sentByLabel: "Coach", sentAt: "2026-07-22T12:00:00.000Z", attachments: [], actionButton: null });
    await setDoc(doc(db, path("messages/message-a")), { familyId: "family-a", body: "Alpha question", senderUid: "guardian-a", senderRole: "guardian", senderLabel: "Alpha family", createdAt: "2026-07-22T12:00:00.000Z" });
    await setDoc(doc(db, path("messages/message-b")), { familyId: "family-b", body: "Beta question", senderUid: "guardian-b", senderRole: "guardian", senderLabel: "Beta family", createdAt: "2026-07-22T12:00:00.000Z" });
    await setDoc(doc(db, path("messages/message-one")), { guardianId: "relationship-one", playerId: "player-a", body: "Private one", senderUid: "guardian-one", senderRole: "guardian", senderLabel: "Guardian One", createdAt: "2026-07-22T12:00:00.000Z" });
    await setDoc(doc(db, path("messages/message-two")), { guardianId: "relationship-two", playerId: "player-a", body: "Private two", senderUid: "guardian-two", senderRole: "guardian", senderLabel: "Guardian Two", createdAt: "2026-07-22T12:00:00.000Z" });
    await setDoc(doc(db, path("drillCards/gates-galore")), { imageUrl: "https://example.com/gates.png", imagePath: "teams/test/gates.png", fileName: "gates.png" });
    await setDoc(doc(db, path("invites/new@example.com")), { role: "guardian", familyId: "family-a", playerIds: [], guardianIds: [], active: true });
  });
}

before(async () => { environment = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8") } }); });
beforeEach(async () => { await environment.clearFirestore(); await seed(); });
after(async () => environment?.cleanup());

describe("team privacy", () => {
  test("anonymous users cannot read a team", async () => assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), `teams/${teamId}`))));
  test("guardians can read only their own players", async () => {
    const db = auth("guardian-a", "a@example.com");
    await assertSucceeds(getDoc(doc(db, path("players/player-a"))));
    await assertFails(getDoc(doc(db, path("players/player-b"))));
  });
  test("player-scoped guardians can share one player without sharing each other's profiles", async () => {
    const db = auth("guardian-one", "one@example.com");
    await assertSucceeds(getDoc(doc(db, path("players/player-a"))));
    await assertFails(getDoc(doc(db, path("players/player-b"))));
    await assertSucceeds(getDoc(doc(db, path("guardians/relationship-one"))));
    await assertFails(getDoc(doc(db, path("guardians/relationship-two"))));
  });
  test("guardians see shared observations but never private notes", async () => {
    const db = auth("guardian-a", "a@example.com");
    await assertSucceeds(getDoc(doc(db, path("players/player-a/sharedObservations/shared-1"))));
    await assertFails(getDoc(doc(db, path("players/player-a/privateObservations/private-1"))));
  });
  test("coaches can read private observations", async () => assertSucceeds(getDoc(doc(auth("coach", "coach@example.com"), path("players/player-a/privateObservations/private-1")))));
  test("guardians can read only their own player's RSVP", async () => {
    const db = auth("guardian-a", "a@example.com");
    await assertSucceeds(getDoc(doc(db, path("events/event-1/rsvps/player-a"))));
    await assertFails(getDoc(doc(db, path("events/event-1/rsvps/player-b"))));
  });
  test("guardians can read team broadcasts", async () => assertSucceeds(getDoc(doc(auth("guardian-a", "a@example.com"), path("broadcasts/broadcast-1")))));
  test("members can list team broadcasts", async () => {
    await assertSucceeds(getDocs(collection(auth("guardian-a", "a@example.com"), path("broadcasts"))));
    await assertSucceeds(getDocs(collection(auth("coach", "coach@example.com"), path("broadcasts"))));
  });
  test("coaches can read guardian membership status but guardians cannot read each other", async () => {
    await assertSucceeds(getDocs(collection(auth("assistant", "assistant@example.com"), path("members"))));
    await assertSucceeds(getDoc(doc(auth("guardian-one", "one@example.com"), path("members/guardian-one"))));
    await assertFails(getDoc(doc(auth("guardian-one", "one@example.com"), path("members/guardian-two"))));
  });
  test("drill-card artwork is a coach-only coaching tool", async () => {
    await assertSucceeds(getDoc(doc(auth("coach", "coach@example.com"), path("drillCards/gates-galore"))));
    await assertFails(getDoc(doc(auth("guardian-a", "a@example.com"), path("drillCards/gates-galore"))));
  });
  test("guardians can query only their family conversation", async () => {
    const db = auth("guardian-a", "a@example.com");
    await assertSucceeds(getDocs(query(collection(db, path("messages")), where("familyId", "==", "family-a"))));
    await assertFails(getDocs(query(collection(db, path("messages")), where("familyId", "==", "family-b"))));
    await assertFails(getDoc(doc(db, path("messages/message-b"))));
  });
  test("guardians of the same player cannot read each other's private conversation", async () => {
    const db = auth("guardian-one", "one@example.com");
    await assertSucceeds(getDocs(query(collection(db, path("messages")), where("guardianId", "==", "relationship-one"))));
    await assertFails(getDocs(query(collection(db, path("messages")), where("guardianId", "==", "relationship-two"))));
    await assertFails(getDoc(doc(db, path("messages/message-two"))));
  });
});

describe("authorized writes", () => {
  test("guardians cannot edit events", async () => assertFails(updateDoc(doc(auth("guardian-a", "a@example.com"), path("events/event-1")), { status: "Canceled" })));
  test("members can record only their own last login activity", async () => {
    const db = auth("guardian-one", "one@example.com");
    await assertSucceeds(updateDoc(doc(db, path("members/guardian-one")), { lastLoginAt: "2026-07-29T20:00:00.000Z" }));
    await assertFails(updateDoc(doc(db, path("members/guardian-one")), { role: "headCoach" }));
    await assertFails(updateDoc(doc(db, path("members/guardian-two")), { lastLoginAt: "2026-07-29T20:00:00.000Z" }));
  });
  test("guardians can RSVP only for their own player", async () => {
    const db = auth("guardian-a", "a@example.com");
    await assertSucceeds(setDoc(doc(db, path("events/event-1/rsvps/player-a")), { playerId: "player-a", userId: "guardian-a", status: "yes" }));
    await assertFails(setDoc(doc(db, path("events/event-1/rsvps/player-b")), { playerId: "player-b", userId: "guardian-a", status: "yes" }));
  });
  test("guardians can claim an open volunteer slot for their family", async () => assertSucceeds(updateDoc(doc(auth("guardian-a", "a@example.com"), path("volunteerSlots/slot-1")), { assigneeFamilyId: "family-a" })));
  test("an invited verified user can create only the prescribed membership", async () => {
    const db = auth("new-user", "new@example.com");
    await assertSucceeds(setDoc(doc(db, path("members/new-user")), { email: "new@example.com", role: "guardian", familyId: "family-a", playerIds: [], guardianIds: [], active: true }));
    await assertFails(setDoc(doc(db, path("members/attacker")), { email: "new@example.com", role: "headCoach", familyId: null, active: true }));
  });
  test("the head coach can batch a family, player, and guardian invite", async () => {
    const db = auth("coach", "coach@example.com"); const batch = writeBatch(db);
    batch.set(doc(db, path("families/imported-family")), { displayName: "Imported family", email: "imported@example.com" });
    batch.set(doc(db, path("players/imported-player")), { firstName: "Imported", familyId: "imported-family" });
    batch.set(doc(db, path("invites/imported@example.com")), { email: "imported@example.com", role: "guardian", familyId: "imported-family", active: true });
    await assertSucceeds(batch.commit());
  });
  test("an assistant coach cannot create guardian invitations", async () => {
    const db = auth("assistant", "assistant@example.com");
    await assertFails(setDoc(doc(db, path("invites/blocked@example.com")), { email: "blocked@example.com", role: "guardian", familyId: "family-a", active: true }));
  });
  test("only the head coach can create guardian relationships", async () => {
    const data = { playerId: "player-a", name: "New Guardian", email: "new-guardian@example.com", relationship: "friend", active: true };
    await assertSucceeds(setDoc(doc(auth("coach", "coach@example.com"), path("guardians/new-relationship")), data));
    await assertFails(setDoc(doc(auth("assistant", "assistant@example.com"), path("guardians/blocked-relationship")), data));
  });
  test("coaches can broadcast to the team but guardians cannot", async () => {
    const data = { title: "Schedule", body: "Practice moved.", familyIds: [], sentByUid: "coach", sentByLabel: "Head Coach", sentAt: "2026-07-22T13:00:00.000Z", attachments: [], actionButton: null };
    await assertSucceeds(setDoc(doc(auth("coach", "coach@example.com"), path("broadcasts/broadcast-2")), data));
    await assertFails(setDoc(doc(auth("guardian-a", "a@example.com"), path("broadcasts/broadcast-3")), { ...data, sentByUid: "guardian-a" }));
  });
  test("guardians can message coaches only from their own family thread", async () => {
    const db = auth("guardian-a", "a@example.com");
    const own = { familyId: "family-a", body: "Can you help?", senderUid: "guardian-a", senderRole: "guardian", senderLabel: "Alpha family", createdAt: "2026-07-22T13:00:00.000Z" };
    await assertSucceeds(setDoc(doc(db, path("messages/new-own")), own));
    await assertFails(setDoc(doc(db, path("messages/new-other")), { ...own, familyId: "family-b" }));
    await assertFails(setDoc(doc(db, path("messages/fake-coach")), { ...own, senderRole: "coach" }));
  });
  test("player guardians can message only in their individual conversation", async () => {
    const db = auth("guardian-one", "one@example.com");
    const own = { guardianId: "relationship-one", playerId: "player-a", body: "Private question", senderUid: "guardian-one", senderRole: "guardian", senderLabel: "Guardian One", createdAt: "2026-07-22T13:00:00.000Z" };
    await assertSucceeds(setDoc(doc(db, path("messages/new-guardian-own")), own));
    await assertFails(setDoc(doc(db, path("messages/new-guardian-other")), { ...own, guardianId: "relationship-two" }));
    await assertFails(setDoc(doc(db, path("messages/new-guardian-player")), { ...own, playerId: "player-b" }));
  });
  test("coaches can read and reply to every family thread", async () => {
    const db = auth("assistant", "assistant@example.com");
    await assertSucceeds(getDocs(collection(db, path("messages"))));
    await assertSucceeds(getDoc(doc(db, path("messages/message-a"))));
    await assertSucceeds(getDoc(doc(db, path("messages/message-b"))));
    await assertSucceeds(setDoc(doc(db, path("messages/coach-reply")), { familyId: "family-a", body: "Absolutely.", senderUid: "assistant", senderRole: "coach", senderLabel: "Coach", createdAt: "2026-07-22T13:00:00.000Z" }));
  });
  test("coaches can attach drill-card artwork but guardians cannot", async () => {
    const data = { imageUrl: "https://example.com/new.png", imagePath: "teams/test/new.png", fileName: "new.png", updatedAt: "2026-07-22T13:00:00.000Z", updatedByUid: "assistant" };
    await assertSucceeds(setDoc(doc(auth("assistant", "assistant@example.com"), path("drillCards/new-drill")), data));
    await assertFails(setDoc(doc(auth("guardian-a", "a@example.com"), path("drillCards/blocked")), data));
  });
});
