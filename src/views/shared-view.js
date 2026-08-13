import { escapeHtml, formatDate, formatTime } from "../shared/format.js";

const empty = message => `<div class="empty-state">${message}</div>`;

export class SharedView {
  constructor(root, vm, dialogs, eventDialog) { this.root = root; this.vm = vm; this.dialogs = dialogs; this.eventDialog = eventDialog; this.scheduleMessage = ""; this.scheduleError = ""; }
  mount() {
    this.root.addEventListener("click", event => this.#onClick(event));
    this.root.addEventListener("schedule-feedback", event => { this.scheduleMessage = event.detail.message; this.scheduleError = ""; this.renderSchedule(); });
    this.root.addEventListener("change", event => {
      const select = event.target.closest("[data-rsvp]");
      if (select) this.#changeRsvp(select);
    });
  }
  async #onClick(event) {
    const target = event.target.closest("[data-action]"); if (!target) return;
    const { action, id } = target.dataset;
    if (action === "new-game") this.eventDialog.open();
    if (action === "edit-game") this.eventDialog.open(id, "occurrence");
    if (action === "edit-game-series") this.eventDialog.open(id, "series");
    if (action === "delete-game") await this.#deleteOccurrence(id);
    if (action === "delete-game-series") await this.#deleteSeries(id);
    if (action === "new-volunteer") this.dialogs.openVolunteer();
    if (action === "edit-volunteer") this.dialogs.openVolunteer(id);
    if (action === "delete-volunteer" && confirm("Delete this volunteer job?")) this.vm.remove("volunteerSlots", id);
    if (action === "claim-volunteer") this.vm.claimVolunteer(id);
    if (action === "release-volunteer") this.vm.releaseVolunteer(id);
  }
  render() { this.renderSchedule(); this.renderVolunteers(); }
  renderSchedule() {
    const family = this.vm.selectedFamily;
    this.root.querySelector("#scheduleDescription").textContent = this.vm.role === "coach" ? "Manage team games, practices, and events." : "View the team calendar and respond for your player.";
    const feedback = this.root.querySelector("#scheduleFeedback");
    feedback.innerHTML = this.scheduleError ? `<div class="login-message error">${escapeHtml(this.scheduleError)}</div>` : this.scheduleMessage ? `<div class="login-message success">${escapeHtml(this.scheduleMessage)}</div>` : "";
    const games = [...this.vm.state.games].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    this.root.querySelector("#gamesList").innerHTML = games.map(game => {
      const availability = this.vm.eventAvailability(game.id);
      const availabilityBadge = availability.limited
        ? `<span class="badge ${availability.available === 0 ? "gold" : "blue"}">${availability.available} of ${availability.capacity} slots available</span>`
        : `<span class="badge gray">No attendance limit</span>`;
      const rsvpRoster = this.vm.eventRsvpRoster(game.id);
      const coachRsvp = this.vm.role === "coach" ? `<button type="button" class="badge blue rsvp-summary-button" data-action="view-rsvps" data-id="${escapeHtml(game.id)}" aria-label="View RSVP roster for this event">${rsvpRoster.attending} attending</button>` : "";
      const familyActions = this.vm.role === "family" && family ? `<div class="family-rsvps">${family.players.map(player => {
        const current = this.vm.state.rsvps.find(item => item.gameId === game.id && item.playerId === player.id)?.status || "";
        const attending = current === "yes";
        const full = availability.limited && availability.available === 0 && !attending;
        return `<div class="attendance-row"><span>${escapeHtml(player.firstName)} ${attending ? `<span class="badge blue">Attending</span>` : ""}</span><select data-rsvp data-game-id="${game.id}" data-player-id="${player.id}"><option value="" disabled ${!current ? "selected" : ""}>Choose RSVP…</option><option value="yes" ${attending ? "selected" : ""} ${full ? "disabled" : ""}>Going${full ? " · Full" : ""}</option><option value="no" ${current === "no" ? "selected" : ""}>Not going</option><option value="maybe" ${current === "maybe" ? "selected" : ""}>Maybe</option></select></div>`;
      }).join("")}</div>` : "";
      const seriesActions = game.seriesId ? `<button class="button small" data-action="edit-game-series" data-id="${game.id}">Edit series</button><button class="button small danger" data-action="delete-game-series" data-id="${game.id}">Delete series</button>` : "";
      const actions = this.vm.role === "coach" ? `<div class="button-row event-actions"><button class="button small" data-action="edit-game" data-id="${game.id}">Edit this event</button>${seriesActions}<button class="button small danger" data-action="delete-game" data-id="${game.id}">Delete this event</button></div>` : "";
      return `<article class="list-card"><div><div class="name">${formatDate(game.date)} · ${formatTime(game.time)}</div><p>${escapeHtml(game.type)} · ${escapeHtml(game.opponent || "TBD")} · ${escapeHtml(game.location || "Location TBD")}</p>${game.notes ? `<p class="small muted">${escapeHtml(game.notes)}</p>` : ""}<div class="button-row event-badges"><span class="badge">${escapeHtml(game.status)}</span>${coachRsvp}${availabilityBadge}${game.seriesId ? `<span class="badge blue">Recurring series</span>` : ""}</div>${familyActions}</div>${actions}</article>`;
    }).join("") || empty("No team events have been entered yet.");
  }
  async #changeRsvp(select) {
    select.disabled = true; this.scheduleError = ""; this.scheduleMessage = "";
    try { this.scheduleMessage = await this.vm.setRsvp(select.dataset.gameId, select.dataset.playerId, select.value); }
    catch (error) { this.scheduleError = error.message; }
    finally { select.disabled = false; this.renderSchedule(); }
  }
  async #deleteOccurrence(id) {
    const item = this.vm.state.games.find(event => event.id === id); if (!item) return;
    const detail = item.seriesId ? "The other events in this recurring series will remain." : "This cannot be undone.";
    if (!confirm(`Delete ${item.type.toLowerCase()} on ${formatDate(item.date)}?\n\n${detail}`)) return;
    try { await this.vm.deleteEventOccurrence(id); this.scheduleError = ""; this.scheduleMessage = `Deleted the ${item.type.toLowerCase()} on ${formatDate(item.date)}. ${item.seriesId ? "The rest of the series was not changed." : ""}`; }
    catch (error) { this.scheduleError = error.message; this.scheduleMessage = ""; }
    this.renderSchedule();
  }
  async #deleteSeries(id) {
    const item = this.vm.state.games.find(event => event.id === id); if (!item?.seriesId) return;
    const count = this.vm.state.games.filter(event => event.seriesId === item.seriesId).length;
    if (!confirm(`Delete the entire recurring series?\n\nThis will permanently delete all ${count} events in the series.`)) return;
    try { const deleted = await this.vm.deleteEventSeries(item.seriesId); this.scheduleError = ""; this.scheduleMessage = `Deleted the recurring series and all ${deleted} of its events.`; }
    catch (error) { this.scheduleError = error.message; this.scheduleMessage = ""; }
    this.renderSchedule();
  }
  renderVolunteers() {
    const family = this.vm.selectedFamily; const familyMap = new Map(this.vm.families.map(item => [item.id, item.label || item.displayName]));
    this.root.querySelector("#volunteerDescription").textContent = this.vm.role === "coach" ? "Create and assign team jobs." : "Claim an open job or review your family’s assignments.";
    const slots = [...this.vm.state.volunteerSlots].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    this.root.querySelector("#volunteerList").innerHTML = slots.map(slot => {
      const mine = family && slot.assigneeFamilyId === family.id; const open = !slot.assigneeFamilyId;
      let action = "";
      if (this.vm.role === "coach") action = `<div class="button-row"><button class="button small" data-action="edit-volunteer" data-id="${slot.id}">Edit</button><button class="button small danger" data-action="delete-volunteer" data-id="${slot.id}">Delete</button></div>`;
      else if (open) action = `<button class="button small primary" data-action="claim-volunteer" data-id="${slot.id}">Claim</button>`;
      else if (mine) action = `<button class="button small" data-action="release-volunteer" data-id="${slot.id}">Release</button>`;
      return `<div class="list-card"><div><div class="name">${escapeHtml(slot.role)}</div><p>${formatDate(slot.date)} · <span class="badge">${open ? "Open" : mine ? "Your family" : escapeHtml(familyMap.get(slot.assigneeFamilyId) || "Assigned")}</span></p>${slot.notes ? `<p class="small muted">${escapeHtml(slot.notes)}</p>` : ""}</div>${action}</div>`;
    }).join("") || empty("No volunteer jobs have been created yet.");
    const open = slots.filter(slot => !slot.assigneeFamilyId).length; const filled = slots.length - open; const mine = family ? slots.filter(slot => slot.assigneeFamilyId === family.id).length : 0;
    this.root.querySelector("#volunteerSummary").innerHTML = this.vm.role === "coach" ? `<strong>${filled}</strong> filled · <strong>${open}</strong> open` : `<strong>${mine}</strong> assigned to your family · <strong>${open}</strong> open`;
  }
}
