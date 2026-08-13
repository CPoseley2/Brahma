import { addDays, startOfWeek } from "../admin/admin-domain.js";
import { parseScheduleFile, scheduleHeaders, scheduleTemplateCsv } from "../import/schedule-importer.js";
import { escapeHtml, formatDate, formatTime } from "../shared/format.js";

export class AdminScheduleImportView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.rows = []; this.errors = []; this.warnings = []; this.fileName = ""; this.message = ""; this.busy = false; }
  mount() {
    this.dialog = this.root.querySelector("#adminScheduleImportDialog"); this.input = this.root.querySelector("#adminScheduleImportInput");
    this.input.addEventListener("change", event => this.#selectFile(event.target.files[0]));
    this.root.addEventListener("click", event => {
      const action = event.target.closest("[data-admin-action]")?.dataset.adminAction;
      if (action === "import-schedule") this.open();
      if (action === "download-schedule-template") this.#downloadTemplate();
      if (action === "confirm-schedule-import") this.#import();
      if (action === "cancel-schedule-import") this.#reset();
    });
    this.render();
  }
  open() {
    if (this.vm.selectedScenario?.status === "published") {
      window.alert("The published schedule is locked. Duplicate it or choose a draft before staging a CSV."); return;
    }
    this.#reset(); this.dialog.showModal();
  }
  async #selectFile(file) {
    if (!file) return;
    this.busy = true; this.message = ""; this.errors = []; this.warnings = []; this.rows = []; this.fileName = file.name; this.render();
    try {
      const result = await parseScheduleFile(file, this.vm.scheduleImportReferences);
      this.rows = result.rows; this.errors = result.errors; this.warnings = result.warnings;
    } catch (error) { this.errors = [error.message]; }
    this.busy = false; this.render();
  }
  async #import() {
    if (!this.rows.length || this.busy) return;
    this.busy = true; this.message = ""; this.render();
    try {
      const result = await this.vm.importPractices(this.rows);
      this.message = `Staged ${result.total} practices in “${this.vm.selectedScenario.name}”: ${result.adds} added and ${result.updates} updated. Nothing changes for families until this scenario is published.`;
      this.rows = []; this.errors = []; this.warnings = []; this.fileName = ""; this.input.value = "";
    } catch (error) { this.errors = [error.message]; }
    this.busy = false; this.render();
  }
  #reset() { this.rows = []; this.errors = []; this.warnings = []; this.fileName = ""; this.message = ""; this.busy = false; if (this.input) this.input.value = ""; this.render(); }
  #downloadTemplate() {
    const date = addDays(startOfWeek(new Date()), 7);
    const contents = scheduleTemplateCsv(this.vm.teams, this.vm.state.fields, date);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
    link.download = "fair-oaks-practice-schedule-template.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  render() {
    if (!this.dialog) return;
    this.root.querySelector("#adminScheduleSchema").innerHTML = scheduleHeaders.map(header => `<span>${escapeHtml(header)}</span>`).join("");
    const status = this.root.querySelector("#adminScheduleImportStatus");
    if (this.errors.length) status.innerHTML = `<div class="login-message error"><strong>Fix the CSV before importing.</strong><ul>${this.errors.slice(0, 12).map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>${this.errors.length > 12 ? `<p>Plus ${this.errors.length - 12} more validation errors.</p>` : ""}</div>`;
    else if (this.message) status.innerHTML = `<div class="login-message success">${escapeHtml(this.message)}</div>`;
    else if (this.busy) status.innerHTML = `<div class="login-message">${this.rows.length ? "Staging practices…" : "Reading and validating schedule…"}</div>`;
    else status.innerHTML = "";
    const preview = this.root.querySelector("#adminScheduleImportPreview"); preview.classList.toggle("hidden", !this.rows.length);
    if (!this.rows.length) return;
    const adds = this.rows.filter(row => row.importAction === "Add").length;
    this.root.querySelector("#adminScheduleImportSummary").textContent = `${this.fileName}: ${adds} new · ${this.rows.length - adds} updates · all rows valid`;
    this.root.querySelector("#adminScheduleImportWarnings").innerHTML = this.warnings.length ? `<div class="login-message"><ul>${this.warnings.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
    this.root.querySelector("#adminScheduleImportBody").innerHTML = this.rows.slice(0, 100).map(row => `<tr><td><span class="badge ${row.importAction === "Add" ? "blue" : "gold"}">${row.importAction}</span></td><td><strong>${escapeHtml(this.vm.team(row.teamId)?.name || row.teamId)}</strong><small>${escapeHtml(row.id)}</small></td><td>${formatDate(row.date)}<small>${formatTime(row.time)} · ${row.durationMinutes} min</small></td><td>${escapeHtml(this.vm.field(row.fieldId)?.name || row.fieldId)}</td><td>${escapeHtml(row.status)}</td></tr>`).join("");
    this.root.querySelector("#adminScheduleImportTruncation").textContent = this.rows.length > 100 ? `Showing the first 100 of ${this.rows.length} validated rows.` : "";
    const button = this.root.querySelector("[data-admin-action=confirm-schedule-import]"); button.disabled = this.busy; button.textContent = this.busy ? "Staging…" : `Stage ${this.rows.length} practices`;
  }
}
