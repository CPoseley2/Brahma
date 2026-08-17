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
    const membershipRole = identity ? (["headCoach", "assistantCoach"].includes(identity.membership.role) ? "coach" : "family") : null;
    this.role = services.experienceRole && membershipRole === "coach" ? services.experienceRole : membershipRole || localStorage.getItem("fairOaksU6.role") || "coach";
    this.familyId = identity ? (identity.membership.familyId || "") : (localStorage.getItem("fairOaksU6.family") || "");
    this.userId = identity?.user.uid || null;
    this.media = services.media || null; this.teamId = services.teamId || ""; this.sendCoachInvite = services.sendCoachInvite || null;
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
      ? [["coach-dashboard", "Dashboard"], ["messages", "Messages"], ["documents", "Docs"], ["development", "Player Development"], ["sessions", "Practices"], ["playbook", "Season Plan"], ["drills", "Drill Cards"], ["roster", "Roster"], ["schedule", "Schedule"], ["volunteers", "Volunteers"], ["standards", "Standards"], ["data-settings", "Data"]]
      : [["family-home", "Season Home"], ["messages", "Messages"], ["documents", "Docs"], ["my-player", "Season Story"], ["schedule", "Schedule"], ["volunteers", "Help Out"], ["team-philosophy", "Our Philosophy"]];
  }
  get activePlayers() {
    const active = this.state.players.filter(player => player.active);
    if (this.role !== "family" || !this.identity) return active;
    const allowed = new Set(this.identity.membership.playerIds || []);
    const familyId = this.identity.membership.familyId || null;
    return active.filter(player => allowed.has(player.id) || (familyId && player.familyId === familyId));
  }
  get practiceEvents() { return [...this.state.games].filter(event => String(event.type).toLowerCase() === "practice").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }
  get curriculumPracticeEvents() { return this.practiceEvents.filter(event => event.status !== "Canceled"); }
  get drillCards() {
    const overrides = new Map((this.state.drillCards || []).map(item => [item.id, item]));
    return drillLibrary.map(item => ({ ...item, ...(overrides.get(item.id) || {}) }));
  }
  get canUploadDrillImages() { return Boolean(this.media && this.teamId); }
  get canManageDocuments() { return this.role === "coach" && Boolean(this.model.saveDocument && this.model.deleteDocument); }
  get canUploadDocuments() { return this.canManageDocuments && Boolean(this.media && this.teamId); }
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
    if (this.state.families?.length) {
      const families = this.state.families.map(family => ({ ...family, players: this.activePlayers.filter(player => player.familyId === family.id) }));
      const isDualAccessCoach = this.role === "family" && ["headCoach", "assistantCoach"].includes(this.identity?.membership.role);
      return isDualAccessCoach ? families.filter(family => family.players.length) : families;
    }
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
  hasCoachPrivileges(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const memberRole = this.memberForEmail(normalized)?.role;
    const inviteRole = (this.state.invites || []).find(item => item.active && item.email?.toLowerCase() === normalized)?.role;
    return [memberRole, inviteRole].some(role => ["headCoach", "assistantCoach"].includes(role));
  }
  get coachPromotionCandidates() {
    const candidates = new Map();
    const add = ({ player, name, email, guardianId = "" }) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!player || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) return;
      if (this.hasCoachPrivileges(normalizedEmail)) return;
      const existing = candidates.get(normalizedEmail);
      const value = {
        id: `${player.id}:${normalizedEmail}`,
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`.trim(),
        familyId: player.familyId || null,
        guardianId: guardianId || existing?.guardianId || "",
        name: name || existing?.name || `${player.lastName} parent`,
        email: normalizedEmail,
      };
      if (!existing || guardianId) candidates.set(normalizedEmail, value);
    };
    this.activePlayers.forEach(player => {
      add({ player, name: `${player.lastName} parent`, email: player.familyEmail });
      this.guardiansForPlayer(player.id).forEach(guardian => add({ player, name: guardian.name, email: guardian.email, guardianId: guardian.id }));
    });
    return [...candidates.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  coachPromotionCandidate(playerId, email) {
    const normalized = String(email || "").trim().toLowerCase();
    return this.coachPromotionCandidates.find(candidate => candidate.playerId === playerId && candidate.email === normalized) || null;
  }
  hasParentAccessToPlayer(playerId) {
    const player = this.player(playerId);
    const membership = this.identity?.membership || {};
    const allowed = new Set(membership.playerIds || []);
    return Boolean(player && (allowed.has(playerId) || (membership.familyId && player.familyId === membership.familyId)));
  }
  canClaimPlayer(playerId) { return this.role === "coach" && Boolean(this.player(playerId)) && !this.hasParentAccessToPlayer(playerId); }
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
  async recordFieldObservation({ eventId, blockLabel, skillId, playerIds }) {
    if (this.role !== "coach") throw new Error("Only a coach can record player observations.");
    const event = this.state.games.find(item => item.id === eventId);
    if (!event) throw new Error("This practice could not be found.");
    const skills = this.state.skillFramework.flatMap(group => group.skills || []);
    const skillsById = new Map(skills.map(item => [item.id, item]));
    const skill = skillsById.get(skillId);
    if (!skill) throw new Error("Choose a skill you observed.");
    const selectedIds = [...new Set(playerIds || [])];
    const players = selectedIds.map(id => this.player(id)).filter(player => player?.active);
    if (!players.length) throw new Error("Choose at least one player.");

    const updatedAt = new Date().toISOString();
    const observations = players.map(player => {
      const id = `field-${event.id}-${player.id}`;
      const existing = this.state.observations.find(item => item.id === id && item.playerId === player.id);
      const ratings = { ...(existing?.ratings || {}) };
      ratings[skill.id] = Math.max(1, Number(ratings[skill.id] || 0), Number(this.latestSkillLevels(player.id)[skill.id] || 0));
      const skillIds = [...new Set([...(existing?.fieldObservation?.skillIds || []), skill.id])];
      const blockLabels = [...new Set([...(existing?.fieldObservation?.blockLabels || []), blockLabel].filter(Boolean))];
      const familyLabels = skillIds.map(id => skillsById.get(id)?.familyText || skillsById.get(id)?.name || id);
      const noticed = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(familyLabels);
      return {
        ...existing,
        id,
        playerId: player.id,
        date: event.date || todayIso(),
        ratings,
        celebration: `At practice, we noticed ${noticed}.`,
        nextPlay: existing?.nextPlay || "",
        privateNote: existing?.privateNote || "Quick marks recorded in Field Mode.",
        shared: true,
        fieldObservation: {
          eventId: event.id,
          blockLabels,
          skillIds,
          createdAt: existing?.fieldObservation?.createdAt || updatedAt,
          updatedAt,
        },
      };
    });

    if (this.model.upsert) {
      await Promise.all(observations.map(item => this.model.upsert("observations", item)));
      observations.forEach(item => this.upsertLocal("observations", item));
    } else {
      observations.forEach(item => this.upsertLocal("observations", item));
      await this.model.save();
    }
    this.changed();
    const names = players.map(player => player.firstName);
    return `Saved ${skill.name} for ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names)}.`;
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
  eventAvailability(gameId) {
    const event = this.state.games.find(item => item.id === gameId);
    const capacity = Math.max(0, Number(event?.slotCapacity || 0));
    const attending = (this.state.rsvps || []).filter(item => item.gameId === gameId && item.status === "yes").length;
    if (!capacity) return { limited: false, capacity: 0, assigned: attending, available: null };
    const eventSlots = (this.state.eventSlots || []).filter(slot => slot.eventId === gameId);
    const assigned = eventSlots.length
      ? eventSlots.filter(slot => slot.playerId).length
      : attending;
    return { limited: true, capacity, assigned, available: Math.max(0, capacity - assigned) };
  }
  eventRsvpRoster(gameId) {
    const responses = new Map((this.state.rsvps || [])
      .filter(item => item.gameId === gameId)
      .map(item => [item.playerId, item.status]));
    const players = this.activePlayers
      .map(player => ({ ...player, rsvpStatus: responses.get(player.id) || "" }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    return {
      players,
      attending: players.filter(player => player.rsvpStatus === "yes").length,
      declined: players.filter(player => player.rsvpStatus === "no").length,
      maybe: players.filter(player => player.rsvpStatus === "maybe").length,
      noResponse: players.filter(player => !player.rsvpStatus).length,
      responded: players.filter(player => Boolean(player.rsvpStatus)).length,
      total: players.length,
    };
  }
  async setRsvp(gameId, playerId, status) {
    if (!["yes", "no", "maybe"].includes(status)) throw new Error("Choose Going, Maybe, or Not going.");
    const existing = (this.state.rsvps || []).find(item => item.gameId === gameId && item.playerId === playerId);
    const item = { ...existing, id: playerId, gameId, playerId, userId: this.userId, status };
    let persisted = item;
    if (this.model.upsert) persisted = await this.model.upsert("rsvps", item) || item; else {
      this.upsertLocal("rsvps", item); await this.model.save();
    }
    this.state.rsvps ||= [];
    const saved = this.state.rsvps.find(value => value.gameId === gameId && value.playerId === playerId);
    if (saved) Object.assign(saved, persisted); else this.state.rsvps.push(persisted);
    this.changed();
    return status === "yes" ? "You’re attending and a spot is reserved." : status === "maybe" ? "Your RSVP is set to Maybe." : "Your RSVP is set to Not going.";
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
  async promoteParentToCoach(candidate) {
    if (this.role !== "coach") throw new Error("Only a coach can promote a parent to coach.");
    const eligible = this.coachPromotionCandidates.find(item => item.id === candidate?.id);
    if (!eligible) throw new Error("That parent is no longer eligible for promotion.");
    if (!this.model.promoteParentToCoach) throw new Error("Coach promotion is not available in this workspace.");
    const value = {
      ...eligible,
      messageId: uid("message"),
      readmeUrl: typeof window === "undefined" ? "/coach-readme.html" : new URL("/coach-readme.html", window.location.origin).href,
      promotedByUid: this.userId,
      promotedByLabel: this.identity?.membership.role === "headCoach" ? "Head Coach" : "Coach",
    };
    const saved = await this.model.promoteParentToCoach(value);
    this.changed();
    return `${saved.name} is now an assistant coach. Their parent access was preserved and the onboarding message was sent.`;
  }
  async inviteCoach({ name, email }) {
    if (this.role !== "coach") throw new Error("Only a coach can invite another coach.");
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanName) throw new Error("Enter the coach’s name.");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Enter a valid coach email address.");
    if (this.coachPromotionCandidates.some(candidate => candidate.email === cleanEmail)) {
      throw new Error("This email belongs to a roster contact. Use Make coach beside that parent so their Parent access is preserved.");
    }
    if (!this.model.inviteCoach) throw new Error("Coach invitations are not available in this workspace.");
    const saved = await this.model.inviteCoach({
      name: cleanName,
      email: cleanEmail,
      invitedByUid: this.userId,
      invitedAt: new Date().toISOString(),
    });
    if (!this.sendCoachInvite) throw new Error("Coach access was saved, but email delivery is not configured.");
    const continueUrl = typeof window === "undefined"
      ? "https://team.example/?workspace=coach"
      : new URL("?workspace=coach", `${window.location.origin}${window.location.pathname}`).href;
    try {
      await this.sendCoachInvite(cleanEmail, continueUrl);
    } catch (cause) {
      const error = new Error(`Coach access was saved for ${cleanEmail}, but the sign-in email could not be sent. Try sending the invitation again.`);
      error.inviteSaved = true; error.cause = cause; throw error;
    }
    this.changed();
    return `${saved.name || cleanName} was invited as an assistant coach. A secure sign-in link was sent to ${cleanEmail}.`;
  }
  async claimPlayer(playerId) {
    if (!this.canClaimPlayer(playerId)) throw new Error("You already have Parent access to this player, or the player is no longer available.");
    if (!this.model.claimPlayerForCoach) throw new Error("Player claiming is not available in this workspace.");
    const player = this.player(playerId);
    const email = String(this.identity?.user.email || this.identity?.membership.email || "").trim().toLowerCase();
    if (!email) throw new Error("Your coach account needs a verified email address before you can claim a player.");
    const name = String(this.identity?.user.displayName || this.identity?.membership.name || email.split("@")[0]).trim();
    const saved = await this.model.claimPlayerForCoach({
      playerId,
      guardianId: uid("guardian"),
      name,
      email,
      claimedByUid: this.userId,
      claimedAt: new Date().toISOString(),
    });
    Object.assign(this.identity.membership, saved.member);
    this.familyId = saved.member.familyId || "";
    this.changed();
    return `${player.firstName} ${player.lastName} is now associated with your account. Parent view is available from the workspace switcher.`;
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
  async uploadDocument({ title, category, file }) {
    if (this.role !== "coach") throw new Error("Only coaches can add files to Docs.");
    if (!this.canUploadDocuments) throw new Error("Document storage is not available.");
    const cleanTitle = this.#validateDocumentDetails(title, category);
    this.#validateDocumentFile(file, category);
    const id = uid("document");
    const [uploaded] = await this.media.upload([file], `teams/${this.teamId}/documents`, id);
    const timestamp = new Date().toISOString();
    const value = {
      id, title: cleanTitle, category, fileName: uploaded.fileName, url: uploaded.url, path: uploaded.path,
      contentType: uploaded.contentType, size: uploaded.size, uploadedAt: timestamp, uploadedByUid: this.userId,
      updatedAt: timestamp, updatedByUid: this.userId,
    };
    try { await this.model.saveDocument(value); }
    catch (error) { await this.media.delete(uploaded.path).catch(() => {}); throw error; }
    this.upsertLocal("documents", value); this.changed(); return value;
  }
  async updateDocument(id, { title, category }) {
    if (!this.canManageDocuments) throw new Error("Only coaches can edit Docs.");
    const existing = (this.state.documents || []).find(item => item.id === id);
    if (!existing) throw new Error("That document could not be found.");
    const value = {
      ...existing,
      title: this.#validateDocumentDetails(title, category),
      category,
      updatedAt: new Date().toISOString(),
      updatedByUid: this.userId,
    };
    await this.model.saveDocument(value); this.upsertLocal("documents", value); this.changed(); return value;
  }
  async copyDocument(id) {
    if (!this.canUploadDocuments) throw new Error("Only coaches can copy files in Docs.");
    const source = (this.state.documents || []).find(item => item.id === id);
    if (!source) throw new Error("That document could not be found.");
    const copyId = uid("document");
    const uploaded = await this.media.copy({
      sourcePath: source.path,
      directory: `teams/${this.teamId}/documents`,
      ownerId: copyId,
      fileName: source.fileName,
      contentType: source.contentType,
    });
    const timestamp = new Date().toISOString();
    const suffix = " copy"; const available = Math.max(1, 120 - suffix.length);
    const value = {
      id: copyId, title: `${source.title.slice(0, available)}${suffix}`, category: source.category,
      fileName: uploaded.fileName, url: uploaded.url, path: uploaded.path, contentType: uploaded.contentType,
      size: uploaded.size, uploadedAt: timestamp, uploadedByUid: this.userId,
      updatedAt: timestamp, updatedByUid: this.userId, copiedFromId: source.id,
    };
    try { await this.model.saveDocument(value); }
    catch (error) { await this.media.delete(uploaded.path).catch(() => {}); throw error; }
    this.upsertLocal("documents", value); this.changed(); return value;
  }
  async deleteDocument(id) {
    if (!this.canManageDocuments) throw new Error("Only coaches can delete files from Docs.");
    const existing = (this.state.documents || []).find(item => item.id === id);
    if (!existing) throw new Error("That document could not be found.");
    await this.model.deleteDocument(id);
    this.state.documents = (this.state.documents || []).filter(item => item.id !== id);
    let cleanupFailed = false;
    if (existing.path && this.media) {
      try { await this.media.delete(existing.path); }
      catch (error) { cleanupFailed = true; console.warn("Document metadata was deleted, but Storage cleanup failed", error); }
    }
    this.changed();
    return { title: existing.title, cleanupFailed };
  }
  #validateDocumentDetails(title, category) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) throw new Error("Add a title for this file.");
    if (cleanTitle.length > 120) throw new Error("Keep the document title to 120 characters or fewer.");
    if (!["pdf", "map", "photo"].includes(category)) throw new Error("Choose PDF, Map, or Photo.");
    return cleanTitle;
  }
  #validateDocumentFile(file, category) {
    if (!file) throw new Error("Choose a PDF or image to upload.");
    const supportedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const isPdf = file.type === "application/pdf"; const isImage = supportedTypes.slice(1).includes(file.type);
    if (category === "pdf" && !isPdf) throw new Error("The PDF category accepts PDF files only.");
    if (category === "photo" && !isImage) throw new Error("The Photo category accepts image files only.");
    if (!supportedTypes.includes(file.type)) throw new Error("Docs accepts PDF, JPEG, PNG, and WebP files.");
    if (!Number(file.size)) throw new Error("The selected file is empty.");
    if (file.size >= 10 * 1024 * 1024) throw new Error("Keep each Docs file under 10 MB.");
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
    const capacity = Number(draft.slotCapacity || 0);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 200) throw new Error("RSVP slots must be a whole number from 0 to 200.");
    const affected = scope === "series" && draft.seriesId
      ? this.state.games.filter(event => event.seriesId === draft.seriesId)
      : this.state.games.filter(event => event.id === existingId);
    const highestAttendance = Math.max(0, ...affected.map(event => this.eventAvailability(event.id).assigned));
    if (capacity > 0 && capacity < highestAttendance) throw new Error(`At least ${highestAttendance} players are already attending. The slot count cannot be reduced below current attendance.`);
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
    return { type: draft.type, status: draft.status, time: draft.time, opponent: draft.opponent, location: draft.location, notes: draft.notes, slotCapacity: Number(draft.slotCapacity || 0) };
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
