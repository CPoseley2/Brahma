import teamworkToken from "../assets/tokens/teamwork.png";
import loveToken from "../assets/tokens/love.png";
import braveToken from "../assets/tokens/brave.png";
import tacticsToken from "../assets/tokens/tactics.png";
import { tokenById } from "../data/season-playbook.js";
import { FamilyDashboardViewModel } from "../viewmodels/family-dashboard-view-model.js";
import { ageLabel, escapeHtml, formatDate, formatTime } from "../shared/format.js";

const tokenImages = { teamwork: teamworkToken, love: loveToken, brave: braveToken, tactics: tacticsToken };
const tokenChip = id => {
  const token = tokenById(id);
  return token ? `<span class="token-chip ${token.className}">${escapeHtml(token.name)}</span>` : "";
};

export class FamilyView {
  constructor(root, vm) {
    this.root = root;
    this.vm = vm;
    this.dashboard = new FamilyDashboardViewModel(vm);
    this.playerId = "";
    this.tokenId = "teamwork";
    this.rsvpMessage = "";
    this.rsvpError = "";
  }

  mount() {
    this.root.addEventListener("click", event => {
      const playerId = event.target.closest("[data-family-player]")?.dataset.familyPlayer;
      const tokenId = event.target.closest("[data-family-token]")?.dataset.familyToken;
      if (playerId) { this.playerId = playerId; this.render(); }
      if (tokenId) { this.tokenId = tokenId; this.render(); }
    });
    this.root.addEventListener("change", event => {
      const select = event.target.closest("[data-family-rsvp]");
      if (select) this.#changeRsvp(select);
    });
  }

  render() {
    if (this.vm.role !== "family") return;
    const snapshot = this.dashboard.snapshot(this.playerId);
    if (!snapshot.player) return;
    this.playerId = snapshot.player.id;
    if (!snapshot.tokens.some(token => token.id === this.tokenId)) this.tokenId = snapshot.tokens[0]?.id || "";
    this.#renderHero(snapshot);
    this.#renderPlayers(snapshot);
    this.#renderNextEvent(snapshot);
    this.#renderTokens(snapshot);
    this.#renderStory(snapshot);
    this.#renderActions(snapshot);
    this.root.querySelector("#myPlayerContent").innerHTML = snapshot.family.players
      .map(player => this.#playerDetail(player))
      .join("");
  }

  #renderHero({ family, player, observations }) {
    const familyName = family.displayName || family.label || "Soccer family";
    const latest = observations[0];
    this.root.querySelector("#familyHero").innerHTML = `
      <div><p class="eyebrow">Family season home</p><h2>Hi, ${escapeHtml(familyName)}.</h2>
      <p>${escapeHtml(this.vm.state.team.philosophy || "")}</p></div>
      <div class="family-hero-celebration"><span>Latest high-five for ${escapeHtml(player.firstName)}</span>
      <strong>${escapeHtml(latest?.celebration || "The season story begins with the first shared coach celebration.")}</strong></div>`;
  }

  #renderPlayers({ family, player }) {
    this.root.querySelector("#familyPlayerPicker").innerHTML = family.players.length < 2 ? "" : `
      <span>Whose story?</span>${family.players.map(item => `
      <button data-family-player="${item.id}" class="${item.id === player.id ? "active" : ""}">
      ${escapeHtml(item.firstName)}</button>`).join("")}`;
  }

  #renderNextEvent({ player, nextEvent }) {
    const container = this.root.querySelector("#familyNextEvent");
    if (!nextEvent) {
      container.innerHTML = `<p class="eyebrow dark">Next up</p><h2>A little open space</h2>
        <p>The next team event has not been posted yet.</p><button class="button" data-route="schedule">Open schedule</button>`;
      return;
    }
    container.innerHTML = `<div><p class="eyebrow">${escapeHtml(nextEvent.when)}</p>
      <h2>${escapeHtml(nextEvent.type)} · ${formatDate(nextEvent.date)}</h2>
      <p>${formatTime(nextEvent.time)} · ${escapeHtml(nextEvent.location || "Location TBD")}</p>
      <span>${escapeHtml(nextEvent.opponent || "Team event")}</span>
      <div class="family-availability">${nextEvent.limited ? `<strong>${nextEvent.available}</strong> of ${nextEvent.capacity} slots available` : "No attendance limit"}</div></div>
      <label class="family-rsvp"><span>${escapeHtml(player.firstName)}’s RSVP</span>
      <select data-family-rsvp data-event-id="${nextEvent.id}" data-player-id="${player.id}">
      <option value="" disabled ${!nextEvent.rsvp ? "selected" : ""}>Choose…</option>
      <option value="yes" ${nextEvent.rsvp === "yes" ? "selected" : ""} ${nextEvent.limited && nextEvent.available === 0 && nextEvent.rsvp !== "yes" ? "disabled" : ""}>We’re going${nextEvent.limited && nextEvent.available === 0 && nextEvent.rsvp !== "yes" ? " · Full" : ""}</option>
      <option value="maybe" ${nextEvent.rsvp === "maybe" ? "selected" : ""}>Maybe</option>
      <option value="no" ${nextEvent.rsvp === "no" ? "selected" : ""}>Can’t make it</option>
      </select>${nextEvent.rsvp === "yes" ? `<strong class="attending-state">✓ Attending · your spot is reserved</strong>` : ""}<button class="button" data-route="schedule">Full schedule</button>${this.rsvpError ? `<small class="rsvp-error">${escapeHtml(this.rsvpError)}</small>` : this.rsvpMessage ? `<small class="rsvp-success">${escapeHtml(this.rsvpMessage)}</small>` : ""}</label>`;
  }
  async #changeRsvp(select) {
    select.disabled = true; this.rsvpMessage = ""; this.rsvpError = "";
    try { this.rsvpMessage = await this.vm.setRsvp(select.dataset.eventId, select.dataset.playerId, select.value); }
    catch (error) { this.rsvpError = error.message; }
    finally { select.disabled = false; this.render(); }
  }

  #renderTokens({ player, tokens }) {
    this.root.querySelector("#familyTokenChart").innerHTML = tokens.map(token => `
      <button class="family-token-card ${token.id} ${token.id === this.tokenId ? "active" : ""}"
        data-family-token="${token.id}" aria-pressed="${token.id === this.tokenId}">
        <span class="token-art"><img src="${tokenImages[token.id]}" alt=""></span>
        <span class="token-ring" style="--token-progress:${token.progress * 3.6}deg">
          <span><strong>${token.noticed.length}</strong><small>noticed</small></span>
        </span>
        <span class="token-card-copy"><strong>${escapeHtml(token.name)}</strong>
        <small>${escapeHtml(token.milestone)}</small></span>
      </button>`).join("");
    const token = tokens.find(item => item.id === this.tokenId) || tokens[0];
    this.root.querySelector("#familyTokenDetail").innerHTML = `
      <div><p class="eyebrow dark">${escapeHtml(player.firstName)}’s ${escapeHtml(token.name)} milestone</p>
      <h3>${escapeHtml(token.milestone)}</h3>
      <p>${escapeHtml(token.promise)}</p></div>
      <div><strong>Moments shared by the coach</strong><div class="skill-cloud">
      ${token.noticed.length ? token.noticed.map(item => `<span class="skill-chip">${escapeHtml(item)}</span>`).join("")
        : `<span class="muted">This token wakes up as coach-shared moments arrive.</span>`}</div></div>
      <div class="family-home-play"><strong>Try it together</strong><p>${escapeHtml(token.homePlay)}</p></div>`;
  }

  #renderStory({ player, timeline }) {
    this.root.querySelector("#familyStoryPreview").innerHTML = timeline.slice(0, 3).map(item => `
      <article><time>${formatDate(item.date)}</time><div>
      <div class="story-token-row">${item.tokenIds.map(tokenChip).join("")}</div>
      <h3>${escapeHtml(item.celebration || `${player.firstName} was noticed in play.`)}</h3>
      <p>${escapeHtml(item.nextPlay || "Keep playing and exploring together.")}</p></div></article>`).join("")
      || `<div class="empty-state">The first coach-shared celebration will begin ${escapeHtml(player.firstName)}’s season story.</div>`;
  }

  #renderActions({ actions }) {
    const broadcast = actions.latestBroadcast;
    this.root.querySelector("#familyActionCenter").innerHTML = `
      <p class="eyebrow dark">Family action center</p><h2>Stay connected</h2>
      ${broadcast ? `<div class="family-broadcast"><span>Latest team note</span>
      <strong>${escapeHtml(broadcast.title)}</strong></div>` : ""}
      <div class="family-action-grid">
      <button data-route="messages"><strong>Coach messages</strong><span>${actions.messageCount} in your private thread</span></button>
      <button data-route="volunteers"><strong>Help the team</strong><span>${actions.openVolunteers} open · ${actions.familyVolunteers} yours</span></button>
      <button data-route="team-philosophy"><strong>How we coach</strong><span>Our promises to every child</span></button></div>`;
  }

  #playerDetail(player) {
    const observations = this.vm.state.observations
      .filter(item => item.playerId === player.id && item.shared === true)
      .sort((a, b) => b.date.localeCompare(a.date));
    const timeline = observations.map(item => `<article class="season-story-entry">
      <time>${formatDate(item.date)}</time><div><h3>${escapeHtml(item.celebration || "A moment in play")}</h3>
      <p>${escapeHtml(item.nextPlay || "Keep playing and exploring together.")}</p></div></article>`).join("");
    return `<article class="panel family-player-detail"><div class="player-card-head"><div>
      <p class="eyebrow dark">Player season story</p><h2>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</h2>
      </div><span class="badge">${ageLabel(player.dateOfBirth)}</span></div>
      <div class="season-story-timeline">${timeline || `<div class="empty-state">No family-facing updates have been shared yet.</div>`}</div></article>`;
  }
}
