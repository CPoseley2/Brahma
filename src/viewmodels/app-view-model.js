import { todayIso, uid } from "../shared/format.js";
import { rosterIdentity } from "../import/roster-importer.js";
import { scheduleDates } from "../shared/recurrence.js";
import { drillLibrary, seasonPlan } from "../data/season-playbook.js";

export class AppViewModel extends EventTarget {
  constructor(model, identity = null, services = {}) {
    super();
    this.model = model;
    this.identity = identity;
    this.identityLocked = Boolean(identity);
    this.role = identity ? (identity.membership.role === "guardian" ? "family" : "coach") : localStorage.getItem("fairOaksU6.role") || "coach";
    this.familyId = identity ? (identity.membership.familyId || "") : (localStorage.getItem("fairOaksU6.family") || "");
    this.userId = identity?.user.uid || null;
    this.media = services.media || null; this.teamId = services.teamId || "";
    this.lastError = null;
    this.route = this.defaultRoute;
    this.stopMessaging = this.model.startMessaging?.(
      () => this.changed(),
      error => { this.lastError = error; this.dispatchEvent(new CustomEvent("error", { detail: error })); },
    );
  }

  get state() { return this.model.state; }
  get defaultRoute() { return this.role === "coach" ? "coach-dashboard" : "family-home"; }
  get navigation() {
    return this.role === "coach"
      ? [["coach-dashboard", "Dashboard"], ["messages", "Messages"], ["development", "Player Development"], ["sessions", "Practices"], ["playbook", "Season Plan"], ["drills", "Drill Cards"], ["roster", "Roster"], ["schedule", "Schedule"], ["volunteers", "Volunteers"], ["standards", "Standards"], ["data-settings", "Data"]]
      : [["family-home", "Season Home"], ["messages", "Messages"], ["my-player", "Season Story"], ["schedule", "Schedule"], ["volunteers", "Help Out"], ["team-philosophy", "Our Philosophy"]];
  }
  get activePlayers() { return this.state.players.filter(player => player.active); }
  get practiceEvents() { return [...this.state.games].filter(event => String(event.type).toLowerCase() === "practice").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }
  get curriculumPracticeEvents() { return this.practiceEvents.filter(event => event.status !== "Canceled"); }
  get drillCards() {
    const overrides = new Map((this.state.drillCards || []).map(item => [item.id, item]));
    return drillLibrary.map(item => ({ ...item, ...(overrides.get(item.id) || {}) }));
  }
  get canUploadDrillImages() { return Boolean(this.media && this.teamId); }
  lessonForPractice(eventId) { const index = this.curriculumPracticeEvents.findIndex(event => event.id === eventId); return index >= 0 ? seasonPlan[index] || null : null; }
  practiceSpotlight(referenceDate = todayIso()) {
    const eligible = this.curriculumPracticeEvents;
    const event = eligible.find(item => item.date === referenceDate) || eligible.find(item => item.date > referenceDate) || null;
    return event ? { event, lesson: this.lessonForPractice(event.id), isToday: event.date === referenceDate } : null;
  }
  practiceSpotlightFor(eventId, referenceDate = todayIso()) {
    const event = this.curriculumPracticeEvents.find(item => item.id === eventId);
    return event ? { event, lesson: this.lessonForPractice(event.id), isToday: event.date === referenceDate } : null;
  }
  sessionForPractice(eventId) {
    const event = this.state.games.find(item => item.id === eventId);
    return this.state.sessions.find(item => item.eventId === eventId)
      || this.state.sessions.find(item => !item.eventId && event && item.date === event.date && (!item.title || item.title === event.opponent));
  }
  get isHeadCoach() { return this.identity?.membership.role === "headCoach"; }
  get families() {
    if (this.state.families?.length) return this.state.families.map(family => ({ ...family, players: this.activePlayers.filter(player => player.familyId === family.id) }));
    const families = new Map();
    this.activePlayers.forEach(player => {
      const key = (player.familyEmail || player.familyPhone || player.lastName).trim().toLowerCase();
      if (!families.has(key)) families.set(key, { id: key, label: `${player.lastName} family`, players: [] });
      families.get(key).players.push(player);
    });
    return [...families.values()].sort((a, b) => a.label.localeCompare(b.label));
  }
  get selectedFamily() {
    const family = this.families.find(item => item.id === this.familyId) || this.families[0] || null;
    if (family && family.id !== this.familyId) this.setFamily(family.id, false);
    return family;
  }
  get guardianRelationships() {
    const active = (this.state.guardians || []).filter(item => item.active !== false);
    if (this.role !== "family") return active;
    const allowed = new Set(this.identity?.membership.guardianIds || []);
    return active.filter(item => allowed.has(item.id));
  }
  guardiansForPlayer(playerId) { return this.guardianRelationships.filter(item => item.playerId === playerId); }
  get privateConversations() {
    const guardianConversations = this.guardianRelationships.map(guardian => {
      const player = this.player(guardian.playerId);
      return {
        id: `guardian:${guardian.id}`,
        kind: "guardian",
        guardianId: guardian.id,
        playerId: guardian.playerId,
        label: guardian.name,
        detail: `${guardian.relationship} to ${player ? `${player.firstName} ${player.lastName}` : "player"}`,
      };
    });
    if (this.role === "family" && guardianConversations.length) return guardianConversations;
    const familyConversations = this.families.map(family => ({
      id: `family:${family.id}`,
      kind: "family",
      familyId: family.id,
      label: family.label || family.displayName || "Family",
      detail: "Legacy family conversation",
    }));
    return [...guardianConversations, ...familyConversations];
  }

  player(id) { return this.state.players.find(player => player.id === id); }
  memberForEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return normalized ? (this.state.members || []).find(member => member.active && member.email?.toLowerCase() === normalized) || null : null;
  }
  lastObservation(playerId, sharedOnly = false) {
    return this.state.observations.filter(item => item.playerId === playerId && (!sharedOnly || item.shared))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }
  isUpdateDue(player) {
    const date = this.lastObservation(player.id)?.date;
    if (!date) return true;
    const days = Math.floor((new Date(`${todayIso()}T12:00:00`) - new Date(`${date}T12:00:00`)) / 86400000);
    return days >= Number(this.state.team.updateCadenceDays || 14);
  }
  latestSkillLevels(playerId) {
    const levels = {};
    this.state.observations.filter(item => item.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date))
      .forEach(item => Object.entries(item.ratings || {}).forEach(([key, value]) => { levels[key] = Number(value); }));
    return levels;
  }
  observedGroupCount(playerId) {
    const levels = this.latestSkillLevels(playerId);
    return this.state.skillFramework.filter(group => group.skills.some(skill => (levels[skill.id] ?? 0) > 0)).length;
  }

  setRole(role) { if (this.identityLocked) return; this.role = role; localStorage.setItem("fairOaksU6.role", role); this.go(this.defaultRoute); }
  setFamily(id, notify = true) { if (this.identityLocked && id !== this.familyId) return; this.familyId = id; if (!this.identityLocked) localStorage.setItem("fairOaksU6.family", id); if (notify) this.changed(); }
  go(route) { this.route = this.navigation.some(([id]) => id === route) ? route : this.defaultRoute; this.changed(); }
  changed() { this.dispatchEvent(new Event("change")); }
  dispose() { this.stopMessaging?.(); }
  commit() { this.#persist(this.model.save()); this.changed(); }
  saveTeam() { this.#persist(this.model.saveTeam ? this.model.saveTeam() : this.model.save()); this.changed(); }
  #persist(operation) { Promise.resolve(operation).catch(error => { this.lastError = error; this.dispatchEvent(new CustomEvent("error", { detail: error })); }); }
  upsert(collection, item) {
    const index = this.state[collection].findIndex(value => value.id === item.id);
    if (index >= 0) this.state[collection][index] = item; else this.state[collection].push(item);
    this.#persist(this.model.upsert ? this.model.upsert(collection, item) : this.model.save()); this.changed();
  }
  remove(collection, id) { this.state[collection] = this.state[collection].filter(item => item.id !== id); this.#persist(this.model.remove ? this.model.remove(collection, id) : this.model.save()); this.changed(); }
  setRsvp(gameId, playerId, status) {
    const existing = this.state.rsvps.find(item => item.gameId === gameId && item.playerId === playerId);
    if (existing) existing.status = status;
    else this.state.rsvps.push({ id: playerId, gameId, playerId, userId: this.userId, status });
    const item = existing || this.state.rsvps.find(value => value.gameId === gameId && value.playerId === playerId);
    if (this.userId) item.userId = this.userId;
    this.#persist(this.model.upsert ? this.model.upsert("rsvps", item) : this.model.save()); this.changed();
  }
  claimVolunteer(id) { const slot = this.state.volunteerSlots.find(item => item.id === id); if (slot && !slot.assigneeFamilyId) { slot.assigneeFamilyId = this.selectedFamily?.id || null; this.#persist(this.model.updateVolunteer ? this.model.updateVolunteer(id, slot.assigneeFamilyId) : this.model.save()); this.changed(); } }
  releaseVolunteer(id) { const slot = this.state.volunteerSlots.find(item => item.id === id); if (slot?.assigneeFamilyId === this.selectedFamily?.id) { slot.assigneeFamilyId = null; this.#persist(this.model.updateVolunteer ? this.model.updateVolunteer(id, null) : this.model.save()); this.changed(); } }
  import(value) { this.model.replace(value); this.changed(); }
  reset() { this.model.reset(); this.changed(); }
  prepareRosterImport(rows) {
    return rows.map(row => {
      const existing = this.state.players.find(player => rosterIdentity(player) === rosterIdentity(row));
      return { ...row, id: existing?.id || "", importAction: existing ? "Update" : "Add" };
    });
  }
  async importRoster(rows) {
    if (!this.isHeadCoach) throw new Error("Only the head coach can import a roster and create family invitations.");
    const result = await this.model.importRoster(rows);
    this.changed();
    return result;
  }
  async addGuardian({ playerId, name, email, relationship }) {
    if (!this.isHeadCoach) throw new Error("Only the head coach can manage guardian access.");
    const player = this.player(playerId);
    if (!player) throw new Error("Choose a player before adding a guardian.");
    const cleanName = name.trim(); const cleanEmail = email.trim().toLowerCase();
    if (!cleanName) throw new Error("Enter the guardian’s name.");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Enter a valid guardian email address.");
    if (!["parent", "grandparent", "other family", "friend"].includes(relationship)) throw new Error("Choose a valid relationship.");
    if (this.guardianRelationships.some(item => item.playerId === playerId && item.email.toLowerCase() === cleanEmail)) {
      throw new Error(`${cleanEmail} already has access to ${player.firstName}’s profile.`);
    }
    const value = {
      id: uid("guardian"),
      playerId,
      name: cleanName,
      email: cleanEmail,
      relationship,
      active: true,
      createdAt: new Date().toISOString(),
      createdByUid: this.userId,
    };
    await this.model.saveGuardian(value); this.changed(); return value;
  }
  async updateGuardian(id, { name, relationship }) {
    if (!this.isHeadCoach) throw new Error("Only the head coach can manage guardian access.");
    const existing = this.guardianRelationships.find(item => item.id === id);
    if (!existing) throw new Error("That guardian relationship could not be found.");
    const value = { ...existing, name: name.trim(), relationship, updatedAt: new Date().toISOString(), updatedByUid: this.userId };
    if (!value.name) throw new Error("Enter the guardian’s name.");
    await this.model.saveGuardian(value); this.changed(); return value;
  }
  async revokeGuardian(id) {
    if (!this.isHeadCoach) throw new Error("Only the head coach can manage guardian access.");
    const existing = this.guardianRelationships.find(item => item.id === id);
    if (!existing) throw new Error("That guardian relationship could not be found.");
    await this.model.revokeGuardian(existing); this.changed();
  }
  async uploadDrillImage(drillId, file) {
    if (!this.isHeadCoach && this.role !== "coach") throw new Error("Only coaches can manage drill-card artwork.");
    if (!this.media || !this.teamId) throw new Error("Drill-card storage is not available.");
    if (file.type !== "image/png") throw new Error("Drill cards must be PNG images.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Keep each drill-card PNG under 5 MB.");
    const [image] = await this.media.upload([file], `coachTeams/${this.teamId}/drill-cards`, drillId);
    const value = { id: drillId, imageUrl: image.url, imagePath: image.path, fileName: image.fileName, updatedAt: new Date().toISOString(), updatedByUid: this.userId };
    await this.model.saveDrillCard(value); this.upsertLocal("drillCards", value); this.changed(); return value;
  }
  async sendTeamBroadcast(title, body) {
    if (this.role !== "coach") throw new Error("Only a coach can send a team announcement.");
    const cleanTitle = title.trim(); const cleanBody = body.trim();
    if (!cleanTitle) throw new Error("Add a clear announcement title.");
    if (!cleanBody) throw new Error("Write the announcement before sending it.");
    if (cleanTitle.length > 120) throw new Error("Keep the announcement title to 120 characters or fewer.");
    if (cleanBody.length > 8000) throw new Error("Keep the announcement to 8,000 characters or fewer.");
    const value = {
      id: uid("broadcast"), familyIds: [], title: cleanTitle, body: cleanBody,
      attachments: [], actionButton: null, sentByUid: this.userId,
      sentByLabel: this.identity?.membership.role === "headCoach" ? "Head Coach" : "Coach",
      sentAt: new Date().toISOString(),
    };
    await this.model.sendBroadcast(value); this.changed();
    return `Announcement sent to the entire team: “${cleanTitle}”.`;
  }
  async sendPrivateMessage(conversationId, body) {
    const cleanBody = body.trim();
    if (!cleanBody) throw new Error("Write a message before sending it.");
    if (cleanBody.length > 4000) throw new Error("Keep private messages to 4,000 characters or fewer.");
    const allowed = this.privateConversations;
    const selectedId = this.role === "family" && allowed.length === 1 ? allowed[0].id : conversationId;
    const conversation = allowed.find(item => item.id === selectedId);
    if (!conversation) throw new Error("Choose a private conversation before sending.");
    const recipient = conversation.kind === "guardian"
      ? { guardianId: conversation.guardianId, playerId: conversation.playerId }
      : { familyId: conversation.familyId };
    const value = {
      id: uid("message"), ...recipient, body: cleanBody,
      senderUid: this.userId, senderRole: this.role === "coach" ? "coach" : "guardian",
      senderLabel: this.role === "coach" ? "Coach" : conversation.label,
      createdAt: new Date().toISOString(),
    };
    await this.model.sendMessage(value); this.changed();
    return this.role === "coach" ? `Private reply sent to ${conversation.label}.` : "Your private message was sent to the coaching staff.";
  }
  previewEventSchedule(draft) { return scheduleDates(draft); }
  async saveEventSchedule(draft, existingId = "", scope = "occurrence") {
    const dates = scheduleDates(draft);
    if (scope === "series" && draft.seriesId) return this.#replaceEventSeries(draft, dates);
    if (draft.scheduleMode === "weekly" && !existingId) return this.#createEventSeries(draft, dates);
    const existing = this.state.games.find(event => event.id === existingId);
    const event = { ...existing, ...this.#eventFields(draft), id: existingId || uid("event"), date: draft.date };
    await this.model.upsert("games", event); this.upsertLocal("games", event); this.changed();
    return { count: 1, message: `${event.type} on ${event.date} was saved.` };
  }
  async #createEventSeries(draft, dates) {
    const seriesId = uid("series");
    const events = dates.map(date => ({
      ...this.#eventFields(draft), id: uid("event"), date, occurrenceDate: date, seriesId,
      seriesStartDate: draft.seriesStartDate, seriesEndDate: draft.seriesEndDate, seriesWeekdays: draft.seriesWeekdays,
    }));
    await this.model.saveEvents(events); this.changed();
    return { count: events.length, message: `Created ${events.length} recurring ${draft.type.toLowerCase()} events.` };
  }
  async #replaceEventSeries(draft, dates) {
    const existing = this.state.games.filter(event => event.seriesId === draft.seriesId);
    const byOccurrence = new Map(existing.map(event => [event.occurrenceDate || event.date, event]));
    const events = dates.map(date => ({
      ...byOccurrence.get(date), ...this.#eventFields(draft), id: byOccurrence.get(date)?.id || uid("event"),
      date, occurrenceDate: date, seriesId: draft.seriesId,
      seriesStartDate: draft.seriesStartDate, seriesEndDate: draft.seriesEndDate, seriesWeekdays: draft.seriesWeekdays,
    }));
    await this.model.replaceEventSeries(draft.seriesId, events); this.changed();
    return { count: events.length, message: `Updated the full series. It now contains ${events.length} events.` };
  }
  #eventFields(draft) {
    return { type: draft.type, status: draft.status, time: draft.time, opponent: draft.opponent, location: draft.location, notes: draft.notes };
  }
  upsertLocal(collection, item) {
    const index = this.state[collection].findIndex(value => value.id === item.id);
    if (index >= 0) this.state[collection][index] = item; else this.state[collection].push(item);
  }
  async deleteEventOccurrence(id) {
    await this.model.remove("games", id); this.state.games = this.state.games.filter(event => event.id !== id); this.changed();
  }
  async deleteEventSeries(seriesId) {
    const count = await this.model.deleteEventSeries(seriesId); this.changed(); return count;
  }
}
