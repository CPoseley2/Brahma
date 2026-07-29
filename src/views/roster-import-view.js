import { parseRosterFile, rosterHeaders } from "../import/roster-importer.js";
import { escapeHtml, formatDate } from "../shared/format.js";

export class RosterImportView {
  constructor(root, vm) {
    this.root = root; this.vm = vm; this.rows = []; this.errors = []; this.warnings = [];
    this.fileName = ""; this.message = ""; this.busy = false;
  }
  mount() {
    this.input = this.root.querySelector("#rosterImportInput");
    this.input.addEventListener("change", event => this.#selectFile(event.target.files[0]));
    this.root.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "confirm-roster-import") this.#import();
      if (action === "cancel-roster-import") this.#reset();
      if (action === "download-roster-template") this.#downloadTemplate();
    });
    this.render();
  }
  async #selectFile(file) {
    if (!file) return;
    this.busy = true; this.message = ""; this.errors = []; this.warnings = []; this.rows = []; this.fileName = file.name; this.render();
    try {
      const result = await parseRosterFile(file);
      this.errors = result.errors; this.warnings = result.warnings;
      this.rows = this.vm.prepareRosterImport(result.rows);
    } catch (error) { this.errors = [error.message]; }
    this.busy = false; this.render();
  }
  async #import() {
    if (!this.rows.length || this.busy) return;
    this.busy = true; this.message = ""; this.render();
    try {
      const result = await this.vm.importRoster(this.rows);
      this.message = `Imported ${result.playerCount} athlete${result.playerCount === 1 ? "" : "s"}, ${result.familyCount} famil${result.familyCount === 1 ? "y" : "ies"}, and ${result.inviteCount} guardian invitation${result.inviteCount === 1 ? "" : "s"}.`;
      this.rows = []; this.errors = []; this.warnings = []; this.fileName = ""; this.input.value = "";
    } catch (error) { this.errors = [error.message]; }
    this.busy = false; this.render();
  }
  #reset() {
    this.rows = []; this.errors = []; this.warnings = []; this.fileName = ""; this.message = ""; this.input.value = ""; this.render();
  }
  #downloadTemplate() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`${rosterHeaders.join(",")}\n`], { type: "text/csv;charset=utf-8" }));
    link.download = "fair-oaks-u6-roster-template.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  render() {
    const panel = this.root.querySelector(".roster-import-panel"); if (!panel) return;
    const canImport = this.vm.isHeadCoach;
    panel.querySelector("label[for=rosterImportInput]").classList.toggle("hidden", !canImport);
    const status = panel.querySelector("#rosterImportStatus");
    if (!canImport) status.innerHTML = `<div class="login-message error">Only the head coach can import a roster and create guardian invitations.</div>`;
    else if (this.errors.length) status.innerHTML = `<div class="login-message error"><strong>Could not import this file.</strong><ul>${this.errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>`;
    else if (this.message) status.innerHTML = `<div class="login-message success">${escapeHtml(this.message)}</div>`;
    else if (this.busy) status.innerHTML = `<div class="login-message">${this.rows.length ? "Importing roster…" : "Reading and validating file…"}</div>`;
    else status.innerHTML = "";
    const preview = panel.querySelector("#rosterImportPreview"); preview.classList.toggle("hidden", !this.rows.length);
    if (!this.rows.length) return;
    const adds = this.rows.filter(row => row.importAction === "Add").length;
    panel.querySelector("#rosterImportSummary").textContent = `${this.fileName}: ${adds} new, ${this.rows.length - adds} updates`;
    panel.querySelector("#rosterImportWarnings").innerHTML = this.warnings.length ? `<div class="login-message"><ul>${this.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : "";
    panel.querySelector("#rosterImportBody").innerHTML = this.rows.map(row => `<tr><td><span class="badge ${row.importAction === "Add" ? "blue" : "gold"}">${row.importAction}</span></td><td><span class="name">${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</span></td><td>${escapeHtml(row.gender || "—")}</td><td>${formatDate(row.dateOfBirth)}</td><td>${escapeHtml(row.familyEmail)}</td><td>${escapeHtml(row.familyPhone || "—")}</td></tr>`).join("");
    panel.querySelector("[data-action=confirm-roster-import]").disabled = this.busy;
    panel.querySelector("[data-action=confirm-roster-import]").textContent = this.busy ? "Importing…" : `Import ${this.rows.length} athlete${this.rows.length === 1 ? "" : "s"}`;
  }
}
