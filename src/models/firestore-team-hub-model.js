export class FirestoreTeamHubModel {
  constructor(repository, state, membership) { this.repository = repository; this.state = state; this.membership = membership; }
  static async create(repository, membership) { return new FirestoreTeamHubModel(repository, await repository.loadTeamHub(membership), membership); }
  save() { return Promise.resolve(); }
  replace() { throw new Error("JSON import is disabled for the live Firestore model."); }
  reset() { throw new Error("Reset is disabled for the live Firestore model."); }
  upsert(collection, item) {
    const actions = {
      players: () => this.repository.savePlayer(item), games: () => this.repository.saveEvent(item),
      sessions: () => this.repository.saveSession(item), volunteerSlots: () => this.repository.saveVolunteerSlot(item),
      observations: () => this.repository.saveObservation(item), rsvps: () => this.#saveRsvp(item),
    };
    return actions[collection]?.() || Promise.reject(new Error(`Unsupported collection: ${collection}`));
  }
  remove(collection, id) {
    const actions = {
      players: () => this.repository.deletePlayer(id), games: () => this.repository.deleteEvent(id),
      sessions: () => this.repository.deleteSession(id), volunteerSlots: () => this.repository.deleteVolunteerSlot(id),
    };
    return actions[collection]?.() || Promise.reject(new Error(`Unsupported collection: ${collection}`));
  }
  saveTeam() { return this.repository.saveTeam(this.state.team); }
  async sendBroadcast(value) { const saved = await this.repository.saveBroadcast(value); this.#merge("broadcasts", saved); return saved; }
  async sendMessage(value) { const saved = await this.repository.saveMessage(value); this.#merge("messages", saved); return saved; }
  async saveGuardian(value) {
    const saved = await this.repository.saveGuardian(value, this.state);
    this.#merge("guardians", saved);
    return saved;
  }
  async revokeGuardian(value) {
    await this.repository.revokeGuardian(value, this.state);
    this.#merge("guardians", { ...value, active: false });
  }
  async promoteParentToCoach(value) {
    const saved = await this.repository.promoteParentToCoach(value, this.state);
    this.#merge("guardians", saved.guardian);
    this.#merge("invites", saved.invite);
    saved.members.forEach(member => this.#merge("members", member));
    this.#merge("messages", saved.message);
    return saved;
  }
  async inviteCoach(value) {
    const saved = await this.repository.inviteCoach(value, this.state);
    this.#merge("invites", saved);
    return saved;
  }
  async claimPlayerForCoach(value) {
    const saved = await this.repository.claimPlayerForCoach(value, this.state, this.membership);
    this.membership = saved.member;
    this.#merge("guardians", saved.guardian);
    this.#merge("members", saved.member);
    return saved;
  }
  async saveDrillCard(value) { await this.repository.saveDrillCard(value); this.#merge("drillCards", value); return value; }
  async saveDocument(value) { await this.repository.saveDocument(value); this.#merge("documents", value); return value; }
  async deleteDocument(id) {
    await this.repository.deleteDocument(id);
    this.state.documents = (this.state.documents || []).filter(item => item.id !== id);
  }
  startMessaging(onChange, onError) {
    const stops = [
      this.repository.subscribeBroadcasts(values => { this.state.broadcasts = values; onChange(); }, onError),
      this.repository.subscribeMessages(this.membership, values => { this.state.messages = values; onChange(); }, onError),
      this.repository.subscribeEventSlots(this.state.games, values => { this.state.eventSlots = values; onChange(); }, onError),
    ];
    return () => stops.forEach(stop => stop());
  }
  updateVolunteer(id, familyId) { return this.repository.updateVolunteerSlot(id, familyId); }
  async saveEvents(events) {
    await this.repository.saveEvents(events);
    events.forEach(event => this.#merge("games", event));
  }
  async replaceEventSeries(seriesId, events) {
    const removedIds = this.state.games.filter(event => event.seriesId === seriesId && !events.some(value => value.id === event.id)).map(event => event.id);
    await this.repository.replaceEventSeries(events, removedIds);
    this.state.games = this.state.games.filter(event => event.seriesId !== seriesId);
    events.forEach(event => this.#merge("games", event));
  }
  async deleteEventSeries(seriesId) {
    const ids = this.state.games.filter(event => event.seriesId === seriesId).map(event => event.id);
    await this.repository.deleteEventSeries(ids);
    this.state.games = this.state.games.filter(event => event.seriesId !== seriesId);
    return ids.length;
  }
  async importRoster(rows) {
    const result = await this.repository.importRoster(rows, this.state);
    result.families.forEach(family => this.#merge("families", family));
    result.players.forEach(player => this.#merge("players", player));
    return { playerCount: result.players.length, familyCount: result.families.length, inviteCount: result.inviteCount };
  }
  async #saveRsvp(value) {
    const result = await this.repository.saveRsvp(value);
    const index = this.state.rsvps.findIndex(item => item.gameId === result.rsvp.gameId && item.playerId === result.rsvp.playerId);
    if (index >= 0) this.state.rsvps[index] = result.rsvp; else this.state.rsvps.push(result.rsvp);
    this.state.eventSlots = [
      ...(this.state.eventSlots || []).filter(slot => slot.eventId !== value.gameId),
      ...result.slots,
    ];
    return result.rsvp;
  }
  #merge(collection, value) {
    this.state[collection] ||= [];
    const index = this.state[collection].findIndex(item => item.id === value.id);
    if (index >= 0) this.state[collection][index] = value; else this.state[collection].push(value);
  }
}
