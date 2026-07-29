import { tokenDomains } from "../data/season-playbook.js";
import { todayIso } from "../shared/format.js";

export const familyTokenMilestones = [
  {
    id: "teamwork",
    skillIds: ["simple-direction", "space-sharing", "kind-play"],
    homePlay: "Invite someone into a two-person gate game. Celebrate helpful passes and shared space.",
  },
  {
    id: "love",
    skillIds: ["active-participation", "joy"],
    homePlay: "Let your child invent one silly ball mission, then follow their rules with full enthusiasm.",
  },
  {
    id: "brave",
    skillIds: ["both-feet", "approach-ball", "strike-forward", "shoot-goal", "brave-try"],
    homePlay: "Build a safe target and celebrate every attempt—including the misses and immediate retries.",
  },
  {
    id: "tactics",
    skillIds: ["start-stop", "change-direction", "balance-jump", "close-dribble", "stop-ball", "dribble-turn", "boundaries", "correct-goal", "return-play"],
    homePlay: "Set up two tiny goals. Ask which one is open, then let your child change the plan.",
  },
].map(config => ({ ...tokenDomains.find(token => token.id === config.id), ...config }));

const milestoneLabel = progress => {
  if (progress === 0) return "Ready to discover";
  if (progress < 34) return "Exploring";
  if (progress < 67) return "Growing";
  if (progress < 90) return "Showing in play";
  return "Shining";
};

const daysBetween = (from, to) => Math.round((
  new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)
) / 86400000);

export class FamilyDashboardViewModel {
  constructor(app, referenceDate = todayIso()) {
    this.app = app;
    this.referenceDate = referenceDate;
  }

  snapshot(playerId = "") {
    const family = this.app.selectedFamily;
    const player = family?.players.find(item => item.id === playerId) || family?.players[0] || null;
    if (!family || !player) return { family, player: null, tokens: [], timeline: [], nextEvent: null };
    const observations = this.#sharedObservations(player.id);
    const levels = this.#latestLevels(observations);
    return {
      family,
      player,
      observations,
      tokens: this.#tokens(levels),
      timeline: observations.map(item => this.#timelineItem(item)),
      nextEvent: this.#nextEvent(player.id),
      actions: this.#familyActions(family.id),
    };
  }

  #sharedObservations(playerId) {
    return this.app.state.observations
      .filter(item => item.playerId === playerId && item.shared === true)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  #latestLevels(observations) {
    const levels = {};
    [...observations].reverse().forEach(item => {
      Object.entries(item.ratings || {}).forEach(([id, value]) => { levels[id] = Number(value); });
    });
    return levels;
  }

  #tokens(levels) {
    const skills = new Map(this.app.state.skillFramework
      .flatMap(group => group.skills)
      .map(skill => [skill.id, skill]));
    return familyTokenMilestones.map(token => {
      const values = token.skillIds.map(id => Number(levels[id] || 0));
      const progress = Math.round(values.reduce((sum, value) => sum + value, 0) / (values.length * 3) * 100);
      const noticed = token.skillIds.filter(id => Number(levels[id] || 0) > 0)
        .map(id => skills.get(id)?.familyText)
        .filter(Boolean);
      return { ...token, progress, milestone: milestoneLabel(progress), noticed };
    });
  }

  #timelineItem(observation) {
    const ratings = observation.ratings || {};
    const tokenIds = familyTokenMilestones
      .map(token => ({
        id: token.id,
        score: token.skillIds.reduce((sum, id) => sum + Number(ratings[id] || 0), 0),
      }))
      .filter(token => token.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(token => token.id);
    return { ...observation, tokenIds };
  }

  #nextEvent(playerId) {
    const event = [...this.app.state.games]
      .filter(item => item.status === "Scheduled" && item.date >= this.referenceDate)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
    if (!event) return null;
    const days = daysBetween(this.referenceDate, event.date);
    const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    const rsvp = this.app.state.rsvps
      .find(item => item.gameId === event.id && item.playerId === playerId)?.status || "";
    return { ...event, when, rsvp };
  }

  #familyActions(familyId) {
    const volunteers = this.app.state.volunteerSlots || [];
    const broadcasts = [...(this.app.state.broadcasts || [])]
      .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
    return {
      openVolunteers: volunteers.filter(item => !item.assigneeFamilyId).length,
      familyVolunteers: volunteers.filter(item => item.assigneeFamilyId === familyId).length,
      messageCount: (this.app.state.messages || []).length,
      latestBroadcast: broadcasts[0] || null,
    };
  }
}
