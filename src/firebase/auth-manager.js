import {
  browserLocalPersistence, EmailAuthProvider, GoogleAuthProvider, isSignInWithEmailLink,
  linkWithCredential, linkWithPopup, onAuthStateChanged, sendSignInLinkToEmail,
  setPersistence, signInWithEmailAndPassword, signInWithEmailLink, signInWithPopup, signOut, updatePassword,
} from "firebase/auth";

const EMAIL_KEY = "fairOaksU6.signInEmail";

export class AuthManager extends EventTarget {
  constructor(auth, loadProfile, acceptInvite) {
    super(); this.auth = auth; this.loadProfile = loadProfile; this.acceptInvite = acceptInvite;
    this.user = null; this.profile = null; this.status = "initializing"; this.error = null;
    this.authVersion = 0;
    this.unsubscribe = onAuthStateChanged(auth, user => this.#handleAuthChange(user));
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
  #changed() { this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot })); }
  async signIn(email, password) {
    return this.#startSignIn(async () => {
      await setPersistence(this.auth, browserLocalPersistence);
      return signInWithEmailAndPassword(this.auth, email.trim(), password);
    });
  }
  async signInWithGoogle() {
    return this.#startSignIn(async () => {
      return signInWithPopup(this.auth, new GoogleAuthProvider());
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
