import { escapeHtml, formatDateTime } from "../shared/format.js";

const categoryLabels = { pdf: "PDF", map: "Map", photo: "Photo" };
const fileSize = bytes => {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
};

export class DocumentsView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.feedback = ""; this.error = ""; this.busy = false; }
  mount() {
    this.root.querySelector("#documentUploadForm").addEventListener("submit", event => this.#upload(event));
    this.root.querySelector("#documentSearch").addEventListener("input", () => this.render());
    this.root.querySelector("#documentCategoryFilter").addEventListener("change", () => this.render());
    this.root.addEventListener("click", event => {
      if (!event.target.closest("[data-action=add-document]")) return;
      this.root.querySelector("#documentUploadPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      this.root.querySelector("#documentUploadForm").elements.title.focus();
    });
  }
  async #upload(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    this.busy = true; this.error = ""; this.feedback = "Uploading file…"; this.render();
    try {
      const saved = await this.vm.uploadDocument({ title: form.elements.title.value, category: form.elements.category.value, file: form.elements.file.files[0] });
      this.feedback = `${saved.title} was added to Docs.`; form.reset();
    } catch (error) { this.error = error.message; this.feedback = ""; }
    finally { this.busy = false; this.render(); }
  }
  render() {
    const feedback = this.root.querySelector("#documentFeedback");
    feedback.innerHTML = this.error ? `<div class="login-message error">${escapeHtml(this.error)}</div>` : this.feedback ? `<div class="login-message success">${escapeHtml(this.feedback)}</div>` : "";
    const form = this.root.querySelector("#documentUploadForm");
    const uploadEnabled = this.vm.canUploadDocuments;
    form.querySelectorAll("input,select,button").forEach(element => { element.disabled = !uploadEnabled || this.busy; });
    form.querySelector("[type=submit]").textContent = this.busy ? "Uploading…" : "Upload file";
    this.root.querySelector("#documentStorageNote").textContent = uploadEnabled ? "Team members can view this file as soon as the upload finishes." : "Firebase document storage is not enabled in this environment.";
    const term = this.root.querySelector("#documentSearch").value.trim().toLowerCase();
    const category = this.root.querySelector("#documentCategoryFilter").value;
    const items = [...(this.vm.state.documents || [])]
      .filter(item => category === "all" || item.category === category)
      .filter(item => `${item.title} ${item.fileName} ${categoryLabels[item.category] || ""}`.toLowerCase().includes(term))
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
    this.root.querySelector("#documentCount").textContent = `${items.length} file${items.length === 1 ? "" : "s"}`;
    this.root.querySelector("#documentGrid").innerHTML = items.map(item => {
      const image = String(item.contentType || "").startsWith("image/");
      const preview = image
        ? `<img src="${escapeHtml(item.url)}" alt="" loading="lazy">`
        : `<div class="document-file-icon" aria-hidden="true">PDF</div>`;
      return `<article class="document-card"><a class="document-preview" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${preview}</a><div class="document-card-body"><div class="button-row"><span class="badge ${item.category === "photo" ? "gold" : "blue"}">${escapeHtml(categoryLabels[item.category] || "File")}</span><span class="small muted">${fileSize(item.size)}</span></div><h3>${escapeHtml(item.title)}</h3><p class="small muted">${escapeHtml(item.fileName || "Team file")} · ${formatDateTime(item.uploadedAt)}</p><a class="button small" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open file</a></div></article>`;
    }).join("") || `<div class="empty-state">${term || category !== "all" ? "No files match this filter." : "No team files have been added yet."}</div>`;
  }
}
