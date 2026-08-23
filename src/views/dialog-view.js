import { escapeHtml, formatDate, formatDateTime, formatTime, todayIso, uid } from "../shared/format.js";

const formValue = (form, name) => form.elements.namedItem(name).value;
const setValues = (form, item, names) => names.forEach(name => { form.elements.namedItem(name).value = item?.[name] ?? ""; });

export class DialogView {
  constructor(root, vm) { this.root = root; this.vm = vm; }
  mount() {
    this.root.addEventListener("click", event => {
      const button = event.target.closest("[data-save]");
      if (button) this.#save(event, button.dataset.save);
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "add-guardian") this.openGuardian(this.root.querySelector("#playerForm").elements.id.value);
      if (action === "edit-guardian") this.openGuardian("", event.target.closest("[data-guardian-id]").dataset.guardianId);
      if (action === "revoke-guardian") this.#revokeGuardian(event.target.closest("[data-guardian-id]").dataset.guardianId);
      if (action === "close-guardian") this.root.querySelector("#guardianDialog").close();
      if (action === "close-coach-promotion") this.root.querySelector("#coachPromotionDialog").close();
      if (action === "promote-contact") this.openCoachPromotion(event.target.closest("[data-candidate-id]").dataset.candidateId);
      if (action === "close-coach-invite") this.root.querySelector("#coachInviteDialog").close();
      if (action === "view-rsvps") this.openRsvpRoster(event.target.closest("[data-id]").dataset.id);
      if (action === "close-rsvp-roster") this.root.querySelector("#rsvpRosterDialog").close();
    });
    this.root.querySelector("#guardianForm").addEventListener("submit", event => this.#saveGuardian(event));
    this.root.querySelector("#coachPromotionForm").addEventListener("submit", event => this.#promoteCoach(event));
    this.root.querySelector("#coachInviteForm").addEventListener("submit", event => this.#inviteCoach(event));
  }
  render() {
    const playerDialog = this.root.querySelector("#playerDialog");
    if (playerDialog?.open) this.#renderGuardians(playerDialog.querySelector("form").elements.id.value);
  }
  openObservation(playerId = "", id = "") {
    const dialog = this.root.querySelector("#observationDialog"); const form = dialog.querySelector("form"); const item = this.vm.state.observations.find(value => value.id === id);
    form.elements.id.value = item?.id || "";
    form.elements.playerId.innerHTML = this.vm.activePlayers.sort((a, b) => a.firstName.localeCompare(b.firstName)).map(player => `<option value="${player.id}">${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</option>`).join("");
    form.elements.playerId.value = item?.playerId || playerId || form.elements.playerId.options[0]?.value || "";
    form.elements.date.value = item?.date || todayIso(); form.elements.celebration.value = item?.celebration || ""; form.elements.nextPlay.value = item?.nextPlay || ""; form.elements.privateNote.value = item?.privateNote || ""; form.elements.shared.checked = item?.shared ?? true;
    const ratings = item?.ratings || {};
    form.querySelector("[data-field=skills]").innerHTML = this.vm.state.skillFramework.map(group => `<div class="skill-group"><h3>${escapeHtml(group.name)}</h3>${group.skills.map(skill => `<div class="skill-row" data-skill="${skill.id}"><span>${escapeHtml(skill.name)}</span>${["Not seen", "Exploring", "Emerging", "In play"].map((label, level) => `<button type="button" class="level-button ${Number(ratings[skill.id] ?? 0) === level ? "selected" : ""}" data-level="${level}">${label}</button>`).join("")}</div>`).join("")}</div>`).join("");
    form.querySelectorAll(".level-button").forEach(button => button.addEventListener("click", () => { button.parentElement.querySelectorAll(".level-button").forEach(item => item.classList.remove("selected")); button.classList.add("selected"); }));
    dialog.showModal();
  }
  openSession(eventId, sessionId = "") {
    const dialog = this.root.querySelector("#sessionDialog"); const form = dialog.querySelector("form");
    const event = this.vm.state.games.find(value => value.id === eventId); if (!event || String(event.type).toLowerCase() !== "practice") return;
    const item = this.vm.state.sessions.find(value => value.id === sessionId) || this.vm.sessionForPractice(eventId);
    form.elements.id.value = item?.id || ""; form.elements.eventId.value = event.id;
    form.elements.title.value = event.opponent || "Practice"; form.elements.date.value = event.date; form.elements.notes.value = item?.notes || "";
    form.querySelector("#sessionEventSummary").innerHTML = `<strong>${formatDate(event.date)} · ${formatTime(event.time)}</strong><br>${escapeHtml(event.location || "Location TBD")}. Date, time, and location are managed from Schedule.`;
    form.elements.focusSkillIds.innerHTML = this.vm.state.skillFramework.map(group => `<option value="${group.id}" ${(item?.focusSkillIds || []).includes(group.id) ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    form.querySelector("[data-field=attendance]").innerHTML = this.vm.activePlayers.sort((a, b) => a.firstName.localeCompare(b.firstName)).map(player => `<div class="attendance-row"><span>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</span><select data-player="${player.id}"><option value="">Not set</option><option value="present" ${(item?.attendance || {})[player.id] === "present" ? "selected" : ""}>Present</option><option value="absent" ${(item?.attendance || {})[player.id] === "absent" ? "selected" : ""}>Absent</option><option value="late" ${(item?.attendance || {})[player.id] === "late" ? "selected" : ""}>Late</option></select></div>`).join("");
    dialog.showModal();
  }
  openPlayer(id = "") {
    const dialog = this.root.querySelector("#playerDialog"); const form = dialog.querySelector("form"); const item = this.vm.state.players.find(value => value.id === id);
    form.querySelector("[data-title]").textContent = item ? "Edit player" : "Add player";
    setValues(form, item, ["id", "firstName", "lastName", "dateOfBirth", "gender", "familyEmail", "familyPhone", "notes"]);
    form.elements.active.value = String(item?.active ?? true);
    this.#renderGuardians(item?.id || "");
    dialog.showModal();
  }
  openGuardian(playerId = "", id = "") {
    const guardian = this.vm.guardianRelationships.find(item => item.id === id);
    const selectedPlayerId = guardian?.playerId || playerId;
    if (!selectedPlayerId) return alert("Save the player before adding guardian access.");
    const dialog = this.root.querySelector("#guardianDialog"); const form = dialog.querySelector("form");
    form.reset();
    form.elements.id.value = guardian?.id || "";
    form.elements.playerId.value = selectedPlayerId;
    form.elements.name.value = guardian?.name || "";
    form.elements.email.value = guardian?.email || "";
    form.elements.email.readOnly = Boolean(guardian);
    form.elements.relationship.value = guardian?.relationship || "parent";
    form.querySelector("[data-title]").textContent = guardian ? "Edit guardian" : "Add guardian";
    form.querySelector("[type=submit]").textContent = guardian ? "Save changes" : "Save & allow access";
    form.querySelector("#guardianFormFeedback").innerHTML = "";
    dialog.showModal();
  }
  openCoachPromotion(candidateId = "") {
    const dialog = this.root.querySelector("#coachPromotionDialog"); const form = dialog.querySelector("form");
    const candidates = this.vm.coachPromotionCandidates;
    form.reset();
    form.elements.candidate.innerHTML = candidates.length
      ? `<option value="">Choose a roster contact</option>${candidates.map(candidate => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)} — ${escapeHtml(candidate.email)} — ${escapeHtml(candidate.playerName)}</option>`).join("")}`
      : `<option value="">No eligible parent contacts</option>`;
    form.elements.candidate.disabled = !candidates.length;
    if (candidateId && candidates.some(candidate => candidate.id === candidateId)) form.elements.candidate.value = candidateId;
    form.querySelector("[type=submit]").disabled = !candidates.length;
    form.querySelector("[type=submit]").textContent = "Review & add coach";
    form.querySelector("#coachPromotionFeedback").innerHTML = candidates.length ? "" : `<div class="login-message">Add a parent email or guardian relationship to a player before promoting them.</div>`;
    dialog.showModal();
  }
  openCoachInvite() {
    const dialog = this.root.querySelector("#coachInviteDialog"); const form = dialog.querySelector("form");
    form.reset();
    form.querySelector("[type=submit]").disabled = false;
    form.querySelector("[type=submit]").textContent = "Send coach invite";
    form.querySelector("#coachInviteFeedback").innerHTML = "";
    dialog.showModal();
  }
  openRsvpRoster(eventId) {
    if (this.vm.role !== "coach") return;
    const event = this.vm.state.games.find(item => item.id === eventId); if (!event) return;
    const roster = this.vm.eventRsvpRoster(eventId);
    const dialog = this.root.querySelector("#rsvpRosterDialog");
    dialog.querySelector("#rsvpRosterTitle").textContent = `${event.type || "Event"} RSVP roster`;
    dialog.querySelector("#rsvpRosterEvent").textContent = `${formatDate(event.date)} · ${formatTime(event.time)} · ${event.location || "Location TBD"}`;
    dialog.querySelector("#rsvpRosterSummary").innerHTML = `<strong>${roster.attending} attending</strong><span>${roster.declined} not attending</span><span>${roster.maybe} maybe</span><span>${roster.noResponse} no response</span>`;
    dialog.querySelector("#rsvpRosterList").innerHTML = roster.players.map(player => {
      const status = player.rsvpStatus === "yes"
        ? { icon: "✓", label: "Attending", className: "yes" }
        : player.rsvpStatus === "no"
          ? { icon: "×", label: "Not attending", className: "no" }
          : player.rsvpStatus === "maybe"
            ? { icon: "?", label: "Maybe", className: "maybe" }
            : { icon: "?", label: "No response", className: "none" };
      return `<div class="rsvp-roster-row"><span class="rsvp-status-icon ${status.className}" aria-hidden="true">${status.icon}</span><strong>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</strong><span>${status.label}</span></div>`;
    }).join("") || `<div class="empty-state">No active players are on the roster.</div>`;
    dialog.showModal();
  }
  openVolunteer(id = "") {
    const dialog = this.root.querySelector("#volunteerDialog"); const form = dialog.querySelector("form"); const item = this.vm.state.volunteerSlots.find(value => value.id === id);
    form.querySelector("[data-title]").textContent = item ? "Edit volunteer job" : "Add volunteer job";
    setValues(form, item, ["id", "role", "date", "notes"]); form.elements.assigneeKey.innerHTML = `<option value="">Open</option>${this.vm.families.map(family => `<option value="${escapeHtml(family.id)}">${escapeHtml(family.label || family.displayName)}</option>`).join("")}`; form.elements.assigneeKey.value = item?.assigneeFamilyId || ""; dialog.showModal();
  }
  showHistory(playerId) {
    const player = this.vm.player(playerId); const history = this.vm.state.observations.filter(item => item.playerId === playerId).sort((a, b) => b.date.localeCompare(a.date));
    if (!history.length) return alert(`No observation history for ${player.firstName} yet.`);
    alert(`${player.firstName} ${player.lastName}\n\n${history.map(item => `${formatDate(item.date)}\nCelebration: ${item.celebration || "—"}\nNext: ${item.nextPlay || "—"}\nPrivate: ${item.privateNote || "—"}`).join("\n\n")}`);
  }
  #save(event, type) {
    const form = event.target.form; if (!form.reportValidity()) { event.preventDefault(); return; }
    const handlers = { observation: () => this.#saveObservation(form), session: () => this.#saveSession(form), player: () => this.#savePlayer(form), volunteer: () => this.#saveVolunteer(form) };
    handlers[type](); form.closest("dialog").close();
  }
  #saveObservation(form) { const ratings = {}; form.querySelectorAll("[data-skill]").forEach(row => { ratings[row.dataset.skill] = Number(row.querySelector(".selected")?.dataset.level || 0); }); this.vm.upsert("observations", { id: formValue(form, "id") || uid("obs"), playerId: formValue(form, "playerId"), date: formValue(form, "date"), ratings, celebration: formValue(form, "celebration").trim(), nextPlay: formValue(form, "nextPlay").trim(), privateNote: formValue(form, "privateNote").trim(), shared: form.elements.shared.checked }); }
  #saveSession(form) { const attendance = {}; form.querySelectorAll("[data-player]").forEach(select => { attendance[select.dataset.player] = select.value; }); this.vm.upsert("sessions", { id: formValue(form, "id") || uid("session"), eventId: formValue(form, "eventId"), date: formValue(form, "date"), title: formValue(form, "title").trim(), notes: formValue(form, "notes").trim(), focusSkillIds: [...form.elements.focusSkillIds.selectedOptions].map(option => option.value), attendance }); }
  #savePlayer(form) { this.vm.upsert("players", { id: formValue(form, "id") || uid("player"), firstName: formValue(form, "firstName").trim(), lastName: formValue(form, "lastName").trim(), dateOfBirth: formValue(form, "dateOfBirth"), gender: formValue(form, "gender"), familyEmail: formValue(form, "familyEmail").trim(), familyPhone: formValue(form, "familyPhone").trim(), notes: formValue(form, "notes").trim(), active: formValue(form, "active") === "true" }); }
  #saveVolunteer(form) { this.vm.upsert("volunteerSlots", { id: formValue(form, "id") || uid("vol"), role: formValue(form, "role").trim(), date: formValue(form, "date"), notes: formValue(form, "notes").trim(), assigneeFamilyId: formValue(form, "assigneeKey") || null }); }
  #renderGuardians(playerId) {
    const section = this.root.querySelector("#playerGuardiansSection");
    section.classList.remove("hidden");
    const list = section.querySelector("#playerGuardianList");
    const addButton = section.querySelector("[data-action=add-guardian]");
    addButton.classList.toggle("hidden", !this.vm.isHeadCoach);
    const player = this.vm.player(playerId);
    const primaryMember = this.vm.memberForEmail(player?.familyEmail);
    const primaryCoach = this.vm.hasCoachPrivileges(player?.familyEmail) ? `<span class="badge gold guardian-status">Coach</span>` : "";
    const primaryStatus = primaryMember
      ? `<span class="badge blue guardian-status">Joined</span>${primaryCoach}<small class="muted">${primaryMember.lastLoginAt ? `Last login ${formatDateTime(primaryMember.lastLoginAt)}` : "Last login not recorded yet"}</small>`
      : player?.familyEmail ? `<span class="badge gold guardian-status">Invited</span>${primaryCoach}<small class="muted">No successful login recorded.</small>` : "";
    section.querySelector("#playerPrimaryContact").innerHTML = player && (player.familyEmail || player.familyPhone)
      ? `<article class="guardian-card primary-contact-card"><div><strong>Primary roster contact</strong>${primaryStatus}<p>${escapeHtml(player.familyEmail || "No email")}${player.familyPhone ? ` · ${escapeHtml(player.familyPhone)}` : ""}</p></div></article>`
      : "";
    if (!playerId) {
      list.innerHTML = `<div class="empty-state">Save this player first, then reopen the profile to add guardians.</div>`;
      addButton.disabled = true;
      return;
    }
    addButton.disabled = false;
    list.innerHTML = this.vm.guardiansForPlayer(playerId).map(guardian => {
      const member = this.vm.memberForEmail(guardian.email);
      const joined = Boolean(member);
      const coach = this.vm.hasCoachPrivileges(guardian.email) ? `<span class="badge gold guardian-status">Coach</span>` : "";
      const relationship = guardian.relationship.replace(/\b\w/g, character => character.toUpperCase());
      const actions = this.vm.isHeadCoach ? `<div class="guardian-card-actions"><button type="button" class="button small" data-action="edit-guardian" data-guardian-id="${escapeHtml(guardian.id)}">Edit</button><button type="button" class="button small danger" data-action="revoke-guardian" data-guardian-id="${escapeHtml(guardian.id)}">Revoke</button></div>` : "";
      const login = joined
        ? `<small class="muted">${member.lastLoginAt ? `Last login ${formatDateTime(member.lastLoginAt)}` : "Last login not recorded yet"}</small>`
        : `<small class="muted">Invitation has not been accepted.</small>`;
      return `<article class="guardian-card"><div><strong>${escapeHtml(guardian.name)}</strong><span class="badge ${joined ? "blue" : "gold"} guardian-status">${joined ? "Joined" : "Invited"}</span>${coach}<p>${escapeHtml(relationship)} · <span class="guardian-email">${escapeHtml(guardian.email)}</span></p>${login}</div>${actions}</article>`;
    }).join("") || `<div class="empty-state">No guardians have been invited for this player.</div>`;
  }
  async #saveGuardian(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]"); const feedback = form.querySelector("#guardianFormFeedback");
    button.disabled = true; feedback.innerHTML = "";
    try {
      const id = formValue(form, "id");
      if (id) await this.vm.updateGuardian(id, { name: formValue(form, "name"), relationship: formValue(form, "relationship") });
      else await this.vm.addGuardian({ playerId: formValue(form, "playerId"), name: formValue(form, "name"), email: formValue(form, "email"), relationship: formValue(form, "relationship") });
      form.closest("dialog").close();
      this.#renderGuardians(formValue(form, "playerId"));
    } catch (error) {
      feedback.innerHTML = `<div class="login-message error">${escapeHtml(error.message)}</div>`;
    } finally { button.disabled = false; }
  }
  async #promoteCoach(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const candidate = this.vm.coachPromotionCandidates.find(item => item.id === formValue(form, "candidate"));
    if (!candidate) return;
    const confirmed = confirm(`Promote ${candidate.name} (${candidate.email}) to assistant coach?\n\nThey will gain the Coaching Dashboard and keep Parent view access for ${candidate.playerName}. A private onboarding message will be sent automatically.`);
    if (!confirmed) return;
    const button = form.querySelector("[type=submit]"); const feedback = form.querySelector("#coachPromotionFeedback");
    button.disabled = true; feedback.innerHTML = `<div class="login-message">Adding coach access and sending the onboarding message…</div>`;
    try {
      const result = await this.vm.promoteParentToCoach(candidate);
      feedback.innerHTML = `<div class="login-message success">${escapeHtml(result)}</div>`;
      form.elements.candidate.disabled = true;
      button.textContent = "Coach added";
    } catch (error) {
      feedback.innerHTML = `<div class="login-message error">${escapeHtml(error.message)}</div>`;
      button.disabled = false;
    }
  }
  async #inviteCoach(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const name = formValue(form, "name").trim(); const email = formValue(form, "email").trim().toLowerCase();
    if (!confirm(`Invite ${name} (${email}) as an assistant coach?\n\nThey will receive coach access and a secure sign-in link by email.`)) return;
    const button = form.querySelector("[type=submit]"); const feedback = form.querySelector("#coachInviteFeedback");
    button.disabled = true; feedback.innerHTML = `<div class="login-message">Creating coach access and sending the secure sign-in link…</div>`;
    try {
      const result = await this.vm.inviteCoach({ name, email });
      feedback.innerHTML = `<div class="login-message success">${escapeHtml(result)}</div>`;
      button.textContent = "Invite sent";
    } catch (error) {
      feedback.innerHTML = `<div class="login-message ${error.inviteSaved ? "" : "error"}">${escapeHtml(error.message)}</div>`;
      button.disabled = false;
      if (error.inviteSaved) button.textContent = "Send email again";
    }
  }
  async #revokeGuardian(id) {
    const guardian = this.vm.guardianRelationships.find(item => item.id === id);
    if (!guardian || !confirm(`Revoke ${guardian.name}’s access to this player and close their private conversation?`)) return;
    try { await this.vm.revokeGuardian(id); this.#renderGuardians(guardian.playerId); }
    catch (error) { alert(error.message); }
  }
}
