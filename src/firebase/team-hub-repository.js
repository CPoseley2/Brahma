import { teamModels } from "./firestore-model.js";
import { BroadcastService } from "./broadcast-service.js";
import { MessageService } from "./message-service.js";

async function privateId(prefix, value) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `${prefix}-${[...digest.slice(0, 10)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export class TeamHubRepository {
  constructor(firestore, teamId) {
    this.firestore = firestore; this.teamId = teamId;
    this.broadcasts = new BroadcastService(firestore);
    this.messages = new MessageService(firestore);
  }
  get context() { return { teamId: this.teamId }; }
  async fetchMembership(uid) {
    const membership = await this.firestore.fetch(teamModels.member, uid, this.context);
    if (!membership?.active) return membership;
    const lastLoginAt = new Date().toISOString();
    try {
      await this.firestore.update(teamModels.member, uid, { lastLoginAt }, this.context);
      return { ...membership, lastLoginAt };
    } catch (error) {
      console.warn("Could not record member login activity", error);
      return membership;
    }
  }
  async acceptInvite(user) {
    if (!user.email || !user.emailVerified) throw new Error("A verified email address is required.");
    const invite = await this.firestore.fetch(teamModels.invite, user.email.toLowerCase(), this.context);
    if (!invite?.active) throw new Error("This email address has not been invited to the team.");
    await this.firestore.save(teamModels.member, {
      id: user.uid,
      email: user.email.toLowerCase(),
      role: invite.role,
      familyId: invite.familyId ?? null,
      playerIds: invite.playerIds || [],
      guardianIds: invite.guardianIds || [],
      joinedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      active: true,
    }, this.context);
  }
  async loadTeamHub(membership) {
    const playerRequest = membership.role === "guardian"
      ? this.#loadGuardianPlayers(membership)
      : this.firestore.fetchAll(teamModels.player, this.context);
    const familyRequest = membership.role === "guardian"
      ? (membership.familyId ? this.firestore.fetch(teamModels.family, membership.familyId, this.context).then(value => value ? [value] : []) : Promise.resolve([]))
      : this.firestore.fetchAll(teamModels.family, this.context);
    const guardianRequest = membership.role === "guardian"
      ? Promise.all((membership.guardianIds || []).map(id => this.firestore.fetch(teamModels.guardian, id, this.context))).then(values => values.filter(Boolean))
      : this.firestore.fetchAll(teamModels.guardian, this.context);
    const messageRequest = membership.role === "guardian" ? this.#loadGuardianMessages(membership) : this.firestore.fetchAll(teamModels.message, this.context);
    const memberRequest = membership.role !== "guardian" ? this.firestore.fetchAll(teamModels.member, this.context) : Promise.resolve([]);
    const [team, families, guardians, members, players, games, sessions, volunteerSlots, broadcasts, messages, drillCards] = await Promise.all([
      this.firestore.fetch(teamModels.team, this.teamId),
      familyRequest, guardianRequest, memberRequest, playerRequest,
      this.firestore.fetchAll(teamModels.event, this.context),
      membership.role === "guardian" ? Promise.resolve([]) : this.firestore.fetchAll(teamModels.session, this.context),
      this.firestore.fetchAll(teamModels.volunteerSlot, this.context),
      this.firestore.fetchAll(teamModels.broadcast, this.context),
      messageRequest,
      membership.role === "guardian" ? Promise.resolve([]) : this.firestore.fetchAll(teamModels.drillCard, this.context),
    ]);
    if (!team) throw new Error(`Team ${this.teamId} was not found.`);
    const observations = (await Promise.all(players.map(async player => {
      const shared = await this.firestore.fetchAll(teamModels.sharedObservation, { ...this.context, playerId: player.id });
      const privateItems = membership.role === "guardian" ? [] : await this.firestore.fetchAll(teamModels.privateObservation, { ...this.context, playerId: player.id });
      return [...shared.map(item => ({ ...item, playerId: player.id, shared: true })), ...privateItems.map(item => ({ ...item, playerId: player.id, shared: false }))];
    }))).flat();
    const rsvps = (await Promise.all(games.map(async event => {
      if (membership.role !== "guardian") return this.firestore.fetchAll(teamModels.rsvp, { ...this.context, eventId: event.id });
      const ownRsvps = await Promise.all(players.map(player => this.firestore.fetch(teamModels.rsvp, player.id, { ...this.context, eventId: event.id })));
      return ownRsvps.filter(Boolean);
    }))).flat();
    return { version: 6, team, families, guardians, members, players, games, sessions, volunteerSlots, observations, rsvps, broadcasts, messages, drillCards, skillFramework: team.skillFramework || [] };
  }
  async #loadGuardianPlayers(membership) {
    const values = [];
    if (membership.familyId) values.push(...await this.firestore.fetchWhere(teamModels.player, [{ field: "familyId", value: membership.familyId }], this.context));
    values.push(...(await Promise.all((membership.playerIds || []).map(id => this.firestore.fetch(teamModels.player, id, this.context)))).filter(Boolean));
    return [...new Map(values.map(value => [value.id, value])).values()];
  }
  async #loadGuardianMessages(membership) {
    const requests = [];
    if (membership.familyId) requests.push(this.firestore.fetchWhere(teamModels.message, [{ field: "familyId", value: membership.familyId }], this.context));
    (membership.guardianIds || []).forEach(guardianId => requests.push(this.firestore.fetchWhere(teamModels.message, [{ field: "guardianId", value: guardianId }], this.context)));
    return (await Promise.all(requests)).flat();
  }
  saveBroadcast(value) { return this.broadcasts.log({ ...value, teamId: this.teamId }); }
  saveMessage(value) { return this.messages.send({ ...value, teamId: this.teamId }); }
  saveDrillCard(value) { return this.firestore.upsert(teamModels.drillCard, value, this.context); }
  subscribeBroadcasts(onValue, onError) { return this.firestore.subscribe(teamModels.broadcast, [], this.context, onValue, onError); }
  subscribeMessages(membership, onValue, onError) {
    if (membership.role !== "guardian") return this.firestore.subscribe(teamModels.message, [], this.context, onValue, onError);
    const sources = [];
    if (membership.familyId) sources.push({ field: "familyId", value: membership.familyId });
    (membership.guardianIds || []).forEach(guardianId => sources.push({ field: "guardianId", value: guardianId }));
    if (!sources.length) { onValue([]); return () => {}; }
    const snapshots = new Map();
    const stops = sources.map(({ field, value }) => this.firestore.subscribe(
      teamModels.message,
      [{ field, value }],
      this.context,
      items => {
        snapshots.set(`${field}:${value}`, items);
        onValue([...new Map([...snapshots.values()].flat().map(item => [item.id, item])).values()]);
      },
      onError,
    ));
    return () => stops.forEach(stop => stop());
  }
  savePlayer(player) { return this.firestore.upsert(teamModels.player, player, this.context); }
  async saveGuardian(guardian, currentState) {
    const email = guardian.email.trim().toLowerCase();
    const existingInvite = await this.firestore.fetch(teamModels.invite, email, this.context);
    if (existingInvite && ["headCoach", "assistantCoach"].includes(existingInvite.role)) throw new Error("This email belongs to a coach and cannot also be invited as a guardian.");
    const activeGuardians = [...(currentState.guardians || []).filter(item => item.active !== false && item.id !== guardian.id), { ...guardian, email, active: true }];
    const emailGuardians = activeGuardians.filter(item => item.email.toLowerCase() === email);
    const playerIds = [...new Set([...(existingInvite?.playerIds || []), ...emailGuardians.map(item => item.playerId)])];
    const guardianIds = [...new Set([...(existingInvite?.guardianIds || []), ...emailGuardians.map(item => item.id)])];
    const invite = { id: email, email, role: "guardian", familyId: existingInvite?.familyId ?? null, playerIds, guardianIds, active: true };
    const entries = [
      { model: teamModels.guardian, value: { ...guardian, email, active: true }, context: this.context, merge: true },
      { model: teamModels.invite, value: invite, context: this.context, merge: true },
    ];
    const members = await this.firestore.fetchWhere(teamModels.member, [{ field: "email", value: email }], this.context);
    members.forEach(member => entries.push({
      model: teamModels.member,
      value: { ...member, playerIds, guardianIds },
      context: this.context,
      merge: true,
    }));
    await this.firestore.saveMultiple(entries);
    return { ...guardian, email, active: true };
  }
  async revokeGuardian(guardian, currentState) {
    const email = guardian.email.trim().toLowerCase();
    const existingInvite = await this.firestore.fetch(teamModels.invite, email, this.context);
    const remaining = (currentState.guardians || []).filter(item => item.active !== false && item.id !== guardian.id && item.email.toLowerCase() === email);
    const playerIds = [...new Set(remaining.map(item => item.playerId))];
    const guardianIds = remaining.map(item => item.id);
    const keepLegacyFamily = Boolean(existingInvite?.familyId);
    const entries = [
      { model: teamModels.guardian, value: { ...guardian, active: false }, context: this.context, merge: true },
      {
        model: teamModels.invite,
        value: { ...existingInvite, id: email, email, role: "guardian", familyId: existingInvite?.familyId ?? null, playerIds, guardianIds, active: keepLegacyFamily || guardianIds.length > 0 },
        context: this.context,
        merge: true,
      },
    ];
    const members = await this.firestore.fetchWhere(teamModels.member, [{ field: "email", value: email }], this.context);
    members.forEach(member => entries.push({
      model: teamModels.member,
      value: { ...member, playerIds, guardianIds, active: keepLegacyFamily || guardianIds.length > 0 },
      context: this.context,
      merge: true,
    }));
    await this.firestore.saveMultiple(entries);
  }
  saveEvent(event) { return this.firestore.upsert(teamModels.event, event, this.context); }
  saveEvents(events) { return this.firestore.saveMultiple(events.map(value => ({ model: teamModels.event, value, context: this.context, merge: true }))); }
  replaceEventSeries(events, removedIds) {
    return this.firestore.applyBatch(
      events.map(value => ({ model: teamModels.event, value, context: this.context, merge: true })),
      removedIds.map(id => ({ model: teamModels.event, id, context: this.context })),
    );
  }
  deleteEventSeries(ids) { return this.firestore.applyBatch([], ids.map(id => ({ model: teamModels.event, id, context: this.context }))); }
  saveSession(session) { return this.firestore.upsert(teamModels.session, session, this.context); }
  saveVolunteerSlot(slot) { return this.firestore.upsert(teamModels.volunteerSlot, slot, this.context); }
  saveObservation(observation) {
    const model = observation.shared ? teamModels.sharedObservation : teamModels.privateObservation;
    return this.firestore.upsert(model, observation, { ...this.context, playerId: observation.playerId });
  }
  saveTeam(team) { return this.firestore.upsert(teamModels.team, team); }
  saveRsvp(rsvp) { return this.firestore.upsert(teamModels.rsvp, rsvp, { ...this.context, eventId: rsvp.gameId }); }
  async importRoster(rows, currentState) {
    const existingFamilies = new Map((currentState.families || []).filter(family => family.email).map(family => [family.email.toLowerCase(), family]));
    const grouped = new Map();
    rows.forEach(row => {
      if (!grouped.has(row.familyEmail)) grouped.set(row.familyEmail, []);
      grouped.get(row.familyEmail).push(row);
    });
    const families = []; const players = []; const entries = []; let inviteCount = 0;
    for (const [email, familyRows] of grouped) {
      const existingFamily = existingFamilies.get(email);
      const familyId = existingFamily?.id || await privateId("family", email);
      const familyNames = [...new Set(familyRows.map(row => row.lastName))];
      const family = {
        ...existingFamily,
        id: familyId,
        displayName: `${familyNames.join(" / ")} family`,
        email,
        phone: familyRows.find(row => row.familyPhone)?.familyPhone || existingFamily?.phone || "",
      };
      families.push(family);
      entries.push({ model: teamModels.family, value: family, context: this.context, merge: true });
      const existingInvite = await this.firestore.fetch(teamModels.invite, email, this.context);
      if (!existingInvite || !["headCoach", "assistantCoach"].includes(existingInvite.role)) {
        entries.push({ model: teamModels.invite, value: { id: email, active: true, email, role: "guardian", familyId }, context: this.context, merge: true });
        inviteCount += 1;
      }
      for (const row of familyRows) {
        const existingPlayer = row.id ? currentState.players.find(player => player.id === row.id) : null;
        const id = existingPlayer?.id || await privateId("player", `${email}|${row.firstName}|${row.lastName}|${row.dateOfBirth}`.toLowerCase());
        const player = {
          ...existingPlayer,
          id, familyId,
          firstName: row.firstName, lastName: row.lastName, gender: row.gender,
          dateOfBirth: row.dateOfBirth, familyEmail: email, familyPhone: row.familyPhone,
          active: existingPlayer?.active ?? true,
          notes: existingPlayer?.notes || "",
        };
        players.push(player);
        entries.push({ model: teamModels.player, value: player, context: this.context, merge: true });
      }
    }
    if (entries.length > 450) throw new Error("This import is too large for one safe Firestore batch.");
    await this.firestore.saveMultiple(entries);
    return { families, players, inviteCount };
  }
  deletePlayer(id) { return this.firestore.delete(teamModels.player, id, this.context); }
  deleteEvent(id) { return this.firestore.delete(teamModels.event, id, this.context); }
  deleteSession(id) { return this.firestore.delete(teamModels.session, id, this.context); }
  deleteVolunteerSlot(id) { return this.firestore.delete(teamModels.volunteerSlot, id, this.context); }
  updateVolunteerSlot(id, assigneeFamilyId) { return this.firestore.update(teamModels.volunteerSlot, id, { assigneeFamilyId }, this.context); }
}
