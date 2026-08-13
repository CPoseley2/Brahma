import { uid } from "../shared/format.js";
import { findPracticeConflicts, practicesOverlap, recommendPracticeAssignments, resolveBroadcastTeamIds, scenarioMetrics, startOfWeek } from "../admin/admin-domain.js";
import { registrationRevenueEstimate } from "../admin/budget-domain.js";

export class AdminViewModel extends EventTarget {
  constructor(model, identity = null, { demo = false } = {}) {
    super(); this.model = model; this.identity = identity; this.demo = demo;
    this.model.state.scenarios ||= [];
    this.model.state.budgetItems ||= [];
    this.model.state.gearItems ||= []; this.model.state.gearDistributions ||= [];
    if (!this.model.state.scenarios.length) this.model.state.scenarios.push({ id: "scenario-published", name: "Published season", description: "Current family-facing schedule, imported from the existing team hubs.", kind: "Published plan", status: "published", seasonStart: startOfWeek(new Date()), seasonEnd: this.#seasonEnd(startOfWeek(new Date())), blackoutDates: [], closedFieldIds: [], updatedAt: new Date().toISOString(), practices: [...(this.model.state.practices || [])] });
    this.route = "admin-overview"; this.selectedTeamId = model.state.teams[0]?.id || "";
    this.selectedScenarioId = this.model.state.scenarios.find(item => item.status === "published")?.id || this.model.state.scenarios[0]?.id || "";
  }
  #seasonEnd(start) { const value = new Date(`${start}T12:00:00`); value.setDate(value.getDate() + 83); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
  get state() { return this.model.state; }
  get navigation() {
    return [["admin-overview", "Overview"], ["admin-teams", "Teams & rosters"], ["admin-practices", "Fields & practices"], ["admin-budget", "Season budget"], ["admin-gear", "Gear & distribution"], ["admin-coaches", "Coaches"], ["admin-messages", "Parent communication"]];
  }
  get teams() { return [...this.state.teams].sort((a, b) => `${a.division}-${a.name}`.localeCompare(`${b.division}-${b.name}`)); }
  get budgetItems() { return [...this.state.budgetItems].sort((a, b) => `${a.type}-${a.category}-${a.name}`.localeCompare(`${b.type}-${b.category}-${b.name}`)); }
  get gearItems() { return [...this.state.gearItems].sort((a, b) => `${a.vendor}-${a.category}-${a.name}`.localeCompare(`${b.vendor}-${b.category}-${b.name}`)); }
  get scenarios() { return [...this.state.scenarios].sort((a, b) => (a.status === "published" ? -1 : b.status === "published" ? 1 : b.updatedAt.localeCompare(a.updatedAt))); }
  get selectedScenario() { return this.state.scenarios.find(item => item.id === this.selectedScenarioId) || this.scenarios[0] || null; }
  get selectedTeam() { return this.state.teams.find(team => team.id === this.selectedTeamId) || this.teams[0] || null; }
  get practices() { return [...(this.selectedScenario?.practices || this.state.practices || [])].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)); }
  get conflicts() { return findPracticeConflicts(this.practices); }
  get conflictIds() { return new Set(this.conflicts.flatMap(pair => pair.map(item => item.id))); }
  get stats() {
    const activeTeams = this.state.teams.filter(team => team.status !== "Inactive");
    const uncleared = this.state.coaches.filter(coach => coach.clearanceStatus !== "Cleared");
    const unstaffed = activeTeams.filter(team => !(team.coachIds || []).length);
    return { teamCount: activeTeams.length, playerCount: this.state.players.filter(player => player.active !== false).length, fieldCount: this.state.fields.length, conflictCount: this.conflicts.length, uncleared, unstaffed };
  }
  go(route) { this.route = this.navigation.some(([id]) => id === route) ? route : "admin-overview"; this.changed(); }
  selectTeam(id, navigate = false) { this.selectedTeamId = id; if (navigate) this.route = "admin-teams"; this.changed(); }
  selectScenario(id) { if (this.state.scenarios.some(item => item.id === id)) { this.selectedScenarioId = id; this.changed(); } }
  changed() { this.dispatchEvent(new Event("change")); }
  playersForTeam(teamId) { return this.state.players.filter(player => player.teamId === teamId).sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)); }
  coachesForTeam(teamId) { return this.state.coaches.filter(coach => (coach.assignments || []).some(item => item.teamId === teamId)); }
  practicesForTeam(teamId) { return this.practices.filter(item => item.teamId === teamId); }
  field(id) { return this.state.fields.find(item => item.id === id); }
  team(id) { return this.state.teams.find(item => item.id === id); }
  gearItem(id) { return this.state.gearItems.find(item => item.id === id); }
  gearDistributionForTeam(teamId) { return this.state.gearDistributions.find(item => item.teamId === teamId) || { id: `gear-delivery-${teamId}`, teamId, status: "Not packed", balls: 0, firstAid: false, pump: false, ballBag: false, goals: false, pickedUpBy: "", pickedUpAt: "", notes: "" }; }
  scenario(id) { return this.state.scenarios.find(item => item.id === id); }
  metricsFor(scenario = this.selectedScenario) { return scenarioMetrics(scenario, this.state.teams, this.state.fields); }
  get scheduleImportReferences() { return { teams: this.state.teams, fields: this.state.fields, practices: this.practices }; }
  #requireDraft() { if (!this.selectedScenario) throw new Error("Choose a planning scenario first."); if (this.selectedScenario.status === "published") throw new Error("The published schedule is locked. Duplicate it to make changes safely."); return this.selectedScenario; }

  async saveTeam(fields) {
    const existing = fields.id ? this.team(fields.id) : null;
    const name = fields.name.trim(); const division = fields.division.trim();
    if (!name || !division) throw new Error("Team name and division are required.");
    const value = { ...existing, id: existing?.id || uid("team"), name, division, season: fields.season.trim(), status: fields.status, defaultFieldId: fields.defaultFieldId || "", practicePattern: fields.practicePattern.trim(), coachIds: existing?.coachIds || [], philosophy: existing?.philosophy || "" };
    await this.model.saveTeam(value); this.selectedTeamId = value.id; this.changed(); return value;
  }
  async savePlayer(fields) {
    const existing = fields.id ? this.state.players.find(item => item.id === fields.id) : null;
    if (!fields.teamId || !fields.firstName.trim() || !fields.lastName.trim()) throw new Error("Team, first name, and last name are required.");
    const value = { ...existing, id: existing?.id || uid("player"), teamId: fields.teamId, firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), dateOfBirth: fields.dateOfBirth, familyEmail: fields.familyEmail.trim().toLowerCase(), familyPhone: fields.familyPhone.trim(), active: fields.active };
    await this.model.savePlayer(value); this.changed(); return value;
  }
  async savePractice(fields) {
    const scenario = this.#requireDraft(); const existing = fields.id ? scenario.practices.find(item => item.id === fields.id) : null;
    if (!fields.teamId || !fields.fieldId || !fields.date || !fields.time) throw new Error("Team, field, date, and start time are required.");
    const field = this.field(fields.fieldId);
    const value = { ...existing, id: existing?.id || uid("practice"), teamId: fields.teamId, type: "Practice", opponent: "Team practice", date: fields.date, time: fields.time, durationMinutes: Number(fields.durationMinutes) || 60, fieldId: fields.fieldId, location: field?.name || "", status: fields.status, notes: fields.notes.trim() };
    const conflict = scenario.practices.find(item => practicesOverlap(value, item));
    if (conflict) throw new Error(`That field is already booked by ${this.team(conflict.teamId)?.name || "another team"} at ${conflict.time}.`);
    const practices = [...scenario.practices.filter(item => item.id !== value.id), value];
    await this.model.saveScenario({ ...scenario, practices, updatedAt: new Date().toISOString() }); this.changed(); return value;
  }
  async deletePractice(id) { const scenario = this.#requireDraft(); await this.model.saveScenario({ ...scenario, practices: scenario.practices.filter(item => item.id !== id), updatedAt: new Date().toISOString() }); this.changed(); }
  async importPractices(rows) {
    const scenario = this.#requireDraft();
    if (!rows.length) throw new Error("Choose a validated schedule file first.");
    const values = rows.map(({ rowNumber: _rowNumber, importAction: _importAction, ...value }) => value);
    const importedIds = new Set(values.map(item => item.id));
    const conflicts = findPracticeConflicts([...scenario.practices.filter(item => !importedIds.has(item.id)), ...values]);
    if (conflicts.length) throw new Error("The schedule changed after validation and now contains a field conflict. Review the file again.");
    await this.model.saveScenario({ ...scenario, practices: [...scenario.practices.filter(item => !importedIds.has(item.id)), ...values], updatedAt: new Date().toISOString() }); this.changed();
    const updates = rows.filter(row => row.importAction === "Update").length;
    return { total: values.length, adds: values.length - updates, updates };
  }
  async createScenario({ name, description, kind, seasonStart, seasonEnd, baseScenarioId, closedFieldIds = [] }) {
    if (!name.trim() || !seasonStart || !seasonEnd || seasonStart > seasonEnd) throw new Error("Name and a valid season date range are required.");
    const base = this.scenario(baseScenarioId) || this.selectedScenario; const closed = [...new Set(closedFieldIds)];
    const value = { id: uid("scenario"), name: name.trim(), description: description.trim(), kind, status: kind === "Weather contingency" ? "contingency" : "draft", seasonStart, seasonEnd, blackoutDates: [...(base?.blackoutDates || [])], closedFieldIds: closed, updatedAt: new Date().toISOString(), practices: (base?.practices || []).filter(item => !closed.includes(item.fieldId)).map(item => ({ ...item })) };
    await this.model.saveScenario(value); this.selectedScenarioId = value.id; this.changed(); return value;
  }
  async duplicateScenario(id = this.selectedScenarioId) {
    const base = this.scenario(id); if (!base) throw new Error("Choose a scenario to duplicate.");
    return this.createScenario({ name: `${base.name} · Copy`, description: `Working copy of ${base.name}.`, kind: base.kind === "Weather contingency" ? base.kind : "Working draft", seasonStart: base.seasonStart, seasonEnd: base.seasonEnd, baseScenarioId: base.id, closedFieldIds: base.closedFieldIds || [] });
  }
  async generateScenarioPlan() {
    const scenario = this.#requireDraft(); const metrics = this.metricsFor(scenario);
    if (!metrics.unassignedTeamIds.length) return { created: [], unresolved: [] };
    const result = recommendPracticeAssignments({ scenario, teams: this.state.teams, fields: this.state.fields, weekStart: startOfWeek(scenario.seasonStart), teamIds: metrics.unassignedTeamIds });
    await this.model.saveScenario({ ...scenario, practices: result.practices, updatedAt: new Date().toISOString() }); this.changed(); return result;
  }
  async publishSelectedScenario() {
    const scenario = this.selectedScenario; if (!scenario) throw new Error("Choose a scenario to publish.");
    const metrics = this.metricsFor(scenario);
    if (metrics.conflictCount) throw new Error(`Resolve ${metrics.conflictCount} field conflict${metrics.conflictCount === 1 ? "" : "s"} before publishing.`);
    if (metrics.unassignedTeamIds.length) throw new Error(`Place all teams before publishing. ${metrics.unassignedTeamIds.length} still need a complete weekly schedule.`);
    await this.model.publishScenario(scenario); this.changed(); return scenario;
  }
  async saveField(fields) {
    const existing = fields.id ? this.field(fields.id) : null;
    if (!fields.name.trim() || !fields.park.trim()) throw new Error("Field name and park or school are required.");
    const value = { ...existing, id: existing?.id || uid("field"), name: fields.name.trim(), park: fields.park.trim(), address: fields.address.trim(), status: fields.status, lights: fields.lights, notes: fields.notes.trim() };
    await this.model.saveField(value); this.changed(); return value;
  }
  async saveBudgetItem(fields) {
    const existing = fields.id ? this.state.budgetItems.find(item => item.id === fields.id) : null;
    const planned = Number(fields.planned); const committed = Number(fields.committed); const actual = Number(fields.actual);
    if (!fields.name.trim() || !fields.category || !["Revenue", "Expense"].includes(fields.type)) throw new Error("Name, category, and budget type are required.");
    if (![planned, committed, actual].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Budget amounts must be zero or greater.");
    const value = { ...existing, id: existing?.id || uid("budget"), name: fields.name.trim(), type: fields.type, category: fields.category, planned, committed, actual, owner: fields.owner.trim(), notes: fields.notes.trim(), updatedAt: new Date().toISOString() };
    await this.model.saveBudgetItem(value); this.changed(); return value;
  }
  async saveRegistrationPlan(fields) {
    const playerCount = this.state.players.filter(player => player.active !== false).length; const estimate = registrationRevenueEstimate(fields, playerCount);
    if (estimate.rosterDifference !== 0) throw new Error(`Registration counts must equal the ${playerCount}-player active roster.`);
    if (estimate.settings.coachPolicy !== "none" && estimate.settings.coachWaivers > estimate.settings.onTimePlayers) throw new Error("Coach registrations cannot exceed on-time registrations.");
    const existing = this.state.budgetItems.find(item => item.id === "budget-registration-fees" || (item.type === "Revenue" && item.category === "Registration"));
    const value = { ...existing, id: existing?.id || "budget-registration-fees", type: "Revenue", category: "Registration", name: existing?.name || "Player registration fees", planned: estimate.total, committed: estimate.total, actual: Number(existing?.actual) || 0, owner: existing?.owner || "Registrar", notes: existing?.notes || "Season registration pricing model.", registrationPlan: estimate.settings, updatedAt: new Date().toISOString() };
    await this.model.saveBudgetItem(value); this.changed(); return value;
  }
  async saveGearItem(fields) {
    const existing = fields.id ? this.gearItem(fields.id) : null; const numbers = ["rate", "packSize", "unitCost", "orderedQty", "receivedQty", "distributedQty", "actualSpend"].map(name => Number(fields[name]));
    if (!fields.name.trim() || !["Amazon", "Soccer Post", "Other"].includes(fields.vendor)) throw new Error("Item name and vendor are required.");
    if (!numbers.every(value => Number.isFinite(value) && value >= 0) || Number(fields.packSize) < 1) throw new Error("Gear quantities and costs must be zero or greater.");
    if (Number(fields.receivedQty) > Number(fields.orderedQty) || Number(fields.distributedQty) > Number(fields.receivedQty)) throw new Error("Distributed cannot exceed received, and received cannot exceed ordered.");
    if (fields.sourceUrl && !/^https:\/\//i.test(fields.sourceUrl)) throw new Error("Vendor link must begin with https://");
    const value = { ...existing, id: existing?.id || uid("gear"), name: fields.name.trim(), category: fields.category.trim() || "Team kit", vendor: fields.vendor, sourceUrl: fields.sourceUrl.trim(), basis: fields.basis, rate: Number(fields.rate), packSize: Number(fields.packSize), unitCost: Number(fields.unitCost), orderedQty: Number(fields.orderedQty), receivedQty: Number(fields.receivedQty), distributedQty: Number(fields.distributedQty), actualSpend: Number(fields.actualSpend), status: fields.status, notes: fields.notes.trim(), updatedAt: new Date().toISOString() };
    await this.model.saveGearItem(value); this.changed(); return value;
  }
  async saveGearDistribution(fields) {
    if (!this.team(fields.teamId)) throw new Error("Choose a valid team.");
    const existing = this.gearDistributionForTeam(fields.teamId); const status = ["Not packed", "Needs items", "Ready", "Picked up"].includes(fields.status) ? fields.status : "Not packed";
    const completeKit = Number(fields.balls) >= 2 && fields.firstAid && fields.pump && fields.ballBag && fields.goals;
    if (["Ready", "Picked up"].includes(status) && !completeKit) throw new Error("A ready kit needs 2 balls, first aid, pump, bag, and goals.");
    if (status === "Picked up" && !fields.pickedUpBy.trim()) throw new Error("Record the coach or volunteer who received the kit.");
    const value = { ...existing, id: existing.id || `gear-delivery-${fields.teamId}`, teamId: fields.teamId, status, balls: Math.max(0, Number(fields.balls) || 0), firstAid: Boolean(fields.firstAid), pump: Boolean(fields.pump), ballBag: Boolean(fields.ballBag), goals: Boolean(fields.goals), pickedUpBy: fields.pickedUpBy.trim(), pickedUpAt: status === "Picked up" ? existing.pickedUpAt || new Date().toISOString() : "", notes: fields.notes.trim(), updatedAt: new Date().toISOString() };
    await this.model.saveGearDistribution(value); this.changed(); return value;
  }
  async saveCoach(fields) {
    const existing = fields.id ? this.state.coaches.find(item => item.id === fields.id) : null;
    const email = fields.email.trim().toLowerCase();
    if (!fields.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Coach name and a valid email are required.");
    const teamIds = [...new Set([...(fields.teamIds || []), ...(fields.headCoachTeamId ? [fields.headCoachTeamId] : [])])];
    const assignments = teamIds.map(teamId => ({ teamId, role: fields.headCoachTeamId === teamId ? "headCoach" : "assistantCoach" }));
    const value = { ...existing, id: existing?.id || uid("coach"), name: fields.name.trim(), email, phone: fields.phone.trim(), clearanceStatus: fields.clearanceStatus, clearanceExpires: fields.clearanceExpires, assignments };
    await this.model.saveCoach(value); this.changed(); return value;
  }
  async sendBroadcast({ scope, division, selectedTeamIds, title, body }) {
    const teamIds = resolveBroadcastTeamIds({ scope, division, selectedTeamIds }, this.state.teams);
    if (!teamIds.length) throw new Error("Choose at least one active team.");
    if (!title.trim() || !body.trim()) throw new Error("Add a subject and message before sending.");
    const value = { id: uid("club-broadcast"), teamIds, title: title.trim(), body: body.trim(), sentAt: new Date().toISOString(), sentByUid: this.identity?.user?.uid || "admin-demo", sentByLabel: "Club office" };
    await this.model.sendBroadcast(value); this.changed(); return `Sent to ${teamIds.length} team${teamIds.length === 1 ? "" : "s"}.`;
  }
  resetDemo() { if (!this.demo) return; this.model.resetDemo(); this.selectedTeamId = this.state.teams[0]?.id || ""; this.selectedScenarioId = this.state.scenarios.find(item => item.status === "published")?.id || this.state.scenarios[0]?.id || ""; this.route = "admin-overview"; this.changed(); }
}
