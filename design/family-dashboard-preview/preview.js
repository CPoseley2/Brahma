import { familyTemplate } from "../../src/views/templates/family-template.js";
import { FamilyView } from "../../src/views/family-view.js";

const root = document.querySelector("#preview");
root.innerHTML = familyTemplate;
root.querySelector("#family-home").classList.add("active");

const family = {
  id: "family-preview",
  displayName: "River family",
  players: [{ id: "river", firstName: "River", lastName: "Oak", dateOfBirth: "2021-08-20" }],
};

const vm = {
  role: "family",
  selectedFamily: family,
  state: {
    team: {
      philosophy: "Every child belongs. Brave attempts matter more than perfect results. Children learn through movement, imagination, laughter, and play.",
    },
    families: [family],
    players: family.players,
    skillFramework: [
      { id: "movement", skills: [
        { id: "start-stop", familyText: "Starting, stopping, and finding balance" },
        { id: "active-participation", familyText: "Confident participation in movement games" },
      ] },
      { id: "ball", skills: [
        { id: "both-feet", familyText: "Exploring both feet" },
        { id: "dribble-turn", familyText: "Turning with the ball" },
      ] },
      { id: "game", skills: [
        { id: "correct-goal", familyText: "Recognizing which goal to attack" },
        { id: "return-play", familyText: "Rejoining play after the ball stops" },
      ] },
      { id: "social", skills: [
        { id: "space-sharing", familyText: "Sharing space and equipment" },
        { id: "kind-play", familyText: "Kind and fair play" },
        { id: "brave-try", familyText: "Trying again after a miss" },
        { id: "joy", familyText: "Enjoying and exploring the game" },
      ] },
    ],
    observations: [
      { id: "one", playerId: "river", date: "2026-07-27", shared: true,
        celebration: "River invited a teammate into the game and celebrated their goal.",
        nextPlay: "Try a two-person gate game at home.",
        ratings: { "space-sharing": 3, "kind-play": 3, joy: 3 } },
      { id: "two", playerId: "river", date: "2026-07-20", shared: true,
        celebration: "River missed, smiled, and immediately tried the brave shot again.",
        nextPlay: "Build one safe target and take five joyful shots.",
        ratings: { "brave-try": 3, "both-feet": 2, "correct-goal": 2 } },
      { id: "three", playerId: "river", date: "2026-07-13", shared: true,
        celebration: "River stopped the ball, looked up, and found open grass.",
        nextPlay: "Play traffic lights for three minutes.",
        ratings: { "start-stop": 2, "dribble-turn": 2, "return-play": 2 } },
    ],
    games: [{ id: "practice", type: "Practice", status: "Scheduled", date: "2026-08-06", time: "17:00", location: "LeGette Field", opponent: "Week 1 · This Is Our Team" }],
    rsvps: [{ gameId: "practice", playerId: "river", status: "yes" }],
    volunteerSlots: [{ id: "snacks", role: "Snack helper", assigneeFamilyId: null }],
    broadcasts: [{ id: "pizza", title: "Pizza night is tomorrow!", sentAt: "2026-07-27T18:00:00Z" }],
    messages: [{ id: "hello", familyId: family.id }],
  },
  setRsvp(gameId, playerId, status) {
    const item = this.state.rsvps.find(value => value.gameId === gameId && value.playerId === playerId);
    if (item) item.status = status;
  },
};

const view = new FamilyView(root, vm);
view.mount();
view.render();
document.documentElement.dataset.ready = "true";
