import { escapeHtml, formatDate, formatTime, todayIso } from "../shared/format.js";

const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const guidanceList = items => `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const observationCard = (block, drill) => {
  const guidance = block.guidance;
  return `<div class="field-guidance-heading"><p class="eyebrow dark">Baseline observation${drill ? ` · ${escapeHtml(drill.category)}` : ""}</p><span class="field-observation-badge">Observe · don’t grade</span></div>
    <h3>${escapeHtml(block.label)}</h3>
    <p class="field-story">${escapeHtml(block.purpose)}</p>
    <div class="field-instructions field-observation-instructions"><div><strong>Set it up</strong><p>${escapeHtml(guidance.setup)}</p></div><div><strong>Run the block</strong><p>${escapeHtml(guidance.run)}</p></div></div>
    <div class="field-cues field-exact-language"><strong>Exact coach language</strong>${guidance.say.map(cue => `<span>“${escapeHtml(cue)}”</span>`).join("")}</div>
    <div class="field-observation-grid"><section><strong>Watch for</strong>${guidanceList(guidance.watch)}</section><section class="field-record-card"><strong>Record</strong><p>${escapeHtml(guidance.record)}</p></section></div>`;
};
const standardCard = (block, drill, lesson) => drill
  ? `<p class="eyebrow dark">${escapeHtml(drill.category)}</p><h3>${escapeHtml(drill.title)}</h3><p class="field-story">${escapeHtml(drill.story)}</p><div class="field-instructions"><div><strong>Set it up</strong><p>${escapeHtml(drill.setup)}</p></div><div><strong>How it plays</strong><p>${escapeHtml(drill.play)}</p></div></div><div class="field-cues"><strong>Say less. Try:</strong>${drill.cues.map(cue => `<span>“${escapeHtml(cue)}”</span>`).join("")}</div>`
  : `<p class="eyebrow dark">${escapeHtml(block.label)}</p><h3>${escapeHtml(block.purpose)}</h3><p class="field-story">${escapeHtml(lesson.story)}</p>`;

export class FieldModeView {
  constructor(root, appViewModel, fieldViewModel) {
    this.root = root; this.app = appViewModel; this.vm = fieldViewModel; this.wakeLock = null; this.sessionFeedback = "";
    this.selectedSkillId = ""; this.selectedSkillGroupId = ""; this.selectedPlayerIds = new Set(); this.observerBlockKey = "";
    this.observationFeedback = ""; this.observationFeedbackKind = ""; this.savingObservation = false;
  }
  mount() {
    this.dialog = this.root.querySelector("#fieldModeDialog");
    this.root.addEventListener("click", event => {
      const control = event.target.closest("[data-field-action]");
      if (control) this.#act(control.dataset.fieldAction, control);
    });
    this.dialog.addEventListener("change", event => { if (event.target.matches("#fieldPracticeSelect")) this.#switchPractice(event.target.value); });
    this.dialog.addEventListener("close", () => this.#close());
    this.vm.addEventListener("change", () => this.render());
  }
  open(eventId) {
    this.sessionFeedback = ""; this.#resetObserver();
    if (!this.#loadPractice(eventId)) return;
    this.dialog.showModal(); document.body.classList.add("field-mode-open"); this.#keepAwake();
  }
  #act(action, control) {
    const actions = {
      close: () => this.dialog.close(),
      toggle: () => this.vm.toggle(),
      reset: () => this.vm.reset(),
      next: () => this.vm.next(),
      previous: () => this.vm.previous(),
      jump: () => this.vm.jump(Number(control.dataset.index)),
      "previous-session": () => this.#movePractice(-1),
      "next-session": () => this.#movePractice(1),
      "filter-skills": () => this.#filterSkills(control.dataset.skillGroup),
      "select-skill": () => this.#selectSkill(control.dataset.skillId),
      "select-player": () => this.#togglePlayer(control.dataset.playerId),
      "record-observation": () => this.#recordObservation(),
    };
    actions[action]?.();
  }
  #loadPractice(eventId) {
    const event = this.#fieldPractices().find(item => item.id === eventId); const lesson = this.app.lessonForPractice(eventId);
    if (!event || !lesson) return false;
    this.vm.open(event, lesson);
    return true;
  }
  #switchPractice(eventId) {
    if (!eventId || eventId === this.vm.event?.id) return;
    this.sessionFeedback = "Practice changed · timer reset to the first block.";
    this.#resetObserver();
    this.#loadPractice(eventId);
  }
  #movePractice(offset) {
    const practices = this.#fieldPractices();
    const index = practices.findIndex(event => event.id === this.vm.event?.id);
    const target = practices[index + offset];
    if (target) this.#switchPractice(target.id);
  }
  #fieldPractices() { return this.app.curriculumPracticeEvents.filter(event => this.app.lessonForPractice(event.id)); }
  #allSkills() {
    return this.app.state.skillFramework.flatMap(group => (group.skills || []).map(skill => ({
      ...skill,
      groupId: group.id,
      groupName: group.name,
      groupShort: group.short || group.name,
    })));
  }
  #skillGroups() {
    return this.app.state.skillFramework
      .filter(group => group.skills?.length)
      .map(group => ({ id: group.id, label: group.short || group.name }));
  }
  #skillsForBlock(block, groupId = "all") {
    const priority = new Map((block?.guidance?.skillIds || []).map((id, index) => [id, index]));
    return this.#allSkills().filter(skill => groupId === "all" || skill.groupId === groupId).sort((left, right) => {
      const leftPriority = priority.has(left.id) ? priority.get(left.id) : Number.MAX_SAFE_INTEGER;
      const rightPriority = priority.has(right.id) ? priority.get(right.id) : Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority;
    });
  }
  #defaultSkillGroup(block) {
    const skillsById = new Map(this.#allSkills().map(skill => [skill.id, skill]));
    return (block?.guidance?.skillIds || []).map(id => skillsById.get(id)?.groupId).find(Boolean)
      || "all";
  }
  #resetObserver() {
    this.selectedSkillId = ""; this.selectedSkillGroupId = ""; this.selectedPlayerIds.clear(); this.observerBlockKey = "";
    this.observationFeedback = ""; this.observationFeedbackKind = ""; this.savingObservation = false;
  }
  #filterSkills(groupId) {
    if (groupId !== "all" && !this.#skillGroups().some(group => group.id === groupId)) return;
    this.selectedSkillGroupId = groupId; this.selectedSkillId = "";
    this.observationFeedback = ""; this.observationFeedbackKind = "";
    this.#renderObserver(this.vm.currentBlock);
  }
  #selectSkill(skillId) {
    if (!this.#allSkills().some(skill => skill.id === skillId)) return;
    this.selectedSkillId = skillId; this.observationFeedback = ""; this.observationFeedbackKind = "";
    this.#renderObserver(this.vm.currentBlock);
    this.root.querySelector(`[data-skill-id="${skillId}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
  #togglePlayer(playerId) {
    if (!this.app.activePlayers.some(player => player.id === playerId)) return;
    if (this.selectedPlayerIds.has(playerId)) this.selectedPlayerIds.delete(playerId); else this.selectedPlayerIds.add(playerId);
    this.observationFeedback = ""; this.observationFeedbackKind = "";
    this.#renderObserver(this.vm.currentBlock);
    this.root.querySelector(`[data-player-id="${playerId}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
  async #recordObservation() {
    if (this.savingObservation || !this.selectedSkillId || !this.selectedPlayerIds.size) return;
    this.savingObservation = true; this.observationFeedback = "Saving to player profiles…"; this.observationFeedbackKind = "";
    this.#renderObserver(this.vm.currentBlock);
    try {
      this.observationFeedback = await this.app.recordFieldObservation({
        eventId: this.vm.event.id,
        blockLabel: this.vm.currentBlock.label,
        skillId: this.selectedSkillId,
        playerIds: [...this.selectedPlayerIds],
      });
      this.observationFeedbackKind = "success"; this.selectedPlayerIds.clear();
    } catch (error) {
      this.observationFeedback = error.message; this.observationFeedbackKind = "error";
    } finally {
      this.savingObservation = false; this.#renderObserver(this.vm.currentBlock);
    }
  }
  #renderObserver(block) {
    const blockKey = `${this.vm.event?.id || ""}:${this.vm.blockIndex}`;
    if (this.observerBlockKey !== blockKey) {
      this.observerBlockKey = blockKey;
      this.selectedSkillGroupId = this.#defaultSkillGroup(block);
      this.selectedSkillId = "";
      this.selectedPlayerIds.clear();
      this.observationFeedback = ""; this.observationFeedbackKind = "";
    }
    const groups = this.#skillGroups();
    if (this.selectedSkillGroupId !== "all" && !groups.some(group => group.id === this.selectedSkillGroupId)) this.selectedSkillGroupId = groups[0]?.id || "all";
    const skills = this.#skillsForBlock(block, this.selectedSkillGroupId);
    if (!skills.some(skill => skill.id === this.selectedSkillId)) this.selectedSkillId = skills[0]?.id || "";
    const recommended = new Set(block?.guidance?.skillIds || []);
    const filters = [...groups, { id: "all", label: "All" }];
    const filterBar = this.root.querySelector("#fieldSkillFilters");
    const filterSignature = `${filters.map(filter => `${filter.id}:${filter.label}`).join("|")}:${this.selectedSkillGroupId}`;
    if (filterBar.dataset.signature !== filterSignature) {
      filterBar.innerHTML = filters.map(filter => `<button type="button" aria-pressed="${filter.id === this.selectedSkillGroupId}" class="${filter.id === this.selectedSkillGroupId ? "selected" : ""}" data-field-action="filter-skills" data-skill-group="${escapeHtml(filter.id)}">${escapeHtml(filter.label)}</button>`).join("");
      filterBar.dataset.signature = filterSignature;
    }
    const skillWheel = this.root.querySelector("#fieldSkillWheel");
    const skillSignature = `${this.selectedSkillGroupId}:${skills.map(skill => skill.id).join("|")}:${this.selectedSkillId}`;
    if (skillWheel.dataset.signature !== skillSignature) {
      skillWheel.innerHTML = skills.map(skill => `<button type="button" role="option" aria-selected="${skill.id === this.selectedSkillId}" class="field-wheel-item ${skill.id === this.selectedSkillId ? "selected" : ""}" data-field-action="select-skill" data-skill-id="${escapeHtml(skill.id)}"><small>${recommended.has(skill.id) ? "This block" : escapeHtml(skill.groupShort)}</small><strong>${escapeHtml(skill.name)}</strong></button>`).join("")
        || `<p class="field-wheel-empty">No development skills are configured.</p>`;
      skillWheel.dataset.signature = skillSignature;
    }

    const players = [...this.app.activePlayers].sort((left, right) => `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`));
    const playerWheel = this.root.querySelector("#fieldPlayerWheel");
    const playerSignature = `${players.map(player => `${player.id}:${player.firstName}:${player.lastName}`).join("|")}:${[...this.selectedPlayerIds].sort().join("|")}`;
    if (playerWheel.dataset.signature !== playerSignature) {
      playerWheel.innerHTML = players.map(player => {
        const selected = this.selectedPlayerIds.has(player.id);
        return `<button type="button" aria-pressed="${selected}" class="field-wheel-item player ${selected ? "selected" : ""}" data-field-action="select-player" data-player-id="${escapeHtml(player.id)}"><span>${selected ? "✓" : escapeHtml(player.firstName.charAt(0))}</span><strong>${escapeHtml(player.firstName)} ${escapeHtml(player.lastName)}</strong></button>`;
      }).join("") || `<p class="field-wheel-empty">No active players are on the roster.</p>`;
      playerWheel.dataset.signature = playerSignature;
    }

    const selectedSkill = skills.find(skill => skill.id === this.selectedSkillId);
    const playerCount = this.selectedPlayerIds.size;
    const relevantCount = skills.filter(skill => recommended.has(skill.id)).length;
    const groupLabel = filters.find(filter => filter.id === this.selectedSkillGroupId)?.label || "All";
    this.root.querySelector("#fieldSkillHint").textContent = `${skills.length} ${groupLabel} skill${skills.length === 1 ? "" : "s"}${relevantCount ? ` · ${relevantCount} for this block` : ""}.`;
    this.root.querySelector("#fieldPlayerCount").textContent = playerCount ? `${playerCount} player${playerCount === 1 ? "" : "s"} selected.` : "Choose everyone you saw.";
    const feedback = this.root.querySelector("#fieldObservationFeedback");
    feedback.className = this.observationFeedbackKind;
    feedback.textContent = this.observationFeedback || (selectedSkill && playerCount
      ? `Ready to save ${selectedSkill.name} for ${playerCount} player${playerCount === 1 ? "" : "s"}.`
      : "Select a skill and one or more players.");
    const save = this.root.querySelector("#fieldObservationSave");
    save.disabled = this.savingObservation || !selectedSkill || !playerCount;
    save.textContent = this.savingObservation ? "Saving…" : playerCount ? `Save for ${playerCount}` : "Save observation";
  }
  async #keepAwake() { try { this.wakeLock = await navigator.wakeLock?.request("screen"); } catch { this.wakeLock = null; } }
  #close() { this.vm.close(); this.wakeLock?.release(); this.wakeLock = null; document.body.classList.remove("field-mode-open"); }
  render() {
    if (!this.vm.event || !this.dialog) return;
    const { event, lesson, currentBlock: block, currentDrill: drill, token } = this.vm;
    const practices = this.#fieldPractices();
    const practiceIndex = practices.findIndex(item => item.id === event.id);
    const picker = this.root.querySelector("#fieldPracticeSelect");
    const signature = practices.map(item => item.id).join("|");
    if (picker.dataset.signature !== signature) {
      picker.innerHTML = practices.map(item => {
        const plan = this.app.lessonForPractice(item.id);
        return `<option value="${escapeHtml(item.id)}">Week ${plan?.week || "—"} · Session ${escapeHtml(plan?.day || "—")} — ${formatDate(item.date)} · ${escapeHtml(plan?.title || item.opponent || "Practice")}</option>`;
      }).join("");
      picker.dataset.signature = signature;
    }
    picker.value = event.id;
    this.root.querySelector("#fieldModeEyebrow").textContent = event.date === todayIso() ? "Today’s practice" : event.date > todayIso() ? "Previewing practice" : "Reviewing practice";
    this.root.querySelector("#fieldModeTitle").textContent = `Week ${lesson.week} · ${lesson.title}`;
    this.root.querySelector("#fieldModeMeta").textContent = `${formatDate(event.date)} · ${formatTime(event.time)} · ${event.location || "Location TBD"}`;
    this.root.querySelector("#fieldSessionFeedback").textContent = this.sessionFeedback || `Session ${lesson.day} of Week ${lesson.week} · ${practiceIndex + 1} of ${practices.length} practices`;
    this.root.querySelector("[data-field-action=previous-session]").disabled = practiceIndex <= 0;
    this.root.querySelector("[data-field-action=next-session]").disabled = practiceIndex < 0 || practiceIndex === practices.length - 1;
    this.root.querySelector("#fieldProgressBar").style.width = `${this.vm.progressPercent}%`;
    this.root.querySelector("#fieldBlockPosition").textContent = `Block ${this.vm.blockIndex + 1} of ${lesson.blocks.length}`;
    this.root.querySelector("#fieldBlockLabel").textContent = block.label;
    this.root.querySelector("#fieldTimer").textContent = clock(this.vm.remainingSeconds);
    this.root.querySelector("#fieldTimer").classList.toggle("finished", this.vm.finished);
    this.root.querySelector("#fieldTimerStatus").textContent = this.vm.finished ? "Block complete — take a breath, then tap Next." : this.vm.running ? "Timer running · screen will stay awake" : `${block.minutes}-minute block · ready when you are`;
    this.root.querySelector("[data-field-action=toggle]").textContent = this.vm.running ? "Pause" : this.vm.finished ? "Restart" : "Start";
    this.root.querySelector("[data-field-action=previous]").disabled = this.vm.blockIndex === 0;
    this.root.querySelector("[data-field-action=next]").disabled = this.vm.blockIndex === lesson.blocks.length - 1;
    this.root.querySelector("#fieldDrillCard").innerHTML = block.guidance ? observationCard(block, drill) : standardCard(block, drill, lesson);
    this.#renderObserver(block);
    this.root.querySelector("#fieldTokenChip").innerHTML = `<span class="token-chip ${token.className}">${escapeHtml(token.name)}</span>`;
    this.root.querySelector("#fieldTokenPrompt").textContent = token.coachLooksFor;
    this.root.querySelector("#fieldBlockNav").innerHTML = lesson.blocks.map((item, index) => `<button data-field-action="jump" data-index="${index}" class="${index === this.vm.blockIndex ? "active" : ""}"><span>${index + 1}</span><strong>${escapeHtml(item.label)}</strong><small>${item.minutes} min</small></button>`).join("");
  }
}
