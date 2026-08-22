import { clone } from "../shared/format.js";
import { createAdminDemoData, createBudgetItems, createGearItems } from "../admin/demo-data.js";

const STORAGE_KEY = "fairOaksSoccer.adminMvp.v6";

export class AdminWorkspaceModel {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    try { this.state = JSON.parse(storage.getItem(STORAGE_KEY)) || createAdminDemoData(); }
    catch { this.state = createAdminDemoData(); }
    this.state.budgetItems ||= createBudgetItems();
    this.state.gearItems ||= createGearItems(); this.state.gearDistributions ||= [];
  }
  #persist() { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
  #merge(collection, value) {
    const index = this.state[collection].findIndex(item => item.id === value.id);
    if (index >= 0) this.state[collection][index] = clone(value); else this.state[collection].push(clone(value));
    this.#persist(); return clone(value);
  }
  saveTeam(value) { return Promise.resolve(this.#merge("teams", value)); }
  savePlayer(value) { return Promise.resolve(this.#merge("players", value)); }
  savePractice(value) { return Promise.resolve(this.#merge("practices", value)); }
  savePractices(values) {
    values.forEach(value => {
      const index = this.state.practices.findIndex(item => item.id === value.id);
      if (index >= 0) this.state.practices[index] = clone(value); else this.state.practices.push(clone(value));
    });
    this.#persist(); return Promise.resolve(values);
  }
  saveField(value) { return Promise.resolve(this.#merge("fields", value)); }
  saveBudgetItem(value) { return Promise.resolve(this.#merge("budgetItems", value)); }
  saveGearItem(value) { return Promise.resolve(this.#merge("gearItems", value)); }
  saveGearDistribution(value) { return Promise.resolve(this.#merge("gearDistributions", value)); }
  saveScenario(value) { return Promise.resolve(this.#merge("scenarios", value)); }
  publishScenario(value) {
    this.state.scenarios = this.state.scenarios.map(item => ({ ...item, status: item.id === value.id ? "published" : item.status === "published" ? "draft" : item.status }));
    this.state.practices = value.practices.map(item => ({ ...item, adminManaged: true })); this.#persist(); return Promise.resolve(value);
  }
  saveCoach(value) {
    const previous = this.state.coaches.find(item => item.id === value.id);
    const oldTeamIds = new Set((previous?.assignments || []).map(item => item.teamId));
    const newTeamIds = new Set((value.assignments || []).map(item => item.teamId));
    this.state.teams.forEach(team => {
      if (!oldTeamIds.has(team.id) && !newTeamIds.has(team.id)) return;
      team.coachIds = [...new Set([...(team.coachIds || []).filter(id => id !== value.id), ...(newTeamIds.has(team.id) ? [value.id] : [])])];
    });
    return Promise.resolve(this.#merge("coaches", value));
  }
  deletePractice(id) { this.state.practices = this.state.practices.filter(item => item.id !== id); this.#persist(); return Promise.resolve(); }
  async sendBroadcast(value) { this.#merge("broadcasts", value); return value; }
  resetDemo() { this.state = createAdminDemoData(); this.#persist(); return this.state; }
}
