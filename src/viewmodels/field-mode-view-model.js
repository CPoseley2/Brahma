import { drillById, tokenById } from "../data/season-playbook.js";

export class FieldModeViewModel extends EventTarget {
  constructor({ now = () => Date.now(), setTimer = setInterval, clearTimer = clearInterval } = {}) {
    super(); this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.event = null; this.lesson = null; this.blockIndex = 0; this.remainingSeconds = 0;
    this.running = false; this.finished = false; this.endsAt = 0; this.timer = null;
  }
  get currentBlock() { return this.lesson?.blocks[this.blockIndex] || null; }
  get currentDrill() { return this.currentBlock?.drillId ? drillById(this.currentBlock.drillId) : null; }
  get token() { return tokenById(this.lesson?.tokenFocus); }
  get totalSeconds() { return (this.lesson?.blocks || []).reduce((total, block) => total + block.minutes * 60, 0); }
  get elapsedSeconds() {
    if (!this.lesson) return 0;
    const complete = this.lesson.blocks.slice(0, this.blockIndex).reduce((total, block) => total + block.minutes * 60, 0);
    return complete + (this.currentBlock.minutes * 60 - this.remainingSeconds);
  }
  get progressPercent() { return this.totalSeconds ? Math.min(100, Math.round(this.elapsedSeconds / this.totalSeconds * 100)) : 0; }
  open(event, lesson) { this.#stop(); this.event = event; this.lesson = lesson; this.blockIndex = 0; this.#resetBlock(); this.#changed(); }
  close() { this.#stop(); this.event = null; this.lesson = null; }
  toggle() { this.running ? this.pause() : this.start(); }
  start() {
    if (!this.currentBlock || this.running) return;
    if (this.remainingSeconds <= 0) this.#resetBlock();
    this.running = true; this.finished = false; this.endsAt = this.now() + this.remainingSeconds * 1000;
    this.timer = this.setTimer(() => this.#tick(), 250); this.#changed();
  }
  pause() { if (!this.running) return; this.#tick(); this.#stop(); this.#changed(); }
  reset() { this.#stop(); this.#resetBlock(); this.#changed(); }
  next() { this.jump(Math.min(this.blockIndex + 1, this.lesson.blocks.length - 1)); }
  previous() { this.jump(Math.max(this.blockIndex - 1, 0)); }
  jump(index) {
    if (!this.lesson?.blocks[index]) return;
    const resume = this.running; this.#stop(); this.blockIndex = index; this.#resetBlock();
    if (resume) this.start(); else this.#changed();
  }
  #tick() {
    if (!this.running) return;
    this.remainingSeconds = Math.max(0, Math.ceil((this.endsAt - this.now()) / 1000));
    if (this.remainingSeconds === 0) { this.#stop(); this.finished = true; }
    this.#changed();
  }
  #resetBlock() { this.remainingSeconds = (this.currentBlock?.minutes || 0) * 60; this.finished = false; }
  #stop() { if (this.timer) this.clearTimer(this.timer); this.timer = null; this.running = false; }
  #changed() { this.dispatchEvent(new Event("change")); }
}
