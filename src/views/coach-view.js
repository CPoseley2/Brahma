import { ageLabel, escapeHtml, formatDate, formatTime } from "../shared/format.js";

const empty = message => `<div class="empty-state">${message}</div>`;
const eventCard = game => `<div class="list-card"><div><div class="name">${formatDate(game.date)} · ${formatTime(game.time)}</div><p>${escapeHtml(game.type)} · ${escapeHtml(game.opponent || "TBD")} · ${escapeHtml(game.location || "Location TBD")}</p></div></div>`;

export class CoachView {
  constructor(root, vm, dialogs, fieldMode) { this.root = root; this.vm = vm; this.dialogs = dialogs; this.fieldMode = fieldMode; this.selectedPracticeId = ""; }
  mount() {
    this.root.querySelector("#developmentSearch").addEventListener("input", () => this.renderDevelopment());
    this.root.querySelector("#developmentDueFilter").addEventListener("change", () => this.renderDevelopment());
    this.root.querySelector("#rosterSearch").addEventListener("input", () => this.renderRoster());
    this.root.querySelector("#rosterFilter").addEventListener("change", () => this.renderRoster());
    this.root.addEventListener("click", event => this.#onClick(event));
    this.root.addEventListener("change", event => {
      if (!event.target.matches("[data-practice-picker]")) return;
      this.selectedPracticeId = event.target.value;
      this.renderDashboard();
    });
  }
  #onClick(event) {
    const target = event.target.closest("[data-action]"); if (!target) return;
    const { action, id, playerId } = target.dataset;
    if (action === "print") window.print();
    if (action === "new-observation") this.dialogs.openObservation();
    if (action === "edit-observation") this.dialogs.openObservation(playerId, id);
    if (action === "history") this.dialogs.showHistory(id);
    if (action === "edit-session") this.dialogs.openSession(id, target.dataset.sessionId || "");
    if (action === "field-mode") this.fieldMode.open(id);
    if (action === "delete-session" && confirm("Delete this practice session?")) this.vm.remove("sessions", id);
    if (action === "new-player") this.dialogs.openPlayer();
    if (action === "edit-player") this.dialogs.openPlayer(id);
    if (action === "save-settings") this.#saveSettings();
    if (action === "export") this.#export();
  }
  render() { this.renderDashboard(); this.renderDevelopment(); this.renderSessions(); this.renderRoster(); this.renderStandards(); this.renderSettings(); }
  renderDashboard() {
    const active = this.vm.activePlayers;
    const validSelection = this.vm.curriculumPracticeEvents.some(event => event.id === this.selectedPracticeId);
    if (this.selectedPracticeId && !validSelection) this.selectedPracticeId = "";
    const spotlight = this.selectedPracticeId ? this.vm.practiceSpotlightFor(this.selectedPracticeId) : this.vm.practiceSpotlight();
    this.root.querySelector("#todayPracticeCard").innerHTML = this.#practiceSpotlight(spotlight, Boolean(this.selectedPracticeId));
    this.root.querySelector("#statPlayers").textContent = active.length;
    this.root.querySelector("#statDue").textContent = active.filter(player => this.vm.isUpdateDue(player)).length;
    this.root.querySelector("#statGames").textContent = this.vm.state.games.filter(game => game.status === "Scheduled").length;
    this.root.querySelector("#statOpenVolunteers").textContent = this.vm.state.volunteerSlots.filter(slot => !slot.assigneeFamilyId).length;
    const due = [...active].sort((a, b) => (this.vm.lastObservation(a.id)?.date || "").localeCompare(this.vm.lastObservation(b.id)?.date || "")).slice(0, 6);
    this.root.querySelector("#duePlayers").innerHTML = due.map(player => { const last = this.vm.lastObservation(player.id); return `<div class="list-card"><div><div class="name">${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</div><p class="small muted">${last ? `Last update ${formatDate(last.date)}` : "No development update yet"}</p></div><button class="button small primary" data-action="edit-observation" data-player-id="${player.id}">Log</button></div>`; }).join("") || empty("No active players.");
    const upcoming = [...this.vm.state.games].filter(game => game.status === "Scheduled").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4);
    this.root.querySelector("#coachUpcoming").innerHTML = upcoming.map(eventCard).join("") || empty("The schedule is waiting for its first event.");
    const recent = [...this.vm.state.observations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    this.root.querySelector("#recentObservations").innerHTML = recent.map(item => `<div class="timeline-item"><div><div class="name">${escapeHtml(this.vm.player(item.playerId)?.firstName || "Player")} · ${formatDate(item.date)}</div><p>${escapeHtml(item.privateNote || item.celebration || "Development update recorded.")}</p><p class="small muted">${item.shared ? "Family highlight shared" : "Coach-only entry"}</p></div><button class="button small" data-action="edit-observation" data-player-id="${item.playerId}" data-id="${item.id}">Edit</button></div>`).join("") || empty("Player notes will collect here as the season unfolds.");
  }
  #practicePicker() {
    const options = this.vm.curriculumPracticeEvents.map(event => {
      const lesson = this.vm.lessonForPractice(event.id);
      const label = lesson ? `Week ${lesson.week} · Session ${lesson.day} — ${formatDate(event.date)} · ${lesson.title}` : `${formatDate(event.date)} · ${formatTime(event.time)}`;
      return `<option value="${escapeHtml(event.id)}" ${event.id === this.selectedPracticeId ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
    return `<label class="dashboard-practice-picker"><span>Choose any practice to preview</span><select data-practice-picker aria-label="Choose a practice"><option value="">Automatic · Today or next</option>${options}</select><small>Past and future sessions are available. Canceled practices are excluded.</small></label>`;
  }
  #practiceSpotlight(spotlight, isManual) {
    const picker = this.#practicePicker();
    if (!spotlight) return `<div class="today-practice-content"><div><p class="eyebrow">Today’s practice</p><h2>No upcoming practice</h2><p>Choose an earlier session to review, or add another Practice event in Schedule.</p></div>${picker}</div><button class="button" data-route="schedule">Open schedule</button>`;
    const { event, lesson, isToday } = spotlight;
    const eyebrow = isManual ? "Practice preview" : isToday ? "Today’s practice" : "Next practice";
    if (!lesson) return `<div class="today-practice-content"><div><p class="eyebrow">${eyebrow}</p><h2>${formatDate(event.date)} · ${formatTime(event.time)}</h2><p>This practice is beyond the current 26-session playbook.</p></div>${picker}</div><button class="button" data-route="playbook">Open season plan</button>`;
    return `<div class="today-practice-content"><div><p class="eyebrow">${eyebrow}</p><h2>Week ${lesson.week} · ${escapeHtml(lesson.title)}</h2><p>${formatDate(event.date)} · ${formatTime(event.time)} · ${escapeHtml(event.location || "Location TBD")}</p><div class="today-practice-badges"><span>Session ${escapeHtml(lesson.day)}</span><span>${lesson.blocks.length} blocks</span><span>60 minutes</span><span>${escapeHtml(lesson.story)}</span></div></div>${picker}</div><button class="field-launch" data-action="field-mode" data-id="${event.id}"><span>▶</span> Start Field Mode</button>`;
  }
  renderDevelopment() {
    const term = this.root.querySelector("#developmentSearch").value.trim().toLowerCase();
    const filter = this.root.querySelector("#developmentDueFilter").value;
    const players = this.vm.activePlayers.filter(player => `${player.firstName} ${player.lastName}`.toLowerCase().includes(term)).filter(player => filter === "all" || (filter === "due" ? this.vm.isUpdateDue(player) : !this.vm.isUpdateDue(player)));
    this.root.querySelector("#developmentGrid").innerHTML = players.map(player => { const last = this.vm.lastObservation(player.id); const groups = this.vm.observedGroupCount(player.id); return `<article class="player-card"><div class="player-card-head"><div><h3>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</h3><span class="badge ${this.vm.isUpdateDue(player) ? "gold" : "blue"}">${this.vm.isUpdateDue(player) ? "Update due" : "Recently updated"}</span></div><span class="small muted">${ageLabel(player.dateOfBirth)}</span></div><div class="progress-strip">${this.vm.state.skillFramework.map((_, index) => `<span class="progress-segment ${index < groups ? "on" : ""}"></span>`).join("")}</div><p>${escapeHtml(last?.celebration || "No shared celebration recorded yet.")}</p><p class="small muted">${last ? `Last observed ${formatDate(last.date)}` : "No observation history"}</p><div class="button-row"><button class="button primary" data-action="edit-observation" data-player-id="${player.id}">Quick update</button><button class="button" data-action="history" data-id="${player.id}">History</button></div></article>`; }).join("") || empty("No players match this filter.");
  }
  renderSessions() {
    this.root.querySelector("#sessionsList").innerHTML = this.vm.practiceEvents.map(event => {
      const session = this.vm.sessionForPractice(event.id); const attendance = Object.values(session?.attendance || {});
      const lesson = this.vm.lessonForPractice(event.id);
      const present = attendance.filter(value => value === "present").length; const recorded = attendance.filter(Boolean).length;
      const status = session ? `${present} present · ${recorded} attendance responses` : "Attendance not recorded";
      const curriculum = lesson ? `<div class="practice-plan-link"><strong>Week ${lesson.week} · ${escapeHtml(lesson.title)}</strong><span>${lesson.blocks.reduce((sum, block) => sum + block.minutes, 0)}-minute plan</span><button class="button small" data-route="playbook" data-action="open-lesson" data-week="${lesson.week}">Open lesson plan</button></div>` : `<p class="small muted">This practice falls beyond the current 26-session curriculum.</p>`;
      return `<article class="list-card practice-session-card"><div><div class="name">${escapeHtml(event.opponent || "Practice")} · ${formatDate(event.date)} · ${formatTime(event.time)}</div><p>${escapeHtml(event.location || "Location TBD")} · <span class="badge ${session ? "blue" : "gold"}">${status}</span></p><div class="button-row event-badges"><span class="badge">${escapeHtml(event.status || "Scheduled")}</span>${event.seriesId ? `<span class="badge blue">Recurring series</span>` : ""}</div>${curriculum}${session?.notes ? `<p class="small muted">${escapeHtml(session.notes)}</p>` : ""}</div><div class="button-row">${lesson ? `<button class="button small primary" data-action="field-mode" data-id="${event.id}">Field mode</button>` : ""}<button class="button small ${session ? "" : "primary"}" data-action="edit-session" data-id="${event.id}" data-session-id="${session?.id || ""}">${session ? "Update session" : "Log attendance"}</button>${session ? `<button class="button small danger" data-action="delete-session" data-id="${session.id}">Clear log</button>` : ""}</div></article>`;
    }).join("") || empty("No Practice events are scheduled. Use Manage practice schedule to add one.");
  }
  renderRoster() {
    const term = this.root.querySelector("#rosterSearch").value.trim().toLowerCase(); const filter = this.root.querySelector("#rosterFilter").value;
    const players = this.vm.state.players
      .filter(player => filter === "all" || (filter === "active" ? player.active : !player.active))
      .filter(player => {
        const guardians = this.vm.guardiansForPlayer(player.id);
        return [player.firstName, player.lastName, player.familyEmail, player.familyPhone, ...guardians.flatMap(guardian => [guardian.name, guardian.email, guardian.relationship])]
          .join(" ").toLowerCase().includes(term);
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
    this.root.querySelector("#rosterBody").innerHTML = players.map(player => {
      const guardians = this.vm.guardiansForPlayer(player.id);
      const primaryContact = player.familyEmail || player.familyPhone
        ? `<strong>Primary contact</strong><br>${escapeHtml(player.familyEmail || "No email")}${player.familyPhone ? `<br>${escapeHtml(player.familyPhone)}` : ""}`
        : `<span class="muted">No primary contact</span>`;
      const guardianSummary = guardians.length
        ? `<div class="roster-guardian-summary"><strong>${guardians.length} app guardian${guardians.length === 1 ? "" : "s"}</strong><br><span class="small muted">${escapeHtml(guardians.map(guardian => guardian.name).join(", "))}</span></div>`
        : `<div class="roster-guardian-summary"><span class="small muted">No scoped app access added</span></div>`;
      return `<tr><td><span class="name">${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</span></td><td><span class="badge">${ageLabel(player.dateOfBirth)}</span></td><td>${formatDate(player.dateOfBirth)}</td><td>${primaryContact}${guardianSummary}</td><td><span class="badge ${player.active ? "" : "gray"}">${player.active ? "Active" : "Inactive"}</span></td><td><button class="button small" data-action="edit-player" data-id="${player.id}">Edit</button></td></tr>`;
    }).join("") || `<tr><td colspan="6">${empty("No roster entries match.")}</td></tr>`;
  }
  renderStandards() { this.root.querySelector("#standardsGrid").innerHTML = this.vm.state.skillFramework.map(group => `<article class="standard-card"><span class="badge">${escapeHtml(group.short)}</span><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description)}</p><ul>${group.skills.map(skill => `<li>${escapeHtml(skill.name)}</li>`).join("")}</ul></article>`).join(""); }
  renderSettings() { const team = this.vm.state.team; this.root.querySelector("#settingsTeamName").value = team.name || ""; this.root.querySelector("#settingsSeason").value = team.season || ""; this.root.querySelector("#settingsCadence").value = team.updateCadenceDays || 14; this.root.querySelector("#settingsPhilosophy").value = team.philosophy || ""; }
  #saveSettings() { const team = this.vm.state.team; team.name = this.root.querySelector("#settingsTeamName").value.trim(); team.season = this.root.querySelector("#settingsSeason").value.trim(); team.updateCadenceDays = Number(this.root.querySelector("#settingsCadence").value || 14); team.philosophy = this.root.querySelector("#settingsPhilosophy").value.trim(); this.vm.saveTeam(); }
  #export() { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(this.vm.state, null, 2)], { type: "application/json" })); link.download = "fair-oaks-u6-team-backup-v4.json"; link.click(); URL.revokeObjectURL(link.href); }
}
