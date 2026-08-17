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
    this.root.querySelector("#documentEditForm").addEventListener("submit", event => this.#saveEdit(event));
    this.root.querySelector("#documentSearch").addEventListener("input", () => this.render());
    this.root.querySelector("#documentCategoryFilter").addEventListener("change", () => this.render());
    this.root.addEventListener("click", event => this.#onClick(event));
  }
  async #onClick(event) {
    const target = event.target.closest("[data-action]"); if (!target) return;
    const { action, id } = target.dataset;
    if (action === "add-document") {
      this.root.querySelector("#documentUploadPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      this.root.querySelector("#documentUploadForm").elements.title.focus();
    }
    if (action === "edit-document") this.#openEdit(id);
    if (action === "close-document-edit") this.root.querySelector("#documentEditDialog").close();
    if (action === "copy-document") await this.#copy(id);
    if (action === "copy-document-link") await this.#copyLink(id);
    if (action === "delete-document") await this.#delete(id);
  }
  async #upload(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    await this.#run("Uploading file…", async () => {
      const saved = await this.vm.uploadDocument({ title: form.elements.title.value, category: form.elements.category.value, file: form.elements.file.files[0] });
      form.reset(); return `${saved.title} was added to Docs.`;
    });
  }
  #openEdit(id) {
    const item = (this.vm.state.documents || []).find(document => document.id === id); if (!item) return;
    const dialog = this.root.querySelector("#documentEditDialog"); const form = dialog.querySelector("form");
    form.elements.id.value = item.id; form.elements.title.value = item.title; form.elements.category.value = item.category;
    dialog.showModal();
  }
  async #saveEdit(event) {
    event.preventDefault();
    const form = event.currentTarget; if (!form.reportValidity()) return;
    await this.#run("Saving changes…", async () => {
      const saved = await this.vm.updateDocument(form.elements.id.value, { title: form.elements.title.value, category: form.elements.category.value });
      form.closest("dialog").close(); return `${saved.title} was updated.`;
    });
  }
  async #copy(id) {
    await this.#run("Copying file…", async () => {
      const saved = await this.vm.copyDocument(id); return `${saved.title} was added to Docs.`;
    });
  }
  async #copyLink(id) {
    const item = (this.vm.state.documents || []).find(document => document.id === id); if (!item) return;
    try { await navigator.clipboard.writeText(item.url); this.error = ""; this.feedback = `Link copied for ${item.title}.`; }
    catch { this.feedback = ""; this.error = "The file link could not be copied. Open the file and copy the address from your browser."; }
    this.render();
  }
  async #delete(id) {
    const item = (this.vm.state.documents || []).find(document => document.id === id); if (!item) return;
    if (!confirm(`Delete ${item.title}?\n\nThe file will be removed from Docs for every coach and parent. This cannot be undone.`)) return;
    await this.#run("Deleting file…", async () => {
      const result = await this.vm.deleteDocument(id);
      return result.cleanupFailed ? `${result.title} was removed from Docs. Its unused Storage file may require cleanup.` : `${result.title} was deleted.`;
    });
  }
  async #run(progress, operation) {
    if (this.busy) return;
    this.busy = true; this.error = ""; this.feedback = progress; this.render();
    try { this.feedback = await operation(); }
    catch (error) { this.error = error.message; this.feedback = ""; }
    finally { this.busy = false; this.render(); }
  }
  render() {
    const feedback = this.root.querySelector("#documentFeedback"); if (!feedback) return;
    feedback.innerHTML = this.error ? `<div class="login-message error">${escapeHtml(this.error)}</div>` : this.feedback ? `<div class="login-message success">${escapeHtml(this.feedback)}</div>` : "";
    const form = this.root.querySelector("#documentUploadForm"); const uploadEnabled = this.vm.canUploadDocuments;
    form.querySelectorAll("input,select,button").forEach(element => { element.disabled = !uploadEnabled || this.busy; });
    form.querySelector("[type=submit]").textContent = this.busy ? "Working…" : "Upload file";
    this.root.querySelector("#documentStorageNote").textContent = uploadEnabled ? "Team members can view this file as soon as the upload finishes." : "Firebase document storage is not enabled in this environment.";
    const term = this.root.querySelector("#documentSearch").value.trim().toLowerCase();
    const category = this.root.querySelector("#documentCategoryFilter").value;
    const items = [...(this.vm.state.documents || [])]
      .filter(item => category === "all" || item.category === category)
      .filter(item => `${item.title} ${item.fileName} ${categoryLabels[item.category] || ""}`.toLowerCase().includes(term))
      .sort((a, b) => String(b.updatedAt || b.uploadedAt).localeCompare(String(a.updatedAt || a.uploadedAt)));
    this.root.querySelector("#documentCount").textContent = `${items.length} file${items.length === 1 ? "" : "s"}`;
    this.root.querySelector("#documentGrid").innerHTML = items.map(item => {
      const image = String(item.contentType || "").startsWith("image/");
      const preview = image ? `<img src="${escapeHtml(item.url)}" alt="" loading="lazy">` : `<div class="document-file-icon" aria-hidden="true">PDF</div>`;
      const coachActions = this.vm.role === "coach" ? `<button class="button small" data-action="edit-document" data-id="${escapeHtml(item.id)}">Edit</button><button class="button small" data-action="copy-document" data-id="${escapeHtml(item.id)}">Duplicate</button><button class="button small danger" data-action="delete-document" data-id="${escapeHtml(item.id)}">Delete</button>` : "";
      return `<article class="document-card"><a class="document-preview" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${preview}</a><div class="document-card-body"><div class="button-row"><span class="badge ${item.category === "photo" ? "gold" : "blue"}">${escapeHtml(categoryLabels[item.category] || "File")}</span><span class="small muted">${fileSize(item.size)}</span></div><h3>${escapeHtml(item.title)}</h3><p class="small muted">${escapeHtml(item.fileName || "Team file")} · ${formatDateTime(item.updatedAt || item.uploadedAt)}</p><div class="document-card-actions"><a class="button small primary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Open file</a><button class="button small" data-action="copy-document-link" data-id="${escapeHtml(item.id)}">Copy link</button>${coachActions}</div></div></article>`;
    }).join("") || `<div class="empty-state">${term || category !== "all" ? "No files match this filter." : "No team files have been added yet."}</div>`;
  }
}
