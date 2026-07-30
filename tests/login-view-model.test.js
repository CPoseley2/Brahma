import { test } from "node:test";
import assert from "node:assert/strict";
import { LoginViewModel } from "../src/viewmodels/login-view-model.js";

test("email quota failures direct users to Google or password sign-in", async () => {
  const auth = new EventTarget();
  auth.snapshot = { status: "signedOut" };
  auth.isEmailLink = () => false;
  auth.signInWithGoogle = async () => { const error = new Error("Quota"); error.code = "auth/quota-exceeded"; throw error; };
  const vm = new LoginViewModel(auth);
  await vm.signInGoogle();
  assert.match(vm.error.message, /Use Google or password sign-in instead/);
});

test("blocked Google popups give Safari recovery guidance", async () => {
  const auth = new EventTarget();
  auth.snapshot = { status: "signedOut" };
  auth.isEmailLink = () => false;
  auth.signInWithGoogle = async () => { const error = new Error("Blocked"); error.code = "auth/popup-blocked"; throw error; };
  const vm = new LoginViewModel(auth);
  await vm.signInGoogle();
  assert.match(vm.error.message, /Allow pop-ups.*Continue with Google again/);
});
