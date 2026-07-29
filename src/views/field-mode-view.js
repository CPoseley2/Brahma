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
  constructor(root, appViewModel, fieldViewModel) { this.root = root; this.app = appViewModel; this.vm = fieldViewModel; this.wakeLock = null; this.sessionFeedback = ""; }
  mount() {
    this.dialog = this.root.querySelector("#fieldModeDialog");
    this.root.addEventListener("click", event => { const action = event.target.closest("[data-field-action]")?.dataset.fieldAction; if (action) this.#act(action, event.target.closest("[data-index]")?.dataset.index); });
    this.dialog.addEventListener("change", event => { if (event.target.matches("#fieldPracticeSelect")) this.#switchPractice(event.target.value); });
    this.dialog.addEventListener("close", () => this.#close());
    this.vm.addEventListener("change", () => this.render());
  }
  open(eventId) {
    this.sessionFeedback = "";
    if (!this.#loadPractice(eventId)) return;
    this.dialog.showModal(); document.body.classList.add("field-mode-open"); this.#keepAwake();
  }
  #act(action, index) {
    const actions = { close: () => this.dialog.close(), toggle: () => this.vm.toggle(), reset: () => this.vm.reset(), next: () => this.vm.next(), previous: () => this.vm.previous(), jump: () => this.vm.jump(Number(index)), "previous-session": () => this.#movePractice(-1), "next-session": () => this.#movePractice(1) };
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
    this.#loadPractice(eventId);
  }
  #movePractice(offset) {
    const practices = this.#fieldPractices();
    const index = practices.findIndex(event => event.id === this.vm.event?.id);
    const target = practices[index + offset];
    if (target) this.#switchPractice(target.id);
  }
  #fieldPractices() { return this.app.curriculumPracticeEvents.filter(event => this.app.lessonForPractice(event.id)); }
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
    this.root.querySelector("#fieldTokenChip").innerHTML = `<span class="token-chip ${token.className}">${escapeHtml(token.name)}</span>`;
    this.root.querySelector("#fieldTokenPrompt").textContent = token.coachLooksFor;
    this.root.querySelector("#fieldBlockNav").innerHTML = lesson.blocks.map((item, index) => `<button data-field-action="jump" data-index="${index}" class="${index === this.vm.blockIndex ? "active" : ""}"><span>${index + 1}</span><strong>${escapeHtml(item.label)}</strong><small>${item.minutes} min</small></button>`).join("");
  }
}
