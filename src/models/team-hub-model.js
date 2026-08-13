import seed from "../../team-data.json";
import { clone } from "../shared/format.js";

const CURRENT_KEY = "fairOaksU6TeamHub.v2";
const LEGACY_KEY = "fairOaksU6TeamHub.v1";

export class TeamHubModel {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.seed = seed;
    this.state = this.#load();
  }

  #normalize(value = {}) {
    const normalized = {
      ...clone(this.seed), ...value,
      team: { ...this.seed.team, ...(value.team || {}) },
      players: value.players || [], games: value.games || [], eventSlots: value.eventSlots || [],
      volunteerSlots: value.volunteerSlots || [], sessions: value.sessions || [],
      observations: value.observations || [], rsvps: value.rsvps || [],
      broadcasts: value.broadcasts || [], messages: value.messages || [],
      guardians: value.guardians || [], members: value.members || [], invites: value.invites || [], drillCards: value.drillCards || [],
      skillFramework: value.skillFramework || this.seed.skillFramework,
    };
    if (normalized.team.name === "Fair Oaks Soccer U6") normalized.team.name = "Fair Oaks Soccer Club U6";
    return normalized;
  }

  #load() {
    try {
      const current = this.storage.getItem(CURRENT_KEY);
      if (current) return this.#normalize(JSON.parse(current));
      const legacy = this.storage.getItem(LEGACY_KEY);
      if (legacy) return this.#normalize(JSON.parse(legacy));
    } catch (error) {
      console.warn("Could not restore local team data", error);
    }
    return this.#normalize(clone(this.seed));
  }

  save() { this.storage.setItem(CURRENT_KEY, JSON.stringify(this.state)); }
  replace(value) { this.state = this.#normalize(value); this.save(); }
  reset() { this.state = clone(this.seed); this.save(); }
}
