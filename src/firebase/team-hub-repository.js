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
      if (membership.role !== "guardian") {
        const items = await this.firestore.fetchAll(teamModels.rsvp, { ...this.context, eventId: event.id });
        return items.map(item => ({ ...item, gameId: event.id }));
      }
      const ownRsvps = await Promise.all(players.map(player => this.firestore.fetch(teamModels.rsvp, player.id, { ...this.context, eventId: event.id })));
      return ownRsvps.filter(Boolean).map(item => ({ ...item, gameId: event.id }));
    }))).flat();
    const eventSlots = (await Promise.all(games.map(async event => (
      await this.firestore.fetchAll(teamModels.eventSlot, { ...this.context, eventId: event.id })
    ).map(slot => ({ ...slot, eventId: event.id }))))).flat();
    return { version: 7, team, families, guardians, members, players, games, eventSlots, sessions, volunteerSlots, observations, rsvps, broadcasts, messages, drillCards, skillFramework: team.skillFramework || [] };
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
  subscribeEventSlots(events, onValue, onError) {
    if (!events.length) { onValue([]); return () => {}; }
    const snapshots = new Map();
    const stops = events.map(event => this.firestore.subscribe(
      teamModels.eventSlot,
      [],
      { ...this.context, eventId: event.id },
      items => {
        snapshots.set(event.id, items.map(item => ({ ...item, eventId: event.id })));
        onValue([...snapshots.values()].flat());
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
  async saveEvent(event) {
    await this.validateEventSlotCapacity(event.id, event.slotCapacity || 0);
    await this.firestore.upsert(teamModels.event, event, this.context);
    await this.configureEventSlots(event.id, event.slotCapacity || 0);
    return event;
  }
  async saveEvents(events) {
    await Promise.all(events.map(event => this.validateEventSlotCapacity(event.id, event.slotCapacity || 0)));
    await this.firestore.saveMultiple(events.map(value => ({ model: teamModels.event, value, context: this.context, merge: true })));
    await Promise.all(events.map(event => this.configureEventSlots(event.id, event.slotCapacity || 0)));
  }
  async replaceEventSeries(events, removedIds) {
    await Promise.all(events.map(event => this.validateEventSlotCapacity(event.id, event.slotCapacity || 0)));
    for (const id of removedIds) await this.deleteEvent(id);
    await this.firestore.applyBatch(
      events.map(value => ({ model: teamModels.event, value, context: this.context, merge: true })),
      [],
    );
    await Promise.all(events.map(event => this.configureEventSlots(event.id, event.slotCapacity || 0)));
  }
  async deleteEventSeries(ids) { for (const id of ids) await this.deleteEvent(id); }
  saveSession(session) { return this.firestore.upsert(teamModels.session, session, this.context); }
  saveVolunteerSlot(slot) { return this.firestore.upsert(teamModels.volunteerSlot, slot, this.context); }
  saveObservation(observation) {
    const model = observation.shared ? teamModels.sharedObservation : teamModels.privateObservation;
    return this.firestore.upsert(model, observation, { ...this.context, playerId: observation.playerId });
  }
  saveTeam(team) { return this.firestore.upsert(teamModels.team, team); }
  async validateEventSlotCapacity(eventId, capacity) {
    const target = Math.max(0, Number(capacity) || 0);
    if (!Number.isInteger(target) || target > 200) throw new Error("RSVP slots must be a whole number from 0 to 200.");
    if (!target) return;
    const rsvps = await this.firestore.fetchAll(teamModels.rsvp, { ...this.context, eventId });
    const attending = rsvps.filter(rsvp => rsvp.status === "yes").length;
    if (target < attending) throw new Error(`This event already has ${attending} attending player${attending === 1 ? "" : "s"}. Increase the slot count or ask a family to change its RSVP first.`);
  }
  async configureEventSlots(eventId, capacity) {
    const target = Math.max(0, Math.min(200, Number(capacity) || 0));
    const context = { ...this.context, eventId };
    const [existing, rsvps] = await Promise.all([
      this.firestore.fetchAll(teamModels.eventSlot, context),
      this.firestore.fetchAll(teamModels.rsvp, context),
    ]);
    const attending = rsvps.filter(rsvp => rsvp.status === "yes");
    if (target === 0) {
      await this.firestore.applyBatch(
        attending.filter(rsvp => rsvp.slotId).map(rsvp => ({
          model: teamModels.rsvp,
          value: { ...rsvp, slotId: null },
          context,
          merge: true,
        })),
        existing.map(slot => ({ model: teamModels.eventSlot, id: slot.id, context })),
      );
      return [];
    }
    if (target < attending.length) throw new Error(`This event already has ${attending.length} attending player${attending.length === 1 ? "" : "s"}. Increase the slot count or ask a family to change its RSVP first.`);
    const existingByPlayer = new Map(existing.filter(slot => slot.playerId).map(slot => [slot.playerId, slot]));
    const desiredIds = Array.from({ length: target }, (_, index) => `slot-${String(index + 1).padStart(3, "0")}`);
    const unusedIds = new Set(desiredIds);
    const assignments = new Map();
    attending.forEach(rsvp => {
      const prior = existingByPlayer.get(rsvp.playerId);
      if (prior && unusedIds.has(prior.id)) {
        assignments.set(rsvp.playerId, prior.id);
        unusedIds.delete(prior.id);
      }
    });
    attending.forEach(rsvp => {
      if (assignments.has(rsvp.playerId)) return;
      const [slotId] = unusedIds;
      assignments.set(rsvp.playerId, slotId);
      unusedIds.delete(slotId);
    });
    const attendingBySlot = new Map([...assignments].map(([playerId, slotId]) => [slotId, playerId]));
    const existingById = new Map(existing.map(slot => [slot.id, slot]));
    const entries = desiredIds.map((slotId, index) => {
      const playerId = attendingBySlot.get(slotId) || null;
      const rsvp = attending.find(item => item.playerId === playerId);
      const prior = playerId ? existingByPlayer.get(playerId) : existingById.get(slotId);
      return {
        model: teamModels.eventSlot,
        value: {
          id: slotId,
          eventId,
          position: index + 1,
          playerId,
          userId: playerId ? rsvp?.userId || prior?.userId || null : null,
          assignedAt: playerId ? prior?.assignedAt || rsvp?.updatedAt || new Date().toISOString() : null,
        },
        context,
        merge: false,
      };
    });
    attending.forEach(rsvp => entries.push({
      model: teamModels.rsvp,
      value: { ...rsvp, slotId: assignments.get(rsvp.playerId), gameId: eventId },
      context,
      merge: true,
    }));
    const deletions = existing.filter(slot => !desiredIds.includes(slot.id)).map(slot => ({ model: teamModels.eventSlot, id: slot.id, context }));
    if (entries.length || deletions.length) await this.firestore.applyBatch(entries, deletions);
    return entries.filter(entry => entry.model === teamModels.eventSlot).map(entry => entry.value);
  }
  async saveRsvp(rsvp) {
    const context = { ...this.context, eventId: rsvp.gameId };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const availableSlots = await this.firestore.fetchAll(teamModels.eventSlot, context);
      const candidate = availableSlots.find(slot => slot.playerId === rsvp.playerId)
        || availableSlots.filter(slot => !slot.playerId).sort((a, b) => Number(a.position) - Number(b.position))[0]
        || null;
      try {
        return await this.firestore.transaction(async (transaction, manager) => {
          const event = await manager.fetchInTransaction(transaction, teamModels.event, rsvp.gameId, this.context);
          if (!event) throw new Error("This event is no longer available.");
          if (event.status === "Canceled") throw new Error("RSVPs are closed because this event was canceled.");
          const existing = await manager.fetchInTransaction(transaction, teamModels.rsvp, rsvp.playerId, context);
          const limited = Number(event.slotCapacity || 0) > 0;
          const selectedId = candidate?.id || existing?.slotId || null;
          const selected = selectedId ? await manager.fetchInTransaction(transaction, teamModels.eventSlot, selectedId, context) : null;
          if (rsvp.status === "yes" && limited && (!selected || (selected.playerId && selected.playerId !== rsvp.playerId))) {
            const error = new Error("That spot was just claimed.");
            error.code = "slot-taken";
            throw error;
          }
          const now = new Date().toISOString();
          if (selected && rsvp.status === "yes" && selected.playerId !== rsvp.playerId) {
            manager.updateInTransaction(transaction, teamModels.eventSlot, selected.id, { playerId: rsvp.playerId, userId: rsvp.userId, assignedAt: now }, context);
          } else if (selected && rsvp.status !== "yes" && selected.playerId === rsvp.playerId) {
            manager.updateInTransaction(transaction, teamModels.eventSlot, selected.id, { playerId: null, userId: null, assignedAt: null }, context);
          }
          const value = { ...existing, ...rsvp, id: rsvp.playerId, slotId: rsvp.status === "yes" && limited ? selected.id : null, updatedAt: now };
          manager.setInTransaction(transaction, teamModels.rsvp, value, context, { merge: true });
          const slots = availableSlots.map(slot => slot.id === selected?.id
            ? { ...slot, playerId: rsvp.status === "yes" && limited ? rsvp.playerId : null, userId: rsvp.status === "yes" && limited ? rsvp.userId : null, assignedAt: rsvp.status === "yes" && limited ? now : null, eventId: rsvp.gameId }
            : { ...slot, eventId: rsvp.gameId });
          return { rsvp: value, slots };
        });
      } catch (error) {
        if (error.code === "slot-taken") continue;
        throw error;
      }
    }
    throw new Error("This event is full. Choose Maybe or Not going, or check again later.");
  }
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
  async deleteEvent(id) {
    const context = { ...this.context, eventId: id };
    const [slots, rsvps] = await Promise.all([
      this.firestore.fetchAll(teamModels.eventSlot, context),
      this.firestore.fetchAll(teamModels.rsvp, context),
    ]);
    await this.firestore.applyBatch(
      [],
      [
        ...slots.map(slot => ({ model: teamModels.eventSlot, id: slot.id, context })),
        ...rsvps.map(rsvp => ({ model: teamModels.rsvp, id: rsvp.id, context })),
        { model: teamModels.event, id, context: this.context },
      ],
    );
  }
  deleteSession(id) { return this.firestore.delete(teamModels.session, id, this.context); }
  deleteVolunteerSlot(id) { return this.firestore.delete(teamModels.volunteerSlot, id, this.context); }
  updateVolunteerSlot(id, assigneeFamilyId) { return this.firestore.update(teamModels.volunteerSlot, id, { assigneeFamilyId }, this.context); }
}
