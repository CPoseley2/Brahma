import {
  browserLocalPersistence, EmailAuthProvider, GoogleAuthProvider, isSignInWithEmailLink,
  getRedirectResult, linkWithCredential, linkWithPopup, onAuthStateChanged, sendSignInLinkToEmail,
  setPersistence, signInWithEmailAndPassword, signInWithEmailLink, signInWithPopup, signInWithRedirect, signOut, updatePassword,
} from "firebase/auth";

const EMAIL_KEY = "fairOaksU6.signInEmail";
const GOOGLE_REDIRECT_KEY = "fairOaksU6.googleRedirectPending";

export class AuthManager extends EventTarget {
  constructor(auth, loadProfile, acceptInvite) {
    super(); this.auth = auth; this.loadProfile = loadProfile; this.acceptInvite = acceptInvite;
    this.user = null; this.profile = null; this.status = "initializing"; this.error = null;
    this.authVersion = 0;
    this.unsubscribe = onAuthStateChanged(auth, user => this.#handleAuthChange(user));
    this.redirectResult = this.#completeGoogleRedirect();
  }
  get currentUserId() { return this.user?.uid || null; }
  get isSignedIn() { return Boolean(this.user); }
  get snapshot() { return { user: this.user, profile: this.profile, status: this.status, error: this.error }; }
  isEmailLink(url = window.location.href) { return isSignInWithEmailLink(this.auth, url); }
  async #handleAuthChange(user) {
    const version = ++this.authVersion;
    this.user = user; this.profile = null; this.error = null;
    if (!user) { this.status = "signedOut"; return this.#changed(); }
    this.status = "loadingProfile"; this.#changed();
    try {
      const profile = await this.loadProfile(user.uid);
      if (version !== this.authVersion) return;
      this.profile = profile;
      if (!profile && this.acceptInvite) {
        await this.acceptInvite(user);
        if (version !== this.authVersion) return;
        this.profile = await this.loadProfile(user.uid);
      }
      if (!this.profile) throw new Error("Your account does not have an active team membership.");
      this.status = "ready";
    } catch (error) {
      if (version !== this.authVersion) return;
      this.error = error; this.status = "unauthorized";
    }
    this.#changed();
  }
  async #completeGoogleRedirect() {
    const pending = sessionStorage.getItem(GOOGLE_REDIRECT_KEY) === "true";
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
      else if (pending) {
        sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
        throw new Error("Google sign-in returned without a session. Please try Google sign-in again.");
      }
    } catch (error) {
      sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
      this.error = error;
      if (!this.user) this.status = "signedOut";
      this.#changed();
    }
  }
  #changed() { this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot })); }
  async signIn(email, password) {
    return this.#startSignIn(async () => {
      await setPersistence(this.auth, browserLocalPersistence);
      return signInWithEmailAndPassword(this.auth, email.trim(), password);
    });
  }
  async signInWithGoogle() {
    return this.#startSignIn(async () => {
      await setPersistence(this.auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      try { return await signInWithPopup(this.auth, provider); }
      catch (error) {
        if (error.code !== "auth/popup-blocked") throw error;
        sessionStorage.setItem(GOOGLE_REDIRECT_KEY, "true");
        return signInWithRedirect(this.auth, provider);
      }
    });
  }
  async #startSignIn(operation) {
    this.status = "signingIn"; this.error = null; this.#changed();
    try { return await operation(); }
    catch (error) { this.status = "signedOut"; this.error = error; this.#changed(); throw error; }
  }
  async sendSignInLink(email, continueUrl = window.location.href) {
    const normalized = email.trim().toLowerCase();
    await sendSignInLinkToEmail(this.auth, normalized, { url: continueUrl, handleCodeInApp: true });
    localStorage.setItem(EMAIL_KEY, normalized);
  }
  async completeEmailLink(url = window.location.href, email = localStorage.getItem(EMAIL_KEY)) {
    if (!isSignInWithEmailLink(this.auth, url)) return false;
    if (!email) throw new Error("Enter the email address that received this sign-in link.");
    await signInWithEmailLink(this.auth, email, url); localStorage.removeItem(EMAIL_KEY); return true;
  }
  async setPassword(password) {
    if (!this.auth.currentUser?.email) throw new Error("Sign in before setting a password.");
    if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
    const user = this.auth.currentUser;
    const hasPassword = user.providerData.some(provider => provider.providerId === "password");
    if (hasPassword) await updatePassword(user, password);
    else await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  async linkGoogle() {
    const user = this.auth.currentUser; if (!user) throw new Error("Sign in before connecting Google.");
    if (user.providerData.some(provider => provider.providerId === "google.com")) return;
    await linkWithPopup(user, new GoogleAuthProvider());
  }
  retryProfile() {
    if (!this.auth.currentUser) throw new Error("Sign in before retrying team access.");
    return this.#handleAuthChange(this.auth.currentUser);
  }
  async signOut() { await signOut(this.auth); this.user = null; this.profile = null; }
  destroy() { this.unsubscribe?.(); }
}
