import { adminTemplate } from "./templates/admin-template.js";
import { addDays, clearanceTone, filterPractices, PRACTICE_START_TIMES, resolveBroadcastTeamIds, seasonWeeks, startOfWeek, weekDates } from "../admin/admin-domain.js";
import { BUDGET_CATEGORIES, budgetCategorySummary, budgetSummary, compareScenarioBudgets, defaultRegistrationPlan, divisionCostAllocation, registrationRevenueEstimate, registrationScenarioPresets, scenarioCostEstimate } from "../admin/budget-domain.js";
import { gearDistributionSummary, gearOrderSummary, gearPlan, normalizeGearPlayerCount, scaledGearBudget } from "../admin/gear-domain.js";
import { escapeHtml, formatDate, formatDateTime, formatTime, todayIso } from "../shared/format.js";
import { AdminScheduleImportView } from "./admin-schedule-import-view.js";

const empty = message => `<div class="empty-state">${escapeHtml(message)}</div>`;
const initials = name => String(name || "?").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const formValue = (form, name) => form.elements[name]?.value || "";
const currency = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
const unitCurrency = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

export class AdminView {
  constructor(root, vm, auth = null, modeController = null) {
    this.root = root; this.vm = vm; this.auth = auth; this.modeController = modeController; this.message = ""; this.error = ""; this.calendarWeekStart = startOfWeek(new Date()); this.gearPlayerCount = normalizeGearPlayerCount(vm.stats.playerCount || 1200);
    try { this.coachLayout = window.localStorage.getItem("fairOaksSoccer.adminCoachLayout") === "list" ? "list" : "cards"; }
    catch { this.coachLayout = "cards"; }
  }
  mount() {
    this.root.innerHTML = adminTemplate;
    this.root.addEventListener("click", event => this.#onClick(event));
    this.root.addEventListener("input", event => this.#onFilter(event));
    this.root.addEventListener("change", event => this.#onFilter(event));
    this.root.querySelector("#adminTeamForm").addEventListener("submit", event => this.#saveTeam(event));
    this.root.querySelector("#adminPlayerForm").addEventListener("submit", event => this.#savePlayer(event));
    this.root.querySelector("#adminPracticeForm").addEventListener("submit", event => this.#savePractice(event));
    this.root.querySelector("#adminCoachForm").addEventListener("submit", event => this.#saveCoach(event));
    this.root.querySelector("#adminFieldForm").addEventListener("submit", event => this.#saveField(event));
    this.root.querySelector("#adminBudgetForm").addEventListener("submit", event => this.#saveBudgetItem(event));
    this.root.querySelector("#adminGearForm").addEventListener("submit", event => this.#saveGearItem(event));
    this.root.querySelector("#adminGearDistributionForm").addEventListener("submit", event => this.#saveGearDistribution(event));
    this.root.querySelector("#adminRegistrationForm").addEventListener("submit", event => this.#saveRegistrationPlan(event));
    this.root.querySelector("#adminScenarioForm").addEventListener("submit", event => this.#saveScenario(event));
    this.root.querySelector("#adminBroadcastForm").addEventListener("submit", event => this.#sendBroadcast(event));
    this.vm.addEventListener("change", () => this.render());
    this.scheduleImport = new AdminScheduleImportView(this.root, this.vm); this.scheduleImport.mount();
    this.render();
  }
  #onFilter(event) {
    if (event.target.id === "adminWorkspaceMode") { this.modeController?.change(event.target.value); return; }
    if (["adminScenarioSelect", "adminBudgetScenarioSelect"].includes(event.target.id)) { this.vm.selectScenario(event.target.value); return; }
    if (event.target.closest("#adminRegistrationForm")) this.#renderRegistrationEstimate();
    if (event.target.id === "adminGearPlayerCount") { this.gearPlayerCount = normalizeGearPlayerCount(event.target.value); this.#renderGear(); return; }
    if (["adminTeamSearch", "adminDivisionFilter", "adminLocationFilter", "adminStartTimeFilter", "adminScheduleDivisionFilter", "adminConflictOnly", "adminHeatmapDivision", "adminBudgetTypeFilter", "adminBudgetCategoryFilter", "adminGearVendorFilter", "adminGearOrderStatusFilter", "adminGearDivisionFilter", "adminGearDistributionStatus", "adminCoachSearch", "adminClearanceFilter"].includes(event.target.id)) this.render();
    if (event.target.closest("#adminBroadcastForm")) this.#renderAudiencePreview();
  }
  async #onClick(event) {
    const route = event.target.closest("[data-admin-route]")?.dataset.adminRoute;
    if (route) { this.vm.go(route); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (event.target.closest("[data-admin-close]")) { event.target.closest("dialog")?.close(); return; }
    const target = event.target.closest("[data-admin-action]"); if (!target) return;
    const { adminAction: action, id } = target.dataset;
    if (action === "sign-out") {
      if (this.vm.demo) window.location.href = window.location.pathname; else await this.auth?.signOut();
    }
    if (action === "reset-demo" && confirm("Reset all demo changes and restore the sample club data?")) { this.vm.resetDemo(); this.#feedback("Demo data restored."); }
    if (action === "select-team") this.vm.selectTeam(id);
    if (action === "open-team") this.vm.selectTeam(id, true);
    if (action === "new-team") this.#openTeam();
    if (action === "edit-team") this.#openTeam(this.vm.team(id));
    if (action === "new-player") this.#openPlayer(null, id || this.vm.selectedTeamId);
    if (action === "edit-player") this.#openPlayer(this.vm.state.players.find(item => item.id === id));
    if (action === "new-practice") this.#openPractice(null, { date: target.dataset.date, fieldId: target.dataset.fieldId });
    if (action === "edit-practice") this.#openPractice(this.vm.practices.find(item => item.id === id));
    if (action === "delete-practice" && confirm("Delete this practice booking?")) await this.#submit(target, () => this.vm.deletePractice(id), "Practice deleted.");
    if (action === "new-coach") this.#openCoach();
    if (action === "edit-coach") this.#openCoach(this.vm.state.coaches.find(item => item.id === id));
    if (action === "coach-layout") {
      this.coachLayout = target.dataset.layout === "list" ? "list" : "cards";
      try { window.localStorage.setItem("fairOaksSoccer.adminCoachLayout", this.coachLayout); } catch { /* Preference remains available for this session. */ }
      this.render();
    }
    if (action === "new-field") this.#openField();
    if (action === "edit-field") this.#openField(this.vm.field(id));
    if (action === "new-budget-item") this.#openBudgetItem();
    if (action === "edit-budget-item") this.#openBudgetItem(this.vm.state.budgetItems.find(item => item.id === id));
    if (action === "new-gear-item") this.#openGearItem();
    if (action === "edit-gear-item") this.#openGearItem(this.vm.gearItem(id));
    if (action === "edit-gear-distribution") this.#openGearDistribution(this.vm.gearDistributionForTeam(id));
    if (action === "registration-preset") {
      const form = this.root.querySelector("#adminRegistrationForm"); const current = Object.fromEntries(["baseFee", "clubAddOn", "lateFeeOne", "lateFeeTwo"].map(name => [name, formValue(form, name)]));
      const preset = registrationScenarioPresets(current, this.vm.stats.playerCount, this.vm.stats.teamCount).find(item => item.id === target.dataset.preset);
      Object.entries(preset?.settings || {}).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value; }); this.#renderRegistrationEstimate();
    }
    if (action === "select-budget-scenario") this.vm.selectScenario(id);
    if (action === "select-scenario") { this.vm.selectScenario(id); this.vm.go("admin-practices"); }
    if (action === "explain-scenarios") this.root.querySelector("#adminScenarioGuideDialog").showModal();
    if (action === "new-scenario") this.#openScenario();
    if (action === "duplicate-scenario") await this.#submit(target, () => this.vm.duplicateScenario(), "Safe working copy created.");
    if (action === "generate-plan") {
      let result;
      await this.#submit(target, async () => { result = await this.vm.generateScenarioPlan(); }, "Recommended placements added to this scenario.");
      if (result && !result.created.length) this.#feedback(result.unresolved.length ? `${result.unresolved.length} teams still need a viable placement.` : "Every team already has a complete practice pattern.");
    }
    if (action === "publish-scenario") {
      const scenario = this.vm.selectedScenario;
      if (scenario?.status === "published") { this.#feedback("This is already the published family schedule."); return; }
      if (scenario && confirm(`Publish “${scenario.name}” as the family-facing season plan?\n\nThis replaces the current published schedule. The previous plan remains available as a scenario.`)) await this.#submit(target, () => this.vm.publishSelectedScenario(), `${scenario.name} is now the published season plan.`);
    }
    if (action === "previous-week") { this.calendarWeekStart = addDays(this.calendarWeekStart, -7); this.render(); }
    if (action === "next-week") { this.calendarWeekStart = addDays(this.calendarWeekStart, 7); this.render(); }
    if (action === "current-week") { this.calendarWeekStart = startOfWeek(new Date()); this.render(); }
    if (action === "clear-schedule-filters") {
      ["adminLocationFilter", "adminStartTimeFilter", "adminScheduleDivisionFilter"].forEach(selector => { this.root.querySelector(`#${selector}`).value = "all"; });
      this.root.querySelector("#adminConflictOnly").checked = false; this.render();
    }
  }
  #feedback(message = "", error = "") { this.message = message; this.error = error; this.#renderFeedback(); }
  #renderFeedback() {
    this.root.querySelector("#adminFeedback").innerHTML = this.error ? `<div class="admin-toast error">${escapeHtml(this.error)}</div>` : this.message ? `<div class="admin-toast success">${escapeHtml(this.message)}</div>` : "";
  }
  async #submit(button, operation, success, dialog = null) {
    if (button) button.disabled = true; this.#feedback();
    try { await operation(); dialog?.close(); this.#feedback(success); }
    catch (error) { this.#feedback("", error.message); }
    finally { if (button) button.disabled = false; }
  }
  #populateSelect(select, items, current = "", emptyLabel = "Choose…") {
    select.innerHTML = `<option value="">${emptyLabel}</option>${items.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}`;
  }
  #openTeam(team = null) {
    const dialog = this.root.querySelector("#adminTeamDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminTeamDialogTitle").textContent = team ? "Edit team" : "Add team";
    ["id", "name", "division", "season", "status", "practicePattern"].forEach(name => { if (form.elements[name]) form.elements[name].value = team?.[name] || (name === "season" ? this.vm.state.club.season : name === "status" ? "Active" : ""); });
    this.#populateSelect(form.elements.defaultFieldId, this.vm.state.fields, team?.defaultFieldId, "No default field"); dialog.showModal();
  }
  #openPlayer(player = null, teamId = "") {
    const dialog = this.root.querySelector("#adminPlayerDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminPlayerDialogTitle").textContent = player ? "Edit player" : "Add player";
    ["id", "firstName", "lastName", "dateOfBirth", "familyEmail", "familyPhone"].forEach(name => { form.elements[name].value = player?.[name] || ""; });
    form.elements.teamId.value = player?.teamId || teamId; form.elements.active.value = String(player?.active !== false); dialog.showModal();
  }
  #openPractice(practice = null, defaults = {}) {
    if (this.vm.selectedScenario?.status === "published") { this.#feedback("The published season is locked. Duplicate it before changing a booking."); return; }
    const dialog = this.root.querySelector("#adminPracticeDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminPracticeDialogTitle").textContent = practice ? "Edit practice" : "Schedule practice";
    form.elements.id.value = practice?.id || "";
    this.#populateSelect(form.elements.teamId, this.vm.teams, practice?.teamId || this.vm.selectedTeamId, "Choose a team");
    this.#populateSelect(form.elements.fieldId, this.vm.state.fields, practice?.fieldId || defaults.fieldId || this.vm.selectedTeam?.defaultFieldId, "Choose a field");
    form.elements.date.value = practice?.date || defaults.date || this.calendarWeekStart || todayIso(); form.elements.time.value = practice?.time || "17:00";
    form.elements.durationMinutes.value = String(practice?.durationMinutes || 60); form.elements.status.value = practice?.status || "Scheduled"; form.elements.notes.value = practice?.notes || ""; dialog.showModal();
  }
  #openCoach(coach = null) {
    const dialog = this.root.querySelector("#adminCoachDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminCoachDialogTitle").textContent = coach ? "Edit coach" : "Add coach";
    ["id", "name", "email", "phone", "clearanceStatus", "clearanceExpires"].forEach(name => { form.elements[name].value = coach?.[name] || (name === "clearanceStatus" ? "Pending" : ""); });
    const assigned = new Set((coach?.assignments || []).map(item => item.teamId));
    this.root.querySelector("#adminCoachTeams").innerHTML = this.vm.teams.map(team => `<label><input type="checkbox" name="teamIds" value="${escapeHtml(team.id)}" ${assigned.has(team.id) ? "checked" : ""}><span>${escapeHtml(team.name)}</span></label>`).join("");
    const headCoachTeamId = coach?.assignments?.find(item => item.role === "headCoach")?.teamId || "";
    this.#populateSelect(form.elements.headCoachTeamId, this.vm.teams, headCoachTeamId, "No head coach assignment"); dialog.showModal();
  }
  #openField(field = null) {
    const dialog = this.root.querySelector("#adminFieldDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminFieldDialogTitle").textContent = field ? "Edit field" : "Add field";
    ["id", "name", "park", "address", "status", "notes"].forEach(name => { form.elements[name].value = field?.[name] || (name === "status" ? "Open" : ""); });
    form.elements.lights.checked = Boolean(field?.lights); dialog.showModal();
  }
  #openBudgetItem(item = null) {
    const dialog = this.root.querySelector("#adminBudgetDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminBudgetDialogTitle").textContent = item ? "Edit budget line" : "Add budget line";
    form.elements.id.value = item?.id || ""; form.elements.type.value = item?.type || "Expense";
    form.elements.category.innerHTML = BUDGET_CATEGORIES.map(category => `<option ${category === item?.category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("");
    form.elements.name.value = item?.name || ""; form.elements.planned.value = item?.planned ?? 0; form.elements.committed.value = item?.committed ?? 0; form.elements.actual.value = item?.actual ?? 0; form.elements.owner.value = item?.owner || ""; form.elements.notes.value = item?.notes || ""; dialog.showModal();
  }
  #openGearItem(item = null) {
    const dialog = this.root.querySelector("#adminGearDialog"); const form = dialog.querySelector("form"); form.reset();
    this.root.querySelector("#adminGearDialogTitle").textContent = item ? "Edit gear record" : "Add gear record";
    const defaults = { vendor: "Amazon", status: "Receiving", basis: "team", rate: 1, packSize: 1, unitCost: 0, orderedQty: 0, receivedQty: 0, distributedQty: 0, actualSpend: 0 };
    ["id", "name", "category", "vendor", "status", "sourceUrl", "basis", "rate", "packSize", "unitCost", "orderedQty", "receivedQty", "distributedQty", "actualSpend", "notes"].forEach(name => { form.elements[name].value = item?.[name] ?? defaults[name] ?? ""; }); dialog.showModal();
  }
  #openGearDistribution(distribution) {
    const dialog = this.root.querySelector("#adminGearDistributionDialog"); const form = dialog.querySelector("form"); form.reset(); const team = this.vm.team(distribution.teamId);
    this.root.querySelector("#adminGearDistributionTitle").textContent = `Update ${team?.name || "team"} kit`;
    form.elements.teamId.value = distribution.teamId; form.elements.status.value = distribution.status; form.elements.balls.value = distribution.balls || 0; form.elements.pickedUpBy.value = distribution.pickedUpBy || ""; form.elements.notes.value = distribution.notes || "";
    ["firstAid", "pump", "ballBag", "goals"].forEach(name => { form.elements[name].checked = Boolean(distribution[name]); }); dialog.showModal();
  }
  #openScenario() {
    const dialog = this.root.querySelector("#adminScenarioDialog"); const form = dialog.querySelector("form"); const base = this.vm.selectedScenario; form.reset();
    form.elements.name.value = base?.kind === "Weather contingency" ? "Updated weather contingency" : "Season planning draft";
    form.elements.seasonStart.value = base?.seasonStart || todayIso(); form.elements.seasonEnd.value = base?.seasonEnd || addDays(todayIso(), 83);
    form.elements.baseScenarioId.innerHTML = this.vm.scenarios.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === base?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    this.root.querySelector("#adminScenarioClosedFields").innerHTML = this.vm.state.fields.map(field => `<label><input type="checkbox" name="closedFieldIds" value="${escapeHtml(field.id)}"><span>${escapeHtml(field.name)}</span></label>`).join("");
    dialog.showModal();
  }
  async #saveTeam(event) {
    event.preventDefault(); const form = event.currentTarget;
    await this.#submit(event.submitter, () => this.vm.saveTeam({ id: formValue(form, "id"), name: formValue(form, "name"), division: formValue(form, "division"), season: formValue(form, "season"), status: formValue(form, "status"), defaultFieldId: formValue(form, "defaultFieldId"), practicePattern: formValue(form, "practicePattern") }), "Team saved.", form.closest("dialog"));
  }
  async #savePlayer(event) {
    event.preventDefault(); const form = event.currentTarget;
    await this.#submit(event.submitter, () => this.vm.savePlayer({ id: formValue(form, "id"), teamId: formValue(form, "teamId"), firstName: formValue(form, "firstName"), lastName: formValue(form, "lastName"), dateOfBirth: formValue(form, "dateOfBirth"), familyEmail: formValue(form, "familyEmail"), familyPhone: formValue(form, "familyPhone"), active: formValue(form, "active") === "true" }), "Roster updated.", form.closest("dialog"));
  }
  async #savePractice(event) {
    event.preventDefault(); const form = event.currentTarget;
    await this.#submit(event.submitter, () => this.vm.savePractice({ id: formValue(form, "id"), teamId: formValue(form, "teamId"), fieldId: formValue(form, "fieldId"), date: formValue(form, "date"), time: formValue(form, "time"), durationMinutes: formValue(form, "durationMinutes"), status: formValue(form, "status"), notes: formValue(form, "notes") }), "Practice scheduled.", form.closest("dialog"));
  }
  async #saveCoach(event) {
    event.preventDefault(); const form = event.currentTarget;
    const teamIds = [...form.querySelectorAll("input[name=teamIds]:checked")].map(input => input.value);
    await this.#submit(event.submitter, () => this.vm.saveCoach({ id: formValue(form, "id"), name: formValue(form, "name"), email: formValue(form, "email"), phone: formValue(form, "phone"), clearanceStatus: formValue(form, "clearanceStatus"), clearanceExpires: formValue(form, "clearanceExpires"), headCoachTeamId: formValue(form, "headCoachTeamId"), teamIds }), "Coach and team assignments saved.", form.closest("dialog"));
  }
  async #saveField(event) {
    event.preventDefault(); const form = event.currentTarget;
    await this.#submit(event.submitter, () => this.vm.saveField({ id: formValue(form, "id"), name: formValue(form, "name"), park: formValue(form, "park"), address: formValue(form, "address"), status: formValue(form, "status"), lights: form.elements.lights.checked, notes: formValue(form, "notes") }), "Field saved.", form.closest("dialog"));
  }
  async #saveBudgetItem(event) {
    event.preventDefault(); const form = event.currentTarget;
    await this.#submit(event.submitter, () => this.vm.saveBudgetItem({ id: formValue(form, "id"), type: formValue(form, "type"), category: formValue(form, "category"), name: formValue(form, "name"), planned: formValue(form, "planned"), committed: formValue(form, "committed"), actual: formValue(form, "actual"), owner: formValue(form, "owner"), notes: formValue(form, "notes") }), "Budget line saved.", form.closest("dialog"));
  }
  async #saveGearItem(event) {
    event.preventDefault(); const form = event.currentTarget;
    const fields = Object.fromEntries(["id", "name", "category", "vendor", "status", "sourceUrl", "basis", "rate", "packSize", "unitCost", "orderedQty", "receivedQty", "distributedQty", "actualSpend", "notes"].map(name => [name, formValue(form, name)]));
    await this.#submit(event.submitter, () => this.vm.saveGearItem(fields), "Gear purchase record saved.", form.closest("dialog"));
  }
  async #saveGearDistribution(event) {
    event.preventDefault(); const form = event.currentTarget;
    const fields = { teamId: formValue(form, "teamId"), status: formValue(form, "status"), balls: formValue(form, "balls"), firstAid: form.elements.firstAid.checked, pump: form.elements.pump.checked, ballBag: form.elements.ballBag.checked, goals: form.elements.goals.checked, pickedUpBy: formValue(form, "pickedUpBy"), notes: formValue(form, "notes") };
    await this.#submit(event.submitter, () => this.vm.saveGearDistribution(fields), "Team handoff updated.", form.closest("dialog"));
  }
  async #saveRegistrationPlan(event) {
    event.preventDefault(); const form = event.currentTarget;
    const fields = Object.fromEntries(["baseFee", "clubAddOn", "lateFeeOne", "lateFeeTwo", "onTimePlayers", "lateOnePlayers", "lateTwoPlayers", "coachWaivers", "coachPolicy"].map(name => [name, formValue(form, name)]));
    await this.#submit(event.submitter, () => this.vm.saveRegistrationPlan(fields), "Registration forecast applied to the season budget.");
  }
  async #saveScenario(event) {
    event.preventDefault(); const form = event.currentTarget; const closedFieldIds = [...form.querySelectorAll("input[name=closedFieldIds]:checked")].map(input => input.value);
    await this.#submit(event.submitter, () => this.vm.createScenario({ name: formValue(form, "name"), description: formValue(form, "description"), kind: formValue(form, "kind"), seasonStart: formValue(form, "seasonStart"), seasonEnd: formValue(form, "seasonEnd"), baseScenarioId: formValue(form, "baseScenarioId"), closedFieldIds }), "Planning scenario created.", form.closest("dialog"));
  }
  async #sendBroadcast(event) {
    event.preventDefault(); const form = event.currentTarget; const selectedTeamIds = [...form.querySelectorAll("input[name=broadcastTeamIds]:checked")].map(input => input.value);
    const args = { scope: formValue(form, "scope"), division: formValue(form, "division"), selectedTeamIds, title: formValue(form, "title"), body: formValue(form, "body") };
    const ids = resolveBroadcastTeamIds(args, this.vm.state.teams); const names = ids.map(id => this.vm.team(id)?.name).filter(Boolean);
    if (!confirm(`Send “${args.title.trim() || "this update"}” to ${names.length} team${names.length === 1 ? "" : "s"}?\n\nFamilies and coaches in those team hubs will be able to read it.`)) return;
    await this.#submit(event.submitter, async () => { const result = await this.vm.sendBroadcast(args); form.reset(); return result; }, `Sent to ${names.length} team${names.length === 1 ? "" : "s"}.`);
  }
  render() {
    const title = this.vm.navigation.find(([id]) => id === this.vm.route)?.[1] || "Overview";
    this.root.querySelector("#adminPageTitle").textContent = title;
    this.root.querySelector("#adminIdentity").textContent = this.vm.demo ? "Admin demo" : this.vm.identity?.user?.email || "Club admin";
    const modeControl = this.root.querySelector(".admin-workspace-mode"); modeControl.classList.toggle("hidden", !this.modeController);
    if (this.modeController) this.root.querySelector("#adminWorkspaceMode").innerHTML = this.modeController.modes.map(item => `<option value="${item.id}" ${item.id === this.modeController.current ? "selected" : ""}>${item.label}</option>`).join("");
    this.root.querySelector("#adminDemoBanner").classList.toggle("hidden", !this.vm.demo);
    this.root.querySelector("#adminNav").innerHTML = this.vm.navigation.map(([id, label], index) => `<button data-admin-route="${id}" class="${this.vm.route === id ? "active" : ""}"><span aria-hidden="true">${["⌂", "◫", "▦", "$", "▣", "♟", "✉"][index]}</span>${label}</button>`).join("");
    this.root.querySelectorAll(".admin-view").forEach(view => view.classList.toggle("active", view.id === this.vm.route));
    this.#renderFeedback(); this.#renderOverview(); this.#renderTeams(); this.#renderPractices(); this.#renderBudget(); this.#renderGear(); this.#renderCoaches(); this.#renderMessages();
    this.scheduleImport?.render();
  }
  #renderOverview() {
    const stats = this.vm.stats; const published = this.vm.scenarios.find(item => item.status === "published") || this.vm.selectedScenario; const metrics = this.vm.metricsFor(published);
    this.root.querySelector("#adminStats").innerHTML = [[stats.teamCount, "Teams planned", "admin-teams"], [metrics.assignedTeams, "Teams placed", "admin-practices"], [metrics.activeFieldCount, "Fields in service", "admin-practices"], [stats.unstaffed.length, "Teams need coaches", "admin-coaches"]].map(([value, label, route], index) => `<button class="admin-stat-card ${index === 3 && value ? "alert" : ""}" data-admin-route="${route}"><strong>${value}</strong><span>${label}</span><small>Review ${label.toLowerCase()} →</small></button>`).join("");
    const ring = this.root.querySelector("#adminReadinessRing"); ring.style.setProperty("--readiness", `${metrics.readiness * 3.6}deg`);
    this.root.querySelector("#adminReadinessScore").textContent = `${metrics.readiness}%`;
    this.root.querySelector("#adminReadinessTitle").textContent = metrics.readiness >= 95 ? "The season is operationally ready" : "The season still has material gaps";
    this.root.querySelector("#adminReadinessCopy").textContent = `${published?.name || "Published plan"} covers ${metrics.assignedTeams} of ${metrics.totalTeams} teams across ${metrics.activeFieldCount} usable fields, with ${metrics.conflictCount} booking conflict${metrics.conflictCount === 1 ? "" : "s"}.`;
    const decisions = [
      ...(metrics.conflictCount ? [{ title: `${metrics.conflictCount} field conflict${metrics.conflictCount === 1 ? "" : "s"}`, detail: "Resolve before the next publish.", route: "admin-practices", tone: "attention" }] : []),
      ...(metrics.unassignedTeamIds.length ? [{ title: `${metrics.unassignedTeamIds.length} teams lack two placements`, detail: "Use the smart allocator in a working scenario.", route: "admin-practices", tone: "attention" }] : []),
      ...stats.unstaffed.slice(0, 2).map(team => ({ title: `${team.name} needs a coach`, detail: `${team.division} · roster already forming`, route: "admin-coaches", tone: "attention" })),
      ...stats.uncleared.slice(0, 2).map(coach => ({ title: `${coach.name} · ${coach.clearanceStatus}`, detail: "Clearance follow-up before kickoff.", route: "admin-coaches", tone: clearanceTone(coach.clearanceStatus) })),
      ...this.vm.state.fields.filter(field => field.status !== "Open").slice(0, 2).map(field => ({ title: `${field.name} · ${field.status}`, detail: field.notes || "Confirm field availability.", route: "admin-practices", tone: "expiring" })),
    ].slice(0, 6);
    this.root.querySelector("#adminDecisionList").innerHTML = decisions.map(item => `<button class="admin-attention-row" data-admin-route="${item.route}"><span class="admin-status-dot ${item.tone}"></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><b>→</b></button>`).join("") || empty("No material decisions are blocking the season.");
    this.root.querySelector("#adminScenarioCompare").innerHTML = this.vm.scenarios.map(scenario => {
      const item = this.vm.metricsFor(scenario); const selected = scenario.id === this.vm.selectedScenarioId;
      return `<button class="admin-scenario-card ${selected ? "active" : ""}" data-admin-action="select-scenario" data-id="${scenario.id}"><span><i class="scenario-dot ${escapeHtml(scenario.status)}"></i>${escapeHtml(scenario.status)}</span><strong>${escapeHtml(scenario.name)}</strong><small>${item.assignedTeams}/${item.totalTeams} teams · ${item.conflictCount} conflicts</small><div><b>${item.readiness}%</b><span style="--score:${item.readiness}%"><i></i></span></div></button>`;
    }).join("") || empty("Create a planning scenario to compare the season.");
  }
  #renderTeams() {
    const divisions = [...new Set(this.vm.teams.map(team => team.division))]; const divisionSelect = this.root.querySelector("#adminDivisionFilter"); const current = divisionSelect.value || "all";
    divisionSelect.innerHTML = `<option value="all">All divisions</option>${divisions.map(value => `<option ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
    const term = this.root.querySelector("#adminTeamSearch").value.trim().toLowerCase(); const division = divisionSelect.value;
    const teams = this.vm.teams.filter(team => division === "all" || team.division === division).filter(team => {
      const coaches = this.vm.coachesForTeam(team.id).map(coach => coach.name).join(" "); return `${team.name} ${team.division} ${coaches}`.toLowerCase().includes(term);
    });
    this.root.querySelector("#adminTeamList").innerHTML = teams.map(team => {
      const players = this.vm.playersForTeam(team.id).filter(player => player.active !== false); const coaches = this.vm.coachesForTeam(team.id);
      return `<button class="admin-team-card ${team.id === this.vm.selectedTeamId ? "active" : ""}" data-admin-action="select-team" data-id="${team.id}"><span class="admin-team-crest">${escapeHtml(team.division)}</span><span><strong>${escapeHtml(team.name)}</strong><small>${players.length} players · ${coaches.length ? coaches.map(coach => coach.name).join(", ") : "Coach needed"}</small></span><span class="badge ${team.status === "Active" ? "blue" : "gold"}">${escapeHtml(team.status)}</span></button>`;
    }).join("") || empty("No teams match this filter.");
    if (!teams.some(team => team.id === this.vm.selectedTeamId) && teams[0]) this.vm.selectedTeamId = teams[0].id;
    const team = this.vm.selectedTeam; if (!team) { this.root.querySelector("#adminTeamDetail").innerHTML = empty("Add a team to begin."); return; }
    const roster = this.vm.playersForTeam(team.id); const coaches = this.vm.coachesForTeam(team.id); const nextPractice = this.vm.practicesForTeam(team.id).find(item => item.date >= todayIso());
    this.root.querySelector("#adminTeamDetail").innerHTML = `<div class="admin-team-detail-head"><div><span class="badge">${escapeHtml(team.division)}</span><h2>${escapeHtml(team.name)}</h2><p>${escapeHtml(team.season || this.vm.state.club.season)} · ${escapeHtml(team.status)}</p></div><button class="button" data-admin-action="edit-team" data-id="${team.id}">Edit team</button></div><div class="admin-team-summary"><div><span>Coaching staff</span><strong>${coaches.length ? coaches.map(coach => coach.name).join(", ") : "Not assigned"}</strong></div><div><span>Default field</span><strong>${escapeHtml(this.vm.field(team.defaultFieldId)?.name || "Not assigned")}</strong></div><div><span>Practice plan</span><strong>${escapeHtml(team.practicePattern || "Not set")}</strong></div><div><span>Next practice</span><strong>${nextPractice ? `${formatDate(nextPractice.date)} · ${formatTime(nextPractice.time)}` : "Not scheduled"}</strong></div></div><div class="admin-roster-head"><div><h3>Roster</h3><p>${roster.filter(player => player.active !== false).length} active players</p></div><button class="button primary small" data-admin-action="new-player" data-id="${team.id}">Add player</button></div><div class="table-wrap"><table><thead><tr><th>Player</th><th>Parent contact</th><th>Status</th><th></th></tr></thead><tbody>${roster.map(player => `<tr><td><strong>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</strong><small>${player.dateOfBirth ? `DOB ${formatDate(player.dateOfBirth)}` : "Birthdate not entered"}</small></td><td>${escapeHtml(player.familyEmail || "No email")}<small>${escapeHtml(player.familyPhone || "")}</small></td><td><span class="badge ${player.active === false ? "gray" : "blue"}">${player.active === false ? "Inactive" : "Active"}</span></td><td><button class="button small" data-admin-action="edit-player" data-id="${player.id}">Edit</button></td></tr>`).join("") || `<tr><td colspan="4">${empty("No players on this roster yet.")}</td></tr>`}</tbody></table></div>`;
  }
  #renderPractices() {
    const scenario = this.vm.selectedScenario; if (!scenario) return; const metrics = this.vm.metricsFor(scenario);
    const divisions = [...new Set(this.vm.teams.map(team => team.division))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const scenarioSelect = this.root.querySelector("#adminScenarioSelect");
    scenarioSelect.innerHTML = this.vm.scenarios.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === scenario.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.status)}</option>`).join("");
    const status = this.root.querySelector("#adminScenarioStatus"); status.textContent = scenario.status; status.className = `admin-scenario-status ${scenario.status}`;
    this.root.querySelector("#adminScenarioName").textContent = scenario.name; this.root.querySelector("#adminScenarioDescription").textContent = scenario.description || "No planning note.";
    this.root.querySelector("#adminScenarioMetrics").innerHTML = [[`${metrics.assignedTeams}/${metrics.totalTeams}`, "teams placed"], [`${metrics.utilization}%`, "slot use"], [metrics.conflictCount, "conflicts"], [metrics.latePractices, "late starts"]].map(([value, label]) => `<span><strong>${value}</strong><small>${label}</small></span>`).join("");
    const weeks = seasonWeeks(scenario.seasonStart, scenario.seasonEnd, scenario.blackoutDates); const recurring = this.vm.practices.filter(item => item.status !== "Canceled").length;
    this.root.querySelector("#adminSeasonRange").textContent = `${formatDate(scenario.seasonStart)} – ${formatDate(scenario.seasonEnd)}`; this.root.querySelector("#adminSeasonWeekCount").textContent = `${weeks.length} weeks`;
    this.root.querySelector("#adminSeasonCalendar").innerHTML = weeks.map(week => {
      const blackoutCount = week.blackoutDates.length; const tone = blackoutCount ? "blackout" : week.index === 1 ? "anchor" : "ready";
      return `<article class="admin-season-week ${tone}"><header><span>Week ${week.index}</span><strong>${formatDate(week.start)}</strong></header><div><b>${blackoutCount ? `${blackoutCount} blackout` : `${recurring} recurring`}</b><small>${blackoutCount ? "Review displaced sessions" : "Pattern ready"}</small></div><i></i></article>`;
    }).join("");
    const heatmapDivision = this.root.querySelector("#adminHeatmapDivision"); const selectedHeatmapDivision = heatmapDivision.value || "all";
    heatmapDivision.innerHTML = `<option value="all">All divisions</option>${divisions.map(division => `<option ${division === selectedHeatmapDivision ? "selected" : ""}>${escapeHtml(division)}</option>`).join("")}`;
    const heatmapPractices = filterPractices(this.vm.practices.filter(item => item.status !== "Canceled"), { division: selectedHeatmapDivision }, this.vm.teams); const fieldLoads = this.vm.state.fields.map(field => ({ field, loads: PRACTICE_START_TIMES.map(time => heatmapPractices.filter(item => item.fieldId === field.id && item.time === time).length) }));
    const peak = Math.max(0, ...fieldLoads.flatMap(item => item.loads)); const openFields = this.vm.state.fields.filter(field => field.status === "Open" && !(scenario.closedFieldIds || []).includes(field.id)).length;
    this.root.querySelector("#adminHeatmapSummary").innerHTML = `<span><strong>${heatmapPractices.length}</strong><small>${selectedHeatmapDivision === "all" ? "recurring practices" : `${selectedHeatmapDivision} practices`}</small></span><span><strong>${openFields}/${this.vm.state.fields.length}</strong><small>usable fields</small></span><span><strong>${peak}/5</strong><small>busiest field-time</small></span>`;
    this.root.querySelector("#adminCapacityHeatmap").innerHTML = `<div class="admin-heatmap-head"><span>Field</span>${PRACTICE_START_TIMES.map(time => `<b>${formatTime(time).replace(" ", "")}</b>`).join("")}</div>${fieldLoads.map(({ field, loads }) => `<div class="admin-heatmap-row ${scenario.closedFieldIds?.includes(field.id) ? "closed" : ""}"><span title="${escapeHtml(field.name)}">${escapeHtml(field.name.replace(/ · .*/, ""))}</span>${loads.map(load => `<i class="heat-${Math.min(4, Math.ceil(load / 1.25))}" title="${load} of 5 weekday slots used"><b>${load}</b></i>`).join("")}</div>`).join("")}`;
    const unassigned = metrics.unassignedTeamIds.map(id => this.vm.team(id)).filter(Boolean); const draft = scenario.status !== "published";
    this.root.querySelector("#adminAllocatorSummary").innerHTML = unassigned.length ? `<div class="admin-allocator-callout"><strong>${unassigned.length} teams need placement</strong><span>The allocator will add two conflict-free weekly sessions where possible.</span></div>` : `<div class="admin-allocator-callout ready"><strong>Every team is placed</strong><span>This scenario has a complete recurring practice pattern.</span></div>`;
    this.root.querySelector("#adminAllocatorTeams").innerHTML = unassigned.slice(0, 12).map(team => `<span><b>${escapeHtml(team.division)}</b>${escapeHtml(team.name.replace(`${team.division} `, ""))}</span>`).join("") || `<span class="allocator-complete">100 teams · two weekly sessions</span>`;
    const allocatorButton = this.root.querySelector("#adminAllocatorButton"); allocatorButton.disabled = !draft || !unassigned.length; allocatorButton.textContent = draft ? (unassigned.length ? `Place ${unassigned.length} teams` : "Plan complete") : "Duplicate to model changes";
    this.root.querySelector("[data-admin-action=publish-scenario]").disabled = scenario.status === "published";
    const locationSelect = this.root.querySelector("#adminLocationFilter"); const timeSelect = this.root.querySelector("#adminStartTimeFilter"); const divisionSelect = this.root.querySelector("#adminScheduleDivisionFilter");
    const selectedLocation = locationSelect.value || "all"; const selectedTime = timeSelect.value || "all"; const selectedDivision = divisionSelect.value || "all";
    locationSelect.innerHTML = `<option value="all">All ${this.vm.state.fields.length} locations</option>${this.vm.state.fields.map(field => `<option value="${field.id}" ${field.id === selectedLocation ? "selected" : ""}>${escapeHtml(field.name)}</option>`).join("")}`;
    timeSelect.innerHTML = `<option value="all">All start times</option>${PRACTICE_START_TIMES.map(time => `<option value="${time}" ${time === selectedTime ? "selected" : ""}>${formatTime(time)}</option>`).join("")}`;
    divisionSelect.innerHTML = `<option value="all">All divisions</option>${divisions.map(division => `<option ${division === selectedDivision ? "selected" : ""}>${escapeHtml(division)}</option>`).join("")}`;
    const dates = weekDates(this.calendarWeekStart); const dateSet = new Set(dates); const conflictIds = this.vm.conflictIds;
    let practices = filterPractices(this.vm.practices, { fieldId: selectedLocation, startTime: selectedTime, division: selectedDivision }, this.vm.teams).filter(item => dateSet.has(item.date));
    if (this.root.querySelector("#adminConflictOnly").checked) practices = practices.filter(item => conflictIds.has(item.id));
    this.root.querySelector("#adminWeekLabel").textContent = `${formatDate(dates[0])} – ${formatDate(dates[6])}`;
    const weekConflicts = this.vm.conflicts.filter(pair => dateSet.has(pair[0].date));
    this.root.querySelector("#adminScheduleSummary").innerHTML = `<strong>${practices.length}</strong> visible practice${practices.length === 1 ? "" : "s"} · <b class="${weekConflicts.length ? "has-conflict" : ""}">${weekConflicts.length} conflict${weekConflicts.length === 1 ? "" : "s"}</b>`;
    const visibleFieldCount = selectedLocation === "all" ? this.vm.state.fields.filter(field => field.status !== "Closed").length : 1;
    const capacity = visibleFieldCount * 5 * (selectedTime === "all" ? PRACTICE_START_TIMES.length : 1);
    const occupied = new Set(practices.filter(item => item.status !== "Canceled").map(item => `${item.fieldId}|${item.date}|${item.time}`)).size;
    this.root.querySelector("#adminUtilizationSummary").innerHTML = `<strong>${capacity ? Math.round(occupied / capacity * 100) : 0}%</strong> filtered slot utilization`;
    const today = todayIso();
    this.root.querySelector("#adminCalendar").innerHTML = dates.map(date => {
      const dayPractices = practices.filter(item => item.date === date).sort((a, b) => `${a.time}${this.vm.team(a.teamId)?.division}`.localeCompare(`${b.time}${this.vm.team(b.teamId)?.division}`));
      const day = new Date(`${date}T12:00:00`); const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day); const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day);
      return `<section class="admin-calendar-day ${date === today ? "today" : ""}"><header><span>${weekday}</span><strong>${monthDay}</strong><small>${dayPractices.length} practice${dayPractices.length === 1 ? "" : "s"}</small></header><div>${dayPractices.map(item => {
        const team = this.vm.team(item.teamId); const field = this.vm.field(item.fieldId); const conflict = conflictIds.has(item.id);
        const tone = conflict ? "conflict" : item.status === "Canceled" ? "canceled" : item.status === "Weather watch" ? "watch" : "scheduled";
        return `<button class="admin-calendar-event ${tone}" data-admin-action="edit-practice" data-id="${item.id}" aria-label="Edit ${escapeHtml(team?.name || "team")} practice"><span><b>${formatTime(item.time)}</b><i>${escapeHtml(team?.division || "")}</i></span><strong>${escapeHtml(team?.name || "Team")}</strong><small>${escapeHtml(field?.name || item.location || "Location TBD")}</small><footer><span>${item.durationMinutes || 60} min</span>${conflict ? `<em>Conflict</em>` : item.status !== "Scheduled" ? `<em>${escapeHtml(item.status)}</em>` : ""}</footer></button>`;
      }).join("") || `<button class="admin-calendar-empty" data-admin-action="new-practice" data-date="${date}">+ Add practice</button>`}</div></section>`;
    }).join("");
    this.root.querySelector("#adminFieldDirectory").innerHTML = this.vm.state.fields.map(field => `<article><div><strong>${escapeHtml(field.name)}</strong><span>${escapeHtml(field.address || field.park)}</span></div><div><span class="badge ${field.status === "Open" ? "blue" : "gold"}">${escapeHtml(field.status)}</span>${field.lights ? `<span class="badge">Lights</span>` : ""}<button class="button small" data-admin-action="edit-field" data-id="${field.id}">Edit</button></div></article>`).join("") || empty("No fields have been added.");
  }
  #renderBudget() {
    const items = this.vm.budgetItems; const summary = budgetSummary(items); const positive = summary.projectedSurplus >= 0;
    const utilization = Math.min(100, summary.expenseUtilization); const expenseDelta = summary.plannedExpense - summary.forecastExpense;
    this.root.querySelector("#adminBudgetDetailSummary").textContent = `${currency(summary.plannedRevenue)} income plan · ${currency(summary.plannedExpense)} expense plan · ${currency(summary.projectedSurplus)} projected cushion`;
    this.root.querySelector("#adminBudgetHealth").innerHTML = `<div><p class="eyebrow">Projected season result</p><strong>${currency(summary.projectedSurplus)}</strong><span class="admin-budget-health-state ${positive ? "positive" : "negative"}">${positive ? "Operating cushion" : "Funding gap"}</span></div><div><span><b>${summary.expenseUtilization}%</b> of expense plan forecast</span><div class="admin-budget-progress"><i style="width:${utilization}%"></i></div><small>${currency(Math.abs(expenseDelta))} ${expenseDelta >= 0 ? "remains unallocated" : "over the expense plan"}</small></div>`;
    this.root.querySelector("#adminBudgetStats").innerHTML = [[summary.plannedRevenue, "Planned revenue"], [summary.plannedExpense, "Expense budget"], [summary.committedExpense, "Committed expense"], [summary.actualExpense, "Paid to date"]].map(([value, label]) => `<article class="admin-stat-card"><strong>${currency(value)}</strong><span>${label}</span><small>${value ? `${Math.round(value / Math.max(1, summary.plannedExpense) * 100)}% of expense plan` : "No amount recorded"}</small></article>`).join("");
    const activePlayerCount = this.vm.state.players.filter(player => player.active !== false).length; const registrationItem = items.find(item => item.id === "budget-registration-fees" || (item.type === "Revenue" && item.category === "Registration"));
    const registrationPlan = { ...defaultRegistrationPlan(activePlayerCount), ...(registrationItem?.registrationPlan || {}) }; const registrationForm = this.root.querySelector("#adminRegistrationForm");
    Object.entries(registrationPlan).forEach(([name, value]) => { if (registrationForm.elements[name]) registrationForm.elements[name].value = value; });
    this.root.querySelector("#adminRegistrationRoster").textContent = `${activePlayerCount} active players`; this.#renderRegistrationEstimate();
    const divisionCosts = divisionCostAllocation(items, this.vm.state.players, this.vm.state.teams); const divisionCounts = divisionCosts[0]?.playerCounts || { U6: 0, U8: 0 };
    this.root.querySelector("#adminDivisionCostCounts").innerHTML = `<span class="badge">U6 · ${divisionCounts.U6 || 0} players</span><span class="badge">U8 · ${divisionCounts.U8 || 0} players</span>`;
    this.root.querySelector("#adminDivisionCostBody").innerHTML = divisionCosts.map(item => `<tr><th>${escapeHtml(item.name)}</th><td>${currency(item.clubForecast)}</td><td>${currency(item.allocated.U6)}</td><td>${currency(item.allocated.U8)}</td><td>${currency(item.perPlayer)}</td></tr>`).join("");
    const divisionTotals = divisionCosts.reduce((total, item) => ({ club: total.club + item.clubForecast, u6: total.u6 + item.allocated.U6, u8: total.u8 + item.allocated.U8, perPlayer: total.perPlayer + item.perPlayer }), { club: 0, u6: 0, u8: 0, perPlayer: 0 });
    this.root.querySelector("#adminDivisionCostTotal").innerHTML = `<tr><th>Five-cost total</th><td>${currency(divisionTotals.club)}</td><td>${currency(divisionTotals.u6)}</td><td>${currency(divisionTotals.u8)}</td><td>${currency(divisionTotals.perPlayer)}</td></tr>`;
    const comparisons = compareScenarioBudgets(this.vm.scenarios, this.vm.state.fields, items).map(item => ({ ...item, metrics: this.vm.metricsFor(item.scenario) }));
    const publishedComparison = comparisons.find(item => item.scenario.status === "published") || comparisons[0]; const ready = comparisons.filter(item => !item.metrics.conflictCount && !item.metrics.unassignedTeamIds.length); const bestReady = [...ready].sort((a, b) => b.projectedSurplus - a.projectedSurplus)[0]; const lowestCost = [...comparisons].sort((a, b) => a.estimate.total - b.estimate.total)[0];
    const lowestCostIssues = (lowestCost?.metrics.unassignedTeamIds.length || 0) + (lowestCost?.metrics.conflictCount || 0);
    this.root.querySelector("#adminBudgetScenarioDecision").innerHTML = bestReady ? `<div class="admin-budget-decision"><span>Recommended</span><strong>${escapeHtml(bestReady.scenario.name)}</strong><p>All ${bestReady.metrics.totalTeams} teams are placed. This plan leaves ${currency(bestReady.projectedSurplus)} after the season${bestReady.scenario.id === publishedComparison?.scenario.id ? "—the same as the current plan." : `—${currency(Math.abs(bestReady.deltaFromPublished))} ${bestReady.deltaFromPublished >= 0 ? "more than" : "less than"} the current plan.`}</p></div>${lowestCost && lowestCost.scenario.id !== bestReady.scenario.id ? `<div class="admin-budget-decision caution"><span>Worth knowing</span><strong>${escapeHtml(lowestCost.scenario.name)} costs less</strong><p>Its scheduling cost is ${currency(lowestCost.estimate.total)}, but it still needs ${lowestCostIssues} schedule fix${lowestCostIssues === 1 ? "" : "es"}.</p></div>` : ""}` : `<div class="admin-budget-decision caution"><span>Not ready</span><strong>Every plan still needs work</strong><p>Resolve the remaining team placements or conflicts before choosing a season plan.</p></div>`;
    this.root.querySelector("#adminBudgetScenarioCompare").innerHTML = comparisons.map(item => {
      const selected = item.scenario.id === this.vm.selectedScenarioId; const delta = item.deltaFromPublished; const issueCount = item.metrics.conflictCount + item.metrics.unassignedTeamIds.length; const publishReady = issueCount === 0;
      return `<button class="admin-budget-scenario-card ${selected ? "active" : ""}" data-admin-action="select-budget-scenario" data-id="${item.scenario.id}"><header><span class="admin-budget-ready ${publishReady ? "ready" : "needs-work"}">${publishReady ? "Ready" : `Needs ${issueCount} fix${issueCount === 1 ? "" : "es"}`}</span><small>${item.scenario.status === "published" ? "Current plan" : "Planning option"}</small></header><h4>${escapeHtml(item.scenario.name)}</h4><div class="admin-budget-scenario-surplus"><span>Money left after season</span><strong>${currency(item.projectedSurplus)}</strong><small class="${delta >= 0 ? "positive" : "negative"}">${item.scenario.id === publishedComparison?.scenario.id ? "Current plan" : `${delta >= 0 ? "+" : "−"}${currency(Math.abs(delta))} vs. current plan`}</small></div><div class="admin-budget-simple-facts"><span><small>Scheduling cost</small><b>${currency(item.estimate.total)}</b></span><span><small>Teams placed</small><b>${item.metrics.assignedTeams}/${item.metrics.totalTeams}</b></span></div><footer>${selected ? "Selected — cost explained below" : "Choose this plan →"}</footer></button>`;
    }).join("") || empty("Create a scheduling scenario to compare financial impact.");
    const categories = budgetCategorySummary(items); const maxPlan = Math.max(1, ...categories.map(item => item.planned));
    this.root.querySelector("#adminBudgetCategories").innerHTML = categories.map(item => {
      const width = Math.min(100, item.forecast / maxPlan * 100); const planMark = Math.min(100, item.planned / maxPlan * 100); const good = item.variance >= 0;
      return `<article class="admin-budget-category"><div><span class="budget-type ${item.type.toLowerCase()}">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.category)}</strong><small>${currency(item.forecast)} forecast of ${currency(item.planned)}</small></div><div class="admin-budget-bar"><i style="width:${width}%"></i><b style="left:${planMark}%"></b></div><span class="budget-variance ${good ? "positive" : "negative"}">${good ? "+" : "−"}${currency(Math.abs(item.variance))}</span></article>`;
    }).join("") || empty("Add a budget line to begin the season plan.");
    const scenario = this.vm.selectedScenario; const scenarioSelect = this.root.querySelector("#adminBudgetScenarioSelect");
    scenarioSelect.innerHTML = this.vm.scenarios.map(item => `<option value="${item.id}" ${item.id === scenario?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    const estimate = scenarioCostEstimate(scenario, this.vm.state.fields); const facilityPlan = items.filter(item => item.type === "Expense" && item.category === "Fields & facilities").reduce((sum, item) => sum + Number(item.planned || 0), 0); const scenarioVariance = facilityPlan - estimate.total;
    this.root.querySelector("#adminScenarioCostSummary").innerHTML = `<div class="admin-scenario-cost-total"><span>Estimated scheduling cost</span><strong>${currency(estimate.total)}</strong><small class="${scenarioVariance >= 0 ? "positive" : "negative"}">${scenarioVariance >= 0 ? `${currency(scenarioVariance)} under` : `${currency(Math.abs(scenarioVariance))} over`} the fields and facilities budget</small></div><dl><div><dt>Fields we rent</dt><dd>${currency(estimate.permitCost)}</dd><small>${estimate.activeFieldCount} fields used by this plan</small></div><div><dt>Evening lighting</dt><dd>${currency(estimate.lightingCost)}</dd><small>${estimate.latePatterns} late practice patterns across ${estimate.weekCount} weeks</small></div><div><dt>Backup field reserve</dt><dd>${currency(estimate.contingencyCost)}</dd><small>Extra capacity for ${scenario?.closedFieldIds?.length || 0} unavailable fields</small></div></dl><p>This is a planning estimate. Open the full club budget below to see actual invoices and every budget line.</p>`;
    const typeFilter = this.root.querySelector("#adminBudgetTypeFilter"); const categoryFilter = this.root.querySelector("#adminBudgetCategoryFilter"); const selectedCategory = categoryFilter.value || "all";
    categoryFilter.innerHTML = `<option value="all">All categories</option>${[...new Set(items.map(item => item.category))].sort().map(category => `<option ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}`;
    const filtered = items.filter(item => typeFilter.value === "all" || item.type === typeFilter.value).filter(item => categoryFilter.value === "all" || item.category === categoryFilter.value);
    this.root.querySelector("#adminBudgetBody").innerHTML = filtered.map(item => {
      const itemForecast = Math.max(Number(item.committed) || 0, Number(item.actual) || 0); const variance = item.type === "Expense" ? Number(item.planned) - itemForecast : itemForecast - Number(item.planned); const good = variance >= 0;
      return `<tr><td><span class="budget-type ${item.type.toLowerCase()}">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></td><td>${escapeHtml(item.owner || "Unassigned")}</td><td>${currency(item.planned)}</td><td>${currency(item.committed)}</td><td>${currency(item.actual)}</td><td><span class="budget-variance ${good ? "positive" : "negative"}">${good ? "+" : "−"}${currency(Math.abs(variance))}</span></td><td><button class="button small" data-admin-action="edit-budget-item" data-id="${item.id}">Edit</button></td></tr>`;
    }).join("") || `<tr><td colspan="7">${empty("No budget lines match these filters.")}</td></tr>`;
  }
  #renderRegistrationEstimate() {
    const form = this.root.querySelector("#adminRegistrationForm"); if (!form) return;
    const values = Object.fromEntries(["baseFee", "clubAddOn", "lateFeeOne", "lateFeeTwo", "onTimePlayers", "lateOnePlayers", "lateTwoPlayers", "coachWaivers", "coachPolicy"].map(name => [name, formValue(form, name)]));
    const rosterCount = this.vm.state.players.filter(player => player.active !== false).length; const estimate = registrationRevenueEstimate(values, rosterCount);
    this.root.querySelector("#adminRegistrationOnTimePrice").textContent = currency(estimate.onTimePrice); this.root.querySelector("#adminRegistrationLateOnePrice").textContent = currency(estimate.lateOnePrice); this.root.querySelector("#adminRegistrationLateTwoPrice").textContent = currency(estimate.lateTwoPrice); this.root.querySelector("#adminRegistrationTotal").textContent = currency(estimate.total);
    this.root.querySelector("#adminRegistrationWaiver").textContent = currency(estimate.coachWaiverValue); this.root.querySelector("#adminRegistrationWaiverCopy").textContent = estimate.settings.coachPolicy === "held" ? `${estimate.waivedRegistrations} payments held, then returned` : estimate.settings.coachPolicy === "waived" ? `${estimate.waivedRegistrations} coach-family registrations cost $0` : "No coach waiver applied";
    const check = this.root.querySelector("#adminRegistrationCheck"); const submit = form.querySelector("button[type=submit]");
    const waiverOverflow = estimate.settings.coachPolicy !== "none" && estimate.settings.coachWaivers > estimate.settings.onTimePlayers;
    check.className = estimate.rosterDifference === 0 && !waiverOverflow ? "positive" : "negative"; check.textContent = waiverOverflow ? "Coach registrations cannot exceed on-time registrations" : estimate.rosterDifference === 0 ? `All ${rosterCount} active players accounted for` : estimate.rosterDifference < 0 ? `${Math.abs(estimate.rosterDifference)} active players are not assigned to a fee window` : `${estimate.rosterDifference} more registrations than the active roster`;
    submit.disabled = estimate.rosterDifference !== 0 || waiverOverflow;
    const presets = registrationScenarioPresets(values, rosterCount, this.vm.stats.teamCount); const budget = budgetSummary(this.vm.budgetItems); const registrationItem = this.vm.budgetItems.find(item => item.id === "budget-registration-fees" || (item.type === "Revenue" && item.category === "Registration"));
    const currentRegistration = Math.max(Number(registrationItem?.committed) || 0, Number(registrationItem?.actual) || 0); const otherIncome = budget.forecastRevenue - currentRegistration; const selectedPlan = compareScenarioBudgets(this.vm.scenarios, this.vm.state.fields, this.vm.budgetItems).find(item => item.scenario.id === this.vm.selectedScenarioId); const seasonExpenses = selectedPlan?.projectedExpense || budget.forecastExpense;
    const scenarios = presets.map(item => ({ ...item, projectedSurplus: otherIncome + item.estimate.total - seasonExpenses })); const flat = scenarios.find(item => item.id === "s1"); const coachFriendly = scenarios.find(item => item.id === "s4"); const highestLate = Math.max(...scenarios.filter(item => ["s2", "s3"].includes(item.id)).map(item => item.estimate.total - flat.estimate.total));
    const works = coachFriendly?.projectedSurplus >= 0; this.root.querySelector("#adminRegistrationPolicyDecision").innerHTML = `<div class="admin-policy-verdict ${works ? "works" : "needs-work"}"><span>${works ? "Policy supported" : "Needs review"}</span><div><strong>${works ? "Use one registration price. Waive the coach fee." : "The flat-fee coach waiver needs a funding adjustment."}</strong><p>${works ? `After waiving one registration for each of 100 teams, the club still finishes with ${currency(coachFriendly.projectedSurplus)}. Late fees add at most ${currency(highestLate)}, but they are not needed to fund this season.` : `The current assumptions leave a ${currency(Math.abs(coachFriendly.projectedSurplus))} gap. Adjust the base price or other funding before removing fees.`}</p></div></div>`;
    this.root.querySelector("#adminRegistrationScenarioCards").innerHTML = scenarios.map(item => { const delta = item.estimate.total - flat.estimate.total; const selected = ["baseFee", "clubAddOn", "lateFeeOne", "lateFeeTwo", "onTimePlayers", "lateOnePlayers", "lateTwoPlayers", "coachWaivers", "coachPolicy"].every(name => String(estimate.settings[name]) === String(item.estimate.settings[name])); return `<button type="button" class="admin-registration-scenario ${selected ? "active" : ""} ${item.id === "s4" ? "recommended" : ""}" data-admin-action="registration-preset" data-preset="${item.id}"><header><b>${item.label}</b><span>${item.id === "s4" ? "Recommended policy" : item.id === "s1" ? "No late fees" : "Late-fee test"}</span></header><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small><dl><div><dt>Registration income</dt><dd>${currency(item.estimate.total)}</dd></div><div><dt>Money after season</dt><dd class="${item.projectedSurplus >= 0 ? "positive" : "negative"}">${currency(item.projectedSurplus)}</dd></div><div><dt>${item.id === "s4" ? "Coach benefit" : "Fee effect"}</dt><dd>${item.id === "s4" ? currency(item.estimate.coachWaiverValue) : item.id === "s1" ? "None" : `+${currency(delta)}`}</dd></div></dl><footer>Fill calculator →</footer></button>`; }).join("");
    this.root.querySelectorAll("[data-admin-action=registration-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === scenarios.find(item => ["baseFee", "clubAddOn", "lateFeeOne", "lateFeeTwo", "onTimePlayers", "lateOnePlayers", "lateTwoPlayers", "coachWaivers", "coachPolicy"].every(name => String(estimate.settings[name]) === String(item.estimate.settings[name])))?.id));
  }
  #renderGear() {
    const items = this.vm.gearItems; const order = gearOrderSummary(items); const teams = this.vm.teams.filter(team => team.status !== "Inactive"); const distributions = teams.map(team => this.vm.gearDistributionForTeam(team.id)); const handoff = gearDistributionSummary(distributions, teams.length);
    this.root.querySelector("#adminGearStats").innerHTML = [[currency(order.orderedSpend), "Recorded invoices"], [`${order.receivedPercent}%`, "Gear received"], [`${handoff["Picked up"]}/${teams.length}`, "Team kits picked up"], [handoff["Needs items"], "Teams need items"]].map(([value, label]) => `<span><strong>${value}</strong><small>${label}</small></span>`).join("");
    const slider = this.root.querySelector("#adminGearPlayerCount"); slider.value = this.gearPlayerCount; const plan = gearPlan(items, this.gearPlayerCount, 12); this.gearPlayerCount = plan.playerCount;
    this.root.querySelector("#adminGearPlayerOutput").textContent = `${plan.playerCount.toLocaleString()} players · ${plan.teamCount} teams`;
    const amazonTotal = plan.vendorTotals.Amazon || 0; const soccerPostTotal = plan.vendorTotals["Soccer Post"] || 0;
    const baseEquipment = this.vm.budgetItems.filter(item => item.type === "Expense" && item.category === "Equipment").reduce((sum, item) => sum + Number(item.planned || 0), 0); const baseUniforms = this.vm.budgetItems.filter(item => item.type === "Expense" && item.category === "Uniforms").reduce((sum, item) => sum + Number(item.planned || 0), 0);
    const equipmentBudget = scaledGearBudget({ baseEquipment, baseUniforms, basePlayerCount: this.vm.stats.playerCount, baseTeamCount: teams.length, playerCount: plan.playerCount, teamCount: plan.teamCount });
    this.root.querySelector("#adminGearSimulationSummary").innerHTML = `<article><span>Projected gear order</span><strong>${currency(plan.total)}</strong><small>${currency(plan.perPlayer)} per player</small></article><article><span>Amazon estimate</span><strong>${currency(amazonTotal)}</strong><small>Equipment + club identity</small></article><article><span>Soccer Post estimate</span><strong>${currency(soccerPostTotal)}</strong><small>Player jerseys</small></article><article class="${plan.total <= equipmentBudget.total ? "positive" : "negative"}"><span>Scaled equipment + uniform plan</span><strong>${currency(equipmentBudget.total)}</strong><small>${currency(equipmentBudget.equipmentPerTeam)}/team + ${currency(equipmentBudget.uniformPerPlayer)}/player · ${plan.total <= equipmentBudget.total ? `${currency(equipmentBudget.total - plan.total)} remains` : `${currency(plan.total - equipmentBudget.total)} funding gap`}</small></article>`;
    this.root.querySelector("#adminGearPlanBody").innerHTML = plan.lines.map(item => { const basis = item.basis === "team" ? `${item.rate} × ${plan.teamCount} teams` : item.basis === "player" ? `${item.rate} × ${plan.playerCount.toLocaleString()} players` : `${item.rate} club order`; return `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></td><td>${escapeHtml(basis)}</td><td><b>${item.quantity.toLocaleString()}</b></td><td>${unitCurrency(item.unitCost)}</td><td><strong>${currency(item.estimatedCost)}</strong></td><td>${item.sourceUrl ? `<a class="admin-vendor-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.vendor)} ↗</a>` : escapeHtml(item.vendor)}</td></tr>`; }).join("") || `<tr><td colspan="6">${empty("Add a gear record to build the next-season plan.")}</td></tr>`;
    const vendor = this.root.querySelector("#adminGearVendorFilter").value; const orderStatus = this.root.querySelector("#adminGearOrderStatusFilter").value; const filteredItems = items.filter(item => vendor === "all" || item.vendor === vendor).filter(item => orderStatus === "all" || item.status === orderStatus);
    this.root.querySelector("#adminGearOrderBody").innerHTML = filteredItems.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.notes || "No notes")}</small></td><td>${item.sourceUrl ? `<a class="admin-vendor-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.vendor)} ↗</a>` : escapeHtml(item.vendor)}</td><td>${Number(item.orderedQty).toLocaleString()}</td><td><span class="admin-gear-quantity"><b>${Number(item.receivedQty).toLocaleString()}</b><i><em style="width:${item.orderedQty ? Math.min(100, item.receivedQty / item.orderedQty * 100) : 0}%"></em></i></span></td><td><span class="admin-gear-quantity"><b>${Number(item.distributedQty).toLocaleString()}</b><i><em style="width:${item.orderedQty ? Math.min(100, item.distributedQty / item.orderedQty * 100) : 0}%"></em></i></span></td><td><strong>${currency(item.actualSpend)}</strong><small>${item.orderedQty ? `${unitCurrency(item.actualSpend / item.orderedQty)} avg.` : "No units"}</small></td><td><button class="button small" data-admin-action="edit-gear-item" data-id="${item.id}">Edit</button></td></tr>`).join("") || `<tr><td colspan="7">${empty("No gear records match these filters.")}</td></tr>`;
    const divisionFilter = this.root.querySelector("#adminGearDivisionFilter"); const selectedDivision = divisionFilter.value || "all"; const divisions = [...new Set(teams.map(team => team.division))].sort(); divisionFilter.innerHTML = `<option value="all">All divisions</option>${divisions.map(division => `<option ${division === selectedDivision ? "selected" : ""}>${escapeHtml(division)}</option>`).join("")}`;
    const statusFilter = this.root.querySelector("#adminGearDistributionStatus").value; const visibleTeams = teams.filter(team => divisionFilter.value === "all" || team.division === divisionFilter.value).map(team => ({ team, delivery: this.vm.gearDistributionForTeam(team.id) })).filter(({ delivery }) => statusFilter === "all" || delivery.status === statusFilter);
    this.root.querySelector("#adminGearDistributionSummary").innerHTML = [[handoff["Picked up"], "Picked up"], [handoff.Ready, "Ready for coaches"], [handoff["Needs items"], "Need items"], [handoff["Not packed"], "Not packed"]].map(([value, label], index) => `<span class="tone-${index}"><strong>${value}</strong><small>${label}</small></span>`).join("");
    this.root.querySelector("#adminGearTeamBody").innerHTML = visibleTeams.map(({ team, delivery }) => { const kit = [`${delivery.balls || 0}/2 balls`, delivery.firstAid && "first aid", delivery.pump && "pump", delivery.ballBag && "bag", delivery.goals && "goals"].filter(Boolean); const tone = delivery.status === "Picked up" ? "blue" : delivery.status === "Ready" ? "green" : delivery.status === "Needs items" ? "gold" : "gray"; return `<tr><td><span class="admin-team-crest small">${escapeHtml(team.division)}</span><span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.division)} · 12 players</small></span></td><td><div class="admin-gear-kit-chips">${kit.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div></td><td><span class="badge ${tone}">${escapeHtml(delivery.status)}</span></td><td>${delivery.pickedUpBy ? `<strong>${escapeHtml(delivery.pickedUpBy)}</strong><small>${delivery.pickedUpAt ? formatDate(delivery.pickedUpAt) : "Date not recorded"}</small>` : `<span class="muted">Not handed off</span>`}</td><td><button class="button small" data-admin-action="edit-gear-distribution" data-id="${team.id}">Update</button></td></tr>`; }).join("") || `<tr><td colspan="5">${empty("No team kits match these filters.")}</td></tr>`;
  }
  #renderCoaches() {
    const term = this.root.querySelector("#adminCoachSearch").value.trim().toLowerCase(); const clearance = this.root.querySelector("#adminClearanceFilter").value;
    const coaches = [...this.vm.state.coaches].sort((a, b) => a.name.localeCompare(b.name)).filter(coach => clearance === "all" || coach.clearanceStatus === clearance).filter(coach => `${coach.name} ${coach.email} ${(coach.assignments || []).map(item => this.vm.team(item.teamId)?.name).join(" ")}`.toLowerCase().includes(term));
    this.root.querySelector("#adminCoachCount").textContent = `${coaches.length} coach${coaches.length === 1 ? "" : "es"} · A–Z`;
    this.root.querySelectorAll("[data-admin-action=coach-layout]").forEach(button => { const active = button.dataset.layout === this.coachLayout; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    const container = this.root.querySelector("#adminCoachGrid"); container.className = this.coachLayout === "list" ? "admin-coach-list" : "admin-coach-grid";
    if (this.coachLayout === "list") {
      container.innerHTML = coaches.length ? `<div class="admin-coach-list-head" aria-hidden="true"><span>Coach</span><span>Contact</span><span>Clearance</span><span>Team assignments</span><span></span></div>${coaches.map(coach => {
        const assignments = coach.assignments || []; const tone = clearanceTone(coach.clearanceStatus);
        return `<article class="admin-coach-row"><div class="admin-coach-identity"><span class="admin-avatar">${initials(coach.name)}</span><span><strong>${escapeHtml(coach.name)}</strong><small>${escapeHtml(coach.email)}</small></span></div><div class="admin-coach-contact"><span class="mobile-label">Contact</span><strong>${escapeHtml(coach.phone || "No phone")}</strong><small>${escapeHtml(coach.email)}</small></div><div class="admin-coach-clearance-cell"><span class="mobile-label">Clearance</span><span class="admin-clearance ${tone}"><i></i>${escapeHtml(coach.clearanceStatus)}</span><small>${coach.clearanceExpires ? `Through ${formatDate(coach.clearanceExpires)}` : "Date not entered"}</small></div><div class="admin-coach-row-assignments"><span class="mobile-label">Team assignments</span>${assignments.length ? assignments.map(item => `<span><b>${escapeHtml(this.vm.team(item.teamId)?.name || "Unknown team")}</b><small>${item.role === "headCoach" ? "Head coach" : "Assistant coach"}</small></span>`).join("") : `<span class="unassigned"><b>No team assigned</b><small>Ready for placement</small></span>`}</div><button class="button small" data-admin-action="edit-coach" data-id="${coach.id}">Edit</button></article>`;
      }).join("")}` : empty("No coaches match this filter.");
      return;
    }
    container.innerHTML = coaches.map(coach => {
      const assignments = coach.assignments || []; const tone = clearanceTone(coach.clearanceStatus);
      return `<article class="admin-coach-card"><div class="admin-coach-head"><span class="admin-avatar">${initials(coach.name)}</span><div><h3>${escapeHtml(coach.name)}</h3><p>${escapeHtml(coach.email)}</p></div><span class="admin-clearance ${tone}"><i></i>${escapeHtml(coach.clearanceStatus)}</span></div><div class="admin-coach-meta"><span>Clearance ${coach.clearanceExpires ? `through ${formatDate(coach.clearanceExpires)}` : "date not entered"}</span><span>${escapeHtml(coach.phone || "No phone")}</span></div><div class="admin-assignment-list">${assignments.map(item => `<span><b>${escapeHtml(this.vm.team(item.teamId)?.name || "Unknown team")}</b><small>${item.role === "headCoach" ? "Head coach" : "Assistant coach"}</small></span>`).join("") || `<span class="unassigned"><b>No team assigned</b><small>Ready for placement</small></span>`}</div><button class="button" data-admin-action="edit-coach" data-id="${coach.id}">Edit clearance & assignments</button></article>`;
    }).join("") || empty("No coaches match this filter.");
  }
  #renderMessages() {
    const divisions = [...new Set(this.vm.teams.map(team => team.division))]; const division = this.root.querySelector("#adminBroadcastDivision"); const current = division.value;
    division.innerHTML = divisions.map(value => `<option ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
    const checked = new Set([...this.root.querySelectorAll("input[name=broadcastTeamIds]:checked")].map(input => input.value));
    this.root.querySelector("#adminBroadcastTeams").innerHTML = this.vm.teams.map(team => `<label><input type="checkbox" name="broadcastTeamIds" value="${team.id}" ${checked.has(team.id) ? "checked" : ""}><span>${escapeHtml(team.name)}</span></label>`).join("");
    const items = [...this.vm.state.broadcasts].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 8);
    this.root.querySelector("#adminBroadcastHistory").innerHTML = items.map(item => `<article class="admin-history-row"><span class="admin-message-icon">✉</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${formatDateTime(item.sentAt)} · ${item.teamIds.length} team${item.teamIds.length === 1 ? "" : "s"}</small></div></article>`).join("") || empty("No club updates have been sent yet.");
    this.#renderAudiencePreview();
  }
  #renderAudiencePreview() {
    const form = this.root.querySelector("#adminBroadcastForm"); if (!form) return;
    const scope = formValue(form, "scope"); const divisionField = form.elements.division; const picker = form.querySelector(".admin-team-picker");
    divisionField.closest("label").classList.toggle("hidden", scope !== "division"); picker.classList.toggle("hidden", scope !== "teams");
    const selectedTeamIds = [...form.querySelectorAll("input[name=broadcastTeamIds]:checked")].map(input => input.value);
    const ids = resolveBroadcastTeamIds({ scope, division: divisionField.value, selectedTeamIds }, this.vm.state.teams);
    this.root.querySelector("#adminAudiencePreview").textContent = `${ids.length} team${ids.length === 1 ? "" : "s"} will receive this update`;
  }
}
