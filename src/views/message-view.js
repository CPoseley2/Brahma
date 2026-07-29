import { escapeHtml, formatDateTime } from "../shared/format.js";

const empty = message => `<div class="empty-state">${escapeHtml(message)}</div>`;

export class MessageView {
  constructor(root, vm) {
    this.root = root; this.vm = vm; this.feedback = ""; this.error = "";
    this.conversationId = vm.privateConversations[0]?.id || "";
  }

  mount() {
    this.root.querySelector("#broadcastForm").addEventListener("submit", event => this.#sendBroadcast(event));
    this.root.querySelector("#privateMessageForm").addEventListener("submit", event => this.#sendMessage(event));
    this.root.addEventListener("click", event => {
      const button = event.target.closest("[data-message-conversation]");
      if (!button) return;
      this.conversationId = button.dataset.messageConversation; this.feedback = ""; this.error = ""; this.render();
    });
  }

  async #sendBroadcast(event) {
    event.preventDefault();
    const title = this.root.querySelector("#broadcastTitle").value;
    const body = this.root.querySelector("#broadcastBody").value;
    if (!confirm(`Send “${title.trim() || "this announcement"}” to the entire team?\n\nEvery active family and coach will be able to read it.`)) return;
    await this.#submit(event.submitter, () => this.vm.sendTeamBroadcast(title, body), () => event.target.reset());
  }

  async #sendMessage(event) {
    event.preventDefault();
    const body = this.root.querySelector("#privateMessageBody").value;
    await this.#submit(event.submitter, () => this.vm.sendPrivateMessage(this.conversationId, body), () => event.target.reset());
  }

  async #submit(button, operation, onSuccess) {
    if (button) button.disabled = true; this.feedback = ""; this.error = "";
    try { this.feedback = await operation(); onSuccess(); }
    catch (error) { this.error = error.message; }
    finally { if (button) button.disabled = false; this.render(); }
  }

  render() {
    const coach = this.vm.role === "coach";
    if (!this.vm.privateConversations.some(item => item.id === this.conversationId)) this.conversationId = this.vm.privateConversations[0]?.id || "";
    this.root.querySelector("#messagePageDescription").textContent = coach
      ? "Send team-wide announcements or reply privately to an individual guardian."
      : "Read coach announcements and contact the coaching staff privately.";
    this.root.querySelector("#messageFeedback").innerHTML = this.error
      ? `<div class="login-message error">${escapeHtml(this.error)}</div>`
      : this.feedback ? `<div class="login-message success">${escapeHtml(this.feedback)}</div>` : "";
    this.#renderBroadcasts(); this.#renderConversations(); this.#renderThread();
  }

  #renderBroadcasts() {
    const items = [...(this.vm.state.broadcasts || [])].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
    this.root.querySelector("#broadcastCount").textContent = `${items.length} announcement${items.length === 1 ? "" : "s"}`;
    this.root.querySelector("#broadcastList").innerHTML = items.map(item => `
      <article class="announcement-card"><div class="announcement-mark" aria-hidden="true">◆</div><div>
        <div class="announcement-meta"><span class="badge gold">Team broadcast</span><span>${formatDateTime(item.sentAt)}</span></div>
        <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><span class="small muted">${escapeHtml(item.sentByLabel || "Coaching staff")}</span>
      </div></article>`).join("") || empty("The coaching staff has not posted an announcement yet.");
  }

  #renderConversations() {
    const messages = this.vm.state.messages || [];
    this.root.querySelector("#familyThreadList").innerHTML = this.vm.privateConversations.map(conversation => {
      const items = messages.filter(item => this.#belongsTo(item, conversation)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = items[0];
      return `<button class="family-thread-button ${conversation.id === this.conversationId ? "active" : ""}" data-message-conversation="${escapeHtml(conversation.id)}"><strong>${escapeHtml(conversation.label)}</strong><span>${latest ? escapeHtml(latest.body.slice(0, 72)) : escapeHtml(conversation.detail)}</span><small>${items.length} message${items.length === 1 ? "" : "s"}</small></button>`;
    }).join("") || empty("No private guardian conversations are available.");
  }

  #renderThread() {
    const coach = this.vm.role === "coach";
    const conversation = this.vm.privateConversations.find(item => item.id === this.conversationId);
    const label = conversation?.label || "Guardian";
    this.root.querySelector("#messagesLayout").classList.toggle("family-layout", !coach);
    this.root.querySelector("#messageThreadTitle").textContent = coach ? `Conversation with ${label}` : "Message the coaching staff";
    this.root.querySelector("#messagePrivacyNote").textContent = coach
      ? "Visible only to coaches and this individual guardian."
      : "Visible only to you and the coaching staff. Other guardians cannot read or join this conversation.";
    this.root.querySelector("#privateMessageLabel").textContent = coach ? `Reply privately to ${label}` : "Private message to the coaches";
    this.root.querySelector("#privateMessageHelp").textContent = coach ? "This reply is not a team broadcast." : "Messages cannot be seen by another guardian.";
    const items = (this.vm.state.messages || []).filter(item => conversation && this.#belongsTo(item, conversation)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this.root.querySelector("#messageThreadList").innerHTML = items.map(item => {
      const fromCoach = item.senderRole === "coach";
      return `<article class="message-bubble ${fromCoach ? "from-coach" : "from-family"}"><div>${escapeHtml(item.body)}</div><span>${escapeHtml(item.senderLabel || (fromCoach ? "Coach" : label))} · ${formatDateTime(item.createdAt)}</span></article>`;
    }).join("") || empty(coach ? "No private messages with this guardian yet." : "Start a private conversation with the coaching staff.");
    this.root.querySelector("#privateMessageSubmit").disabled = !conversation;
  }
  #belongsTo(message, conversation) {
    return conversation.kind === "guardian" ? message.guardianId === conversation.guardianId : message.familyId === conversation.familyId;
  }
}
