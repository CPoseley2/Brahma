import { test } from "node:test";
import assert from "node:assert/strict";
import { LoginViewModel } from "../src/viewmodels/login-view-model.js";
import { authDomainForLocation } from "../src/firebase/firebase-client.js";

test("email quota failures direct users to Google or password sign-in", async () => {
  const auth = new EventTarget();
  auth.snapshot = { status: "signedOut" };
  auth.isEmailLink = () => false;
  auth.signInWithGoogle = async () => { const error = new Error("Quota"); error.code = "auth/quota-exceeded"; throw error; };
  const vm = new LoginViewModel(auth);
  await vm.signInGoogle();
  assert.match(vm.error.message, /Use Google or password sign-in instead/);
});

test("Firebase Auth uses the first-party hosting domain in production", () => {
  assert.equal(
    authDomainForLocation("fair-oaks-u6-team-hub.firebaseapp.com", "fair-oaks-u6-team-hub", "fair-oaks-u6-team-hub.web.app"),
    "fair-oaks-u6-team-hub.web.app",
  );
  assert.equal(
    authDomainForLocation("fair-oaks-u6-team-hub.firebaseapp.com", "fair-oaks-u6-team-hub", "localhost"),
    "fair-oaks-u6-team-hub.firebaseapp.com",
  );
});
