export class LoginViewModel extends EventTarget {
  constructor(authManager) {
    super(); this.auth = authManager; this.email = ""; this.message = ""; this.error = null;
    this.auth.addEventListener("change", event => this.dispatchEvent(new CustomEvent("change", { detail: event.detail })));
  }
  get snapshot() { return this.auth.snapshot; }
  get completingLink() { return this.auth.isEmailLink(); }
  async signInGoogle() { await this.#run(() => this.auth.signInWithGoogle()); }
  async signInPassword(email, password) {
    this.email = email.trim().toLowerCase();
    await this.#run(() => this.auth.signIn(this.email, password));
  }
  async sendEmailLink(email) {
    this.email = email.trim().toLowerCase();
    await this.#run(async () => {
      await this.auth.sendSignInLink(this.email, `${window.location.origin}${window.location.pathname}`);
      this.message = "Check your email for a secure sign-in link.";
    });
  }
  async completeLink(email) {
    this.email = email.trim().toLowerCase();
    await this.#run(async () => {
      await this.auth.completeEmailLink(window.location.href, this.email);
      window.history.replaceState({}, document.title, window.location.pathname);
    });
  }
  async retryAccess() { await this.#run(() => this.auth.retryProfile()); }
  async #run(operation) {
    this.error = null; this.message = ""; this.#changed();
    try { await operation(); }
    catch (error) {
      this.error = error.code === "auth/quota-exceeded"
        ? new Error("Firebase’s daily email-link limit has been reached. Use Google or password sign-in instead.")
        : error;
    }
    this.#changed();
  }
  signOut() { return this.auth.signOut(); }
  #changed() { this.dispatchEvent(new Event("change")); }
}
