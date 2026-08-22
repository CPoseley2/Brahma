import { teamModels } from "./firestore-model.js";
import { BroadcastService } from "./broadcast-service.js";

export class AdminRepository {
  constructor(firestore) { this.firestore = firestore; this.broadcasts = new BroadcastService(firestore); }
  fetchAdmin(uid) { return this.firestore.fetch(teamModels.clubAdmin, uid); }

  async loadWorkspace() {
    const [rawTeams, fields, savedCoaches, scenarios, budgetItems, gearItems, gearDistributions] = await Promise.all([
      this.firestore.fetchAll(teamModels.team), this.firestore.fetchAll(teamModels.field), this.firestore.fetchAll(teamModels.coach), this.firestore.fetchAll(teamModels.scheduleScenario), this.firestore.fetchAll(teamModels.budgetItem), this.firestore.fetchAll(teamModels.gearItem), this.firestore.fetchAll(teamModels.gearDistribution),
    ]);
    const teams = rawTeams.map(team => ({
      status: "Active", division: String(team.name || "").match(/\bU\d+\b/i)?.[0]?.toUpperCase() || "Unassigned",
      coachIds: [], practicePattern: "", defaultFieldId: "", ...team,
    }));
    const bundles = await Promise.all(teams.map(async team => {
      const context = { teamId: team.id };
      const [players, events, members, broadcasts] = await Promise.all([
        this.firestore.fetchAll(teamModels.player, context), this.firestore.fetchAll(teamModels.event, context),
        this.firestore.fetchAll(teamModels.member, context), this.firestore.fetchAll(teamModels.broadcast, context),
      ]);
      return {
        players: players.map(item => ({ ...item, teamId: team.id })),
        practices: events.filter(item => String(item.type).toLowerCase() === "practice").map(item => ({ ...item, teamId: team.id })),
        members: members.map(item => ({ ...item, teamId: team.id })),
        broadcasts: broadcasts.filter(item => item.sentByLabel === "Club office").map(item => ({ ...item, teamIds: [team.id] })),
      };
    }));
    const derivedCoaches = new Map();
    bundles.flatMap(bundle => bundle.members).filter(member => ["headCoach", "assistantCoach"].includes(member.role)).forEach(member => {
      const key = member.email?.toLowerCase() || member.id;
      const existing = derivedCoaches.get(key) || {
        id: member.id, name: member.displayName || member.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Coach",
        email: member.email || "", phone: "", clearanceStatus: "Pending", clearanceExpires: "", assignments: [],
      };
      existing.assignments.push({ teamId: member.teamId, role: member.role }); derivedCoaches.set(key, existing);
    });
    const coachesByEmail = new Map([...derivedCoaches].map(([key, value]) => [key, value]));
    savedCoaches.forEach(coach => {
      const key = coach.email?.toLowerCase() || coach.id; const derived = coachesByEmail.get(key);
      coachesByEmail.set(key, { ...derived, ...coach, assignments: coach.assignments?.length ? coach.assignments : derived?.assignments || [] });
    });
    const coaches = [...coachesByEmail.values()];
    teams.forEach(team => { if (!team.coachIds.length) team.coachIds = coaches.filter(coach => coach.assignments.some(item => item.teamId === team.id)).map(coach => coach.id); });
    const broadcastMap = new Map();
    bundles.flatMap(bundle => bundle.broadcasts).forEach(item => {
      const key = `${item.sentAt}|${item.title}|${item.body}`;
      const existing = broadcastMap.get(key);
      if (existing) existing.teamIds.push(item.teamIds[0]); else broadcastMap.set(key, item);
    });
    return {
      version: 1, club: { name: "Fair Oaks Soccer Club", season: teams[0]?.season || "Current season" }, teams, fields, coaches,
      players: bundles.flatMap(bundle => bundle.players), practices: bundles.flatMap(bundle => bundle.practices),
      members: bundles.flatMap(bundle => bundle.members), broadcasts: [...broadcastMap.values()], scenarios, budgetItems, gearItems, gearDistributions,
    };
  }

  saveTeam(value) { return this.firestore.upsert(teamModels.team, value); }
  savePlayer(value) { return this.firestore.upsert(teamModels.player, value, { teamId: value.teamId }); }
  savePractice(value) { return this.firestore.upsert(teamModels.event, value, { teamId: value.teamId }); }
  savePractices(values) { return this.firestore.saveMultiple(values.map(value => ({ model: teamModels.event, value, context: { teamId: value.teamId }, merge: true }))); }
  deletePractice(id, teamId) { return this.firestore.delete(teamModels.event, id, { teamId }); }
  saveField(value) { return this.firestore.upsert(teamModels.field, value); }
  saveBudgetItem(value) { return this.firestore.upsert(teamModels.budgetItem, value); }
  saveGearItem(value) { return this.firestore.upsert(teamModels.gearItem, value); }
  saveGearDistribution(value) { return this.firestore.upsert(teamModels.gearDistribution, value); }
  saveScenario(value) { return this.firestore.upsert(teamModels.scheduleScenario, value); }

  async publishScenario(scenario, state) {
    const published = { ...scenario, status: "published", publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const ids = new Set(published.practices.map(item => item.id));
    const entries = published.practices.map(value => ({ model: teamModels.event, value: { ...value, adminManaged: true }, context: { teamId: value.teamId }, merge: true }));
    (state.scenarios || []).forEach(item => entries.push({ model: teamModels.scheduleScenario, value: { ...item, status: item.id === scenario.id ? "published" : item.status === "published" ? "draft" : item.status, ...(item.id === scenario.id ? { publishedAt: published.publishedAt, updatedAt: published.updatedAt } : {}) }, merge: true }));
    const deletions = (state.practices || []).filter(item => item.adminManaged && !ids.has(item.id)).map(item => ({ model: teamModels.event, id: item.id, context: { teamId: item.teamId } }));
    await this.firestore.applyBatch(entries, deletions); return published;
  }

  async saveCoach(value, previous, state) {
    const oldIds = new Set((previous?.assignments || []).map(item => item.teamId));
    const newIds = new Set((value.assignments || []).map(item => item.teamId));
    const affectedIds = [...new Set([...oldIds, ...newIds])];
    const entries = [{ model: teamModels.coach, value, merge: true }];
    for (const teamId of affectedIds) {
      const team = state.teams.find(item => item.id === teamId); if (!team) continue;
      const assigned = newIds.has(teamId);
      const coachIds = [...new Set([...(team.coachIds || []).filter(id => id !== value.id), ...(assigned ? [value.id] : [])])];
      entries.push({ model: teamModels.team, value: { ...team, coachIds }, merge: true });
      const role = value.assignments.find(item => item.teamId === teamId)?.role || "assistantCoach";
      const email = value.email.trim().toLowerCase();
      entries.push({ model: teamModels.invite, value: { id: email, email, role, active: assigned, familyId: null, playerIds: [], guardianIds: [] }, context: { teamId }, merge: true });
      const member = (state.members || []).find(item => item.teamId === teamId && item.email?.toLowerCase() === email);
      if (member) entries.push({ model: teamModels.member, value: { ...member, role, active: assigned }, context: { teamId }, merge: true });
    }
    await this.firestore.saveMultiple(entries);
    return value;
  }

  async sendBroadcast(value) {
    await Promise.all(value.teamIds.map(teamId => this.broadcasts.log({
      teamId, id: `${value.id}-${teamId}`, title: value.title, body: value.body, sentByUid: value.sentByUid,
      sentByLabel: "Club office", sentAt: value.sentAt,
    })));
    return value;
  }
}
