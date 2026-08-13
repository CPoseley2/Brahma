import { escapeHtml } from "../shared/format.js";

export class LoginView {
  constructor(root, viewModel) { this.root = root; this.vm = viewModel; this.bound = false; this.clickBound = false; }
  mount() {
    this.root.innerHTML = `<main class="login-shell"><section class="login-card"><p class="eyebrow dark">Fair Oaks Soccer Club</p><h1>Soccer Hub</h1><p class="login-intro">Private team information for invited coaches, families, and club administrators.</p>${this.vm.completingLink ? this.#linkCompletion() : this.#signInOptions()}<div id="loginStatus" aria-live="polite"></div><div id="unauthorizedActions"></div>${this.vm.completingLink ? "" : `<a class="admin-demo-link" href="?admin-demo=1"><span>Explore the admin MVP</span><small>Open a safe workspace with sample club data →</small></a>`}</section></main>`;
    this.root.querySelector("#passwordForm")?.addEventListener("submit", event => { event.preventDefault(); this.vm.signInPassword(event.currentTarget.elements.email.value, event.currentTarget.elements.password.value); });
    this.root.querySelector("#emailLinkForm")?.addEventListener("submit", event => { event.preventDefault(); this.vm.sendEmailLink(event.currentTarget.elements.email.value); });
    this.root.querySelector("#completeLinkForm")?.addEventListener("submit", event => { event.preventDefault(); this.vm.completeLink(event.currentTarget.elements.email.value); });
    this.root.querySelector("[data-action=google-sign-in]")?.addEventListener("click", () => this.vm.signInGoogle());
    if (!this.clickBound) { this.root.addEventListener("click", event => {
      if (event.target.closest("[data-action=retry-access]")) this.vm.retryAccess();
      if (event.target.closest("[data-action=sign-out]")) this.vm.signOut();
    }); this.clickBound = true; }
    if (!this.bound) { this.vm.addEventListener("change", () => this.render()); this.bound = true; }
    this.render();
  }
  #signInOptions() { return `<button class="button google-button" type="button" data-action="google-sign-in"><span class="google-mark">G</span> Continue with Google</button><div class="login-divider"><span>or use email</span></div><form id="passwordForm"><label class="field"><span>Email address</span><input name="email" type="email" autocomplete="email" required></label><label class="field login-password"><span>Password</span><input name="password" type="password" minlength="8" autocomplete="current-password" required></label><button class="button primary login-submit" type="submit">Sign in with password</button></form><details class="email-link-fallback"><summary>Email me a one-time link instead</summary><form id="emailLinkForm"><label class="field"><span>Email address</span><input name="email" type="email" autocomplete="email" required></label><button class="button login-submit" type="submit">Send sign-in link</button></form><p class="small muted">Email links are subject to Firebase’s daily sending limit.</p></details>`; }
  #linkCompletion() { return `<form id="completeLinkForm"><label class="field"><span>Email address that received the link</span><input name="email" type="email" autocomplete="email" required></label><button class="button primary login-submit" type="submit">Complete sign in</button></form>`; }
  render() {
    if (!this.root.querySelector(".login-card")) return;
    const { status, error: authError, user } = this.vm.snapshot;
    const busy = ["initializing", "signingIn", "loadingProfile"].includes(status);
    this.root.querySelectorAll("button,input").forEach(element => { element.disabled = busy; });
    const error = this.vm.error || authError;
    const progress = status === "initializing" ? "Checking your saved sign-in…"
      : status === "signingIn" ? "Opening secure sign-in…"
      : status === "loadingProfile" ? `Signed in as ${user?.email || "your account"}. Checking team access…` : "";
    this.root.querySelector("#loginStatus").innerHTML = error ? `<div class="login-message error"><strong>Sign-in stopped.</strong><br>${escapeHtml(error.message || "Sign in failed.")}</div>` : this.vm.message ? `<div class="login-message success">${escapeHtml(this.vm.message)}</div>` : progress ? `<div class="login-message">${escapeHtml(progress)}</div>` : "";
    this.root.querySelector("#unauthorizedActions").innerHTML = status === "unauthorized" ? `<div class="login-message error"><strong>${escapeHtml(user?.email || "This account")} is signed in.</strong><br>We could not confirm its team access. You can retry without signing in again.</div><div class="button-row"><button class="button primary" data-action="retry-access">Retry team access</button><button class="button" data-action="sign-out">Use another account</button></div>` : "";
  }
}
