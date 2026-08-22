export class FirestoreAdminModel {
  constructor(repository, state) { this.repository = repository; this.state = state; }
  static async create(repository) { return new FirestoreAdminModel(repository, await repository.loadWorkspace()); }
  #merge(collection, value) {
    const index = this.state[collection].findIndex(item => item.id === value.id);
    if (index >= 0) this.state[collection][index] = value; else this.state[collection].push(value);
    return value;
  }
  async saveTeam(value) { await this.repository.saveTeam(value); return this.#merge("teams", value); }
  async savePlayer(value) { await this.repository.savePlayer(value); return this.#merge("players", value); }
  async savePractice(value) { await this.repository.savePractice(value); return this.#merge("practices", value); }
  async savePractices(values) { await this.repository.savePractices(values); values.forEach(value => this.#merge("practices", value)); return values; }
  async deletePractice(id) {
    const item = this.state.practices.find(value => value.id === id); if (!item) return;
    await this.repository.deletePractice(id, item.teamId); this.state.practices = this.state.practices.filter(value => value.id !== id);
  }
  async saveField(value) { await this.repository.saveField(value); return this.#merge("fields", value); }
  async saveBudgetItem(value) { await this.repository.saveBudgetItem(value); return this.#merge("budgetItems", value); }
  async saveGearItem(value) { await this.repository.saveGearItem(value); return this.#merge("gearItems", value); }
  async saveGearDistribution(value) { await this.repository.saveGearDistribution(value); return this.#merge("gearDistributions", value); }
  async saveScenario(value) { await this.repository.saveScenario(value); return this.#merge("scenarios", value); }
  async publishScenario(value) {
    const published = await this.repository.publishScenario(value, this.state);
    this.state.scenarios = this.state.scenarios.map(item => ({ ...item, status: item.id === value.id ? "published" : item.status === "published" ? "draft" : item.status }));
    this.state.practices = published.practices.map(item => ({ ...item, adminManaged: true })); return published;
  }
  async saveCoach(value) {
    const previous = this.state.coaches.find(item => item.id === value.id);
    await this.repository.saveCoach(value, previous, this.state);
    const oldTeamIds = new Set((previous?.assignments || []).map(item => item.teamId));
    const newTeamIds = new Set((value.assignments || []).map(item => item.teamId));
    this.state.teams.forEach(team => {
      if (!oldTeamIds.has(team.id) && !newTeamIds.has(team.id)) return;
      team.coachIds = [...new Set([...(team.coachIds || []).filter(id => id !== value.id), ...(newTeamIds.has(team.id) ? [value.id] : [])])];
    });
    return this.#merge("coaches", value);
  }
  async sendBroadcast(value) { await this.repository.sendBroadcast(value); return this.#merge("broadcasts", value); }
}
