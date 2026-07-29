import { drillById, seasonPlan, sessionMinutes, tokenById, tokenDomains } from "../data/season-playbook.js";
import { escapeHtml } from "../shared/format.js";
import { bundledDrillArtworkCount, drillArtworkUrl } from "../data/drill-artwork.js";

const tokenChip = id => { const token = tokenById(id); return token ? `<span class="token-chip ${token.className}">${escapeHtml(token.name)}</span>` : ""; };

export class SeasonPlaybookView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.week = "1"; this.query = ""; this.domain = "all"; this.feedback = ""; this.error = ""; this.uploading = ""; }
  mount() {
    const week = this.root.querySelector("#playbookWeek");
    week.innerHTML = `<option value="all">Full season</option>${[...new Set(seasonPlan.map(item => item.week))].map(value => `<option value="${value}">Week ${value}</option>`).join("")}`;
    week.value = this.week;
    this.root.querySelector("#drillDomainFilter").innerHTML += tokenDomains.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    week.addEventListener("change", event => { this.week = event.target.value; this.renderPlaybook(); });
    this.root.querySelector("#drillSearch").addEventListener("input", event => { this.query = event.target.value.trim().toLowerCase(); this.renderDrills(); });
    this.root.querySelector("#drillDomainFilter").addEventListener("change", event => { this.domain = event.target.value; this.renderDrills(); });
    this.root.addEventListener("click", event => this.#onClick(event));
    this.root.addEventListener("change", event => { const input = event.target.closest("[data-drill-image]"); if (input?.files[0]) this.#upload(input.dataset.drillImage, input.files[0], input); });
  }
  #onClick(event) {
    const target = event.target.closest("[data-action]"); if (!target) return;
    if (target.dataset.action === "print-playbook") window.print();
    if (target.dataset.action === "open-lesson") { this.week = target.dataset.week; this.root.querySelector("#playbookWeek").value = this.week; this.renderPlaybook(); }
    if (target.dataset.action === "show-drill") {
      const item = this.vm.drillCards.find(value => value.id === target.dataset.id); if (!item) return;
      this.query = item.title.toLowerCase(); this.root.querySelector("#drillSearch").value = item.title; this.vm.go("drills"); this.renderDrills();
    }
  }
  async #upload(id, file, input) {
    this.feedback = ""; this.error = ""; this.uploading = id; this.renderDrills();
    try { await this.vm.uploadDrillImage(id, file); this.feedback = `${file.name} is now attached to ${drillById(id)?.title || "the drill"}.`; }
    catch (error) { this.error = error.message; }
    finally { this.uploading = ""; input.value = ""; this.renderDrills(); }
  }
  render() { this.renderPlaybook(); this.renderDrills(); }
  renderPlaybook() {
    this.root.querySelector("#tokenDomainGuide").innerHTML = tokenDomains.map(item => `<article class="token-domain-card ${item.className}"><span>${escapeHtml(item.colors)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.promise)}</p><small>${escapeHtml(item.coachLooksFor)}</small></article>`).join("");
    const sessions = this.week === "all" ? seasonPlan : seasonPlan.filter(item => String(item.week) === this.week);
    this.root.querySelector("#playbookSummary").innerHTML = `<strong>${sessions.length}</strong> practice${sessions.length === 1 ? "" : "s"} · <strong>${sessions.reduce((total, item) => total + sessionMinutes(item), 0) / 60}</strong> field hour${sessions.length === 1 ? "" : "s"}`;
    this.root.querySelector("#seasonSessionList").innerHTML = sessions.map(item => this.#sessionCard(item)).join("");
  }
  #sessionCard(item) {
    const token = tokenById(item.tokenFocus);
    const rows = item.blocks.map(value => {
      const activity = value.drillId ? drillById(value.drillId) : null;
      const label = activity ? `<button class="text-button" data-action="show-drill" data-id="${activity.id}">${escapeHtml(activity.title)}</button>` : escapeHtml(value.label);
      return `<li><span class="plan-time">${value.minutes} min</span><div><strong>${label}</strong><p>${escapeHtml(value.purpose)}</p></div></li>`;
    }).join("");
    return `<article class="season-session-card"><div class="session-card-head"><div><p class="eyebrow dark">Week ${item.week} · Session ${item.day}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.story)}</p></div><div>${tokenChip(item.tokenFocus)}<span class="minute-total">${sessionMinutes(item)} minutes</span></div></div><ol class="practice-timeline">${rows}</ol><div class="session-footer"><div><strong>Token invitation</strong><p>Look for: ${escapeHtml(token?.coachLooksFor || "a meaningful choice in play")}</p></div><div><strong>Take-home play</strong><p>${escapeHtml(item.homePlay)}</p></div></div></article>`;
  }
  renderDrills() {
    const cards = this.vm.drillCards.filter(item => {
      const searchable = [item.title, item.category, item.story, item.setup, item.play, ...(item.cues || [])].join(" ").toLowerCase();
      return (!this.query || searchable.includes(this.query)) && (this.domain === "all" || item.tokenIds.includes(this.domain));
    });
    const withArt = this.vm.drillCards.filter(item => item.imageUrl || drillArtworkUrl(item.id)).length;
    const bundledCount = bundledDrillArtworkCount();
    this.root.querySelector("#drillArtworkWorkflow").innerHTML = bundledCount === this.vm.drillCards.length
      ? `<strong>Activity cards are ready:</strong> All ${bundledCount} field diagrams are included in the team hub. Open any coaching card below to see its complete setup and artwork.`
      : this.vm.canUploadDrillImages
        ? `<strong>PNG workflow:</strong> Open a card and choose <em>Add or replace PNG</em>. Artwork is stored privately in Firebase for coaches.`
        : `<strong>Activity card progress:</strong> ${bundledCount} of ${this.vm.drillCards.length} diagrams are included in this deployment.`;
    this.root.querySelector("#drillLibraryStats").innerHTML = `<strong>${cards.length}</strong> shown · <strong>${this.vm.drillCards.length}</strong> complete text cards · <strong>${withArt}</strong> PNG${withArt === 1 ? "" : "s"} attached`;
    this.root.querySelector("#drillLibraryFeedback").innerHTML = this.error ? `<div class="login-message error">${escapeHtml(this.error)}</div>` : this.feedback ? `<div class="login-message success">${escapeHtml(this.feedback)}</div>` : "";
    this.root.querySelector("#drillCardGrid").innerHTML = cards.map(item => this.#drillCard(item)).join("") || `<div class="empty-state">No drills match these filters.</div>`;
  }
  #drillCard(item) {
    const imageUrl = item.imageUrl || drillArtworkUrl(item.id);
    const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)} drill card" loading="lazy" decoding="async">` : `<div class="drill-art-placeholder"><span>◆</span><strong>PNG ready</strong><small>${escapeHtml(item.id)}.png</small></div>`;
    const upload = !this.vm.canUploadDrillImages ? `<span class="small muted">Filename: <code>${escapeHtml(item.id)}.png</code></span>` : this.uploading === item.id ? `<span class="button disabled">Uploading…</span>` : `<label class="button small upload-button">${imageUrl ? "Replace PNG" : "Add PNG"}<input type="file" accept="image/png" data-drill-image="${item.id}"></label>`;
    return `<article class="drill-card"><div class="drill-art">${image}</div><div class="drill-card-body"><div class="drill-card-meta"><span class="badge">${escapeHtml(item.category)}</span>${item.tokenIds.map(tokenChip).join("")}</div><h3>${escapeHtml(item.title)}</h3><p class="drill-story">${escapeHtml(item.story)}</p><details><summary>Open coaching card</summary><div class="drill-detail"><h4>Set it up</h4><p>${escapeHtml(item.setup)}</p><p class="small muted"><strong>Equipment:</strong> ${escapeHtml(item.equipment)}</p><h4>How it plays</h4><p>${escapeHtml(item.play)}</p><h4>Coach invitations</h4><ul>${item.cues.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul><h4>Ways to grow it</h4><ul>${item.variations.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div></details><div class="drill-card-actions">${upload}${item.fileName ? `<small class="muted">${escapeHtml(item.fileName)}</small>` : ""}</div></div></article>`;
  }
}
