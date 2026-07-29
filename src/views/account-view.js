import { escapeHtml } from "../shared/format.js";

export class AccountView {
  constructor(root, auth) { this.root = root; this.auth = auth; this.message = ""; this.error = ""; }
  mount() {
    this.root.addEventListener("click", event => {
      if (event.target.closest("[data-action=open-account]")) this.open();
      if (event.target.closest("[data-action=close-account]")) this.root.querySelector("#accountDialog").close();
      if (event.target.closest("[data-action=connect-google]")) this.#connectGoogle(event.target.closest("button"));
    });
    this.root.querySelector("#setPasswordForm").addEventListener("submit", event => this.#setPassword(event));
  }
  render() {}
  open() { this.message = ""; this.error = ""; this.#render(); this.root.querySelector("#accountDialog").showModal(); }
  async #setPassword(event) {
    event.preventDefault(); const form = event.currentTarget;
    if (form.elements.password.value !== form.elements.confirmation.value) { this.error = "The password confirmation does not match."; return this.#render(); }
    await this.#submit(event.submitter, () => this.auth.setPassword(form.elements.password.value), "Your password is ready. You can use email and password the next time you sign in.");
    if (!this.error) form.reset();
  }
  async #connectGoogle(button) { await this.#submit(button, () => this.auth.linkGoogle(), "Google sign-in is connected to this account."); }
  async #submit(button, operation, message) {
    button.disabled = true; this.error = ""; this.message = "";
    try { await operation(); this.message = message; } catch (error) { this.error = error.message; }
    finally { button.disabled = false; this.#render(); }
  }
  #render() {
    const user = this.auth.user; if (!user) return;
    const providers = user.providerData.map(item => item.providerId === "google.com" ? "Google" : item.providerId === "password" ? "Email" : item.providerId).join(" · ") || "Email link";
    this.root.querySelector("#accountIdentity").textContent = `${user.email} · Connected: ${providers}`;
    this.root.querySelector("#accountFeedback").innerHTML = this.error ? `<div class="login-message error">${escapeHtml(this.error)}</div>` : this.message ? `<div class="login-message success">${escapeHtml(this.message)}</div>` : "";
  }
}
