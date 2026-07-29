import { coachTemplate } from "./templates/coach-template.js";
import { sharedTemplate } from "./templates/shared-template.js";
import { familyTemplate } from "./templates/family-template.js";
import { dialogTemplate } from "./templates/dialog-template.js";
import { messageTemplate } from "./templates/message-template.js";
import { accountTemplate } from "./templates/account-template.js";
import { playbookTemplate } from "./templates/playbook-template.js";
import { fieldModeTemplate } from "./templates/field-mode-template.js";

export class ShellView {
  constructor(root, viewModel, childViews, authManager = null) {
    this.root = root;
    this.vm = viewModel;
    this.childViews = childViews;
    this.auth = authManager;
  }

  mount() {
    this.root.innerHTML = `<div class="app-shell"><header class="topbar"><div class="topbar-inner"><div><p class="eyebrow">Fair Oaks Soccer Club</p><h1 id="teamTitle"></h1><p id="viewSubtitle" class="subtitle"></p></div><div class="view-controls"><span class="signed-in-user"></span><button class="button" data-action="open-account">Account</button><button class="button" data-action="sign-out">Sign out</button></div></div><nav id="mainNav" aria-label="Team hub sections"></nav></header><main>${coachTemplate}${playbookTemplate}${messageTemplate}${sharedTemplate}${familyTemplate}</main><footer>Fair Oaks Soccer Club U6 Team Hub · Private team workspace</footer></div>${dialogTemplate}${accountTemplate}${fieldModeTemplate}`;
    this.root.addEventListener("click", event => this.#onClick(event));
    this.vm.addEventListener("change", () => this.render());
    this.childViews.forEach(view => view.mount?.());
    this.render();
  }

  #onClick(event) {
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) { this.vm.go(route); window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (event.target.closest("[data-action=sign-out]")) { this.vm.dispose(); this.auth?.signOut(); }
  }

  render() {
    const { role, route, state } = this.vm;
    this.root.querySelector("#teamTitle").textContent = state.team.name || "Fair Oaks Soccer Club U6";
    this.root.querySelector("#viewSubtitle").textContent = role === "coach" ? "Coach workspace" : "Family view";
    this.root.querySelector(".signed-in-user").textContent = this.vm.identity?.user.email || "Signed in";
    this.root.querySelector("#mainNav").innerHTML = this.vm.navigation.map(([id, label]) => `<button data-route="${id}" class="${route === id ? "active" : ""}">${label}</button>`).join("");
    this.root.querySelectorAll(".coach-only,.coach-only-inline").forEach(element => element.classList.toggle("hidden", role !== "coach"));
    this.root.querySelectorAll(".family-only").forEach(element => element.classList.toggle("hidden", role !== "family"));
    this.root.querySelectorAll(".view").forEach(element => element.classList.toggle("active", element.id === route));
    this.childViews.forEach(view => view.render());
  }
}
