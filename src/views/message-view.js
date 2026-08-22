import { escapeHtml, formatDateTime } from "../shared/format.js";

const empty = message => `<div class="empty-state">${escapeHtml(message)}</div>`;
const messageBody = body => String(body || "").split(/(https?:\/\/[^\s<]+)/g)
  .map(part => /^https?:\/\//.test(part) ? `<a href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>` : escapeHtml(part))
  .join("");

export class MessageView {
  constructor(root, vm) {
    this.root = root; this.vm = vm; this.feedback = ""; this.error = "";
    this.conversationId = vm.privateConversations[0]?.id || "";
    this.filter = "all"; this.search = "";
  }

  mount() {
    this.root.querySelector("#broadcastForm").addEventListener("submit", event => this.#sendBroadcast(event));
    this.root.querySelector("#privateMessageForm").addEventListener("submit", event => this.#sendMessage(event));
    this.root.querySelector("#generateBroadcastDraft").addEventListener("click", () => this.#generateBroadcastDraft());
    this.root.querySelector("#messageConversationSearch").addEventListener("input", event => { this.search = event.target.value; this.#renderConversations(); });
    this.root.addEventListener("click", event => {
      const filter = event.target.closest("[data-message-filter]");
      if (filter) { this.filter = filter.dataset.messageFilter; this.#renderConversations(); return; }
      const quickReply = event.target.closest("[data-quick-reply]");
      if (quickReply) { const field = this.root.querySelector("#privateMessageBody"); field.value = quickReply.dataset.quickReply; field.focus(); return; }
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
  #generateBroadcastDraft() {
    const prompt = this.root.querySelector("#broadcastPrompt").value.trim(); const intent = this.root.querySelector("#broadcastIntent").value; const tone = this.root.querySelector("#broadcastTone").value;
    if (!prompt) { this.error = "Add the key detail first, then I can shape a draft."; this.render(); return; }
    const drafts = { update: ["Team update", "Here’s a quick update for the team:"], reminder: ["Friendly reminder", "A quick reminder for our team:"], schedule: ["Schedule update", "Please note this schedule update:"], celebration: ["A team celebration", "A bright spot from our team:"] };
    const closings = { warm: "Thank you for helping us keep the season running smoothly!", direct: "Please plan accordingly.", encouraging: "We appreciate your flexibility and team spirit!" };
    this.root.querySelector("#broadcastTitle").value = drafts[intent][0]; this.root.querySelector("#broadcastBody").value = `${drafts[intent][1]}\n\n${prompt}\n\n${closings[tone]}`;
    this.feedback = "Smart draft ready—review and personalize it before sending."; this.error = ""; this.render();
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
    const now = Date.now(); const visible = this.vm.privateConversations.filter(conversation => { const items = messages.filter(item => this.#belongsTo(item, conversation)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const latest = items[0]; const text = `${conversation.label} ${conversation.detail} ${latest?.body || ""}`.toLowerCase(); return text.includes(this.search.trim().toLowerCase()) && (this.filter === "all" || (this.filter === "unanswered" && latest?.senderRole === "guardian") || (this.filter === "recent" && latest && now - new Date(latest.createdAt).getTime() < 7 * 86400000)); });
    this.root.querySelector("#inboxVisibleCount").textContent = `${visible.length} shown`;
    this.root.querySelectorAll("[data-message-filter]").forEach(button => button.classList.toggle("active", button.dataset.messageFilter === this.filter));
    this.root.querySelector("#familyThreadList").innerHTML = visible.map(conversation => {
      const items = messages.filter(item => this.#belongsTo(item, conversation)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = items[0];
      return `<button class="family-thread-button ${conversation.id === this.conversationId ? "active" : ""}" data-message-conversation="${escapeHtml(conversation.id)}"><strong>${escapeHtml(conversation.label)} ${latest?.senderRole === "guardian" ? "<em>Needs reply</em>" : ""}</strong><span>${latest ? escapeHtml(latest.body.slice(0, 72)) : escapeHtml(conversation.detail)}</span><small>${latest ? formatDateTime(latest.createdAt) : "No messages yet"}</small></button>`;
    }).join("") || empty("No conversations match these filters.");
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
      return `<article class="message-bubble ${fromCoach ? "from-coach" : "from-family"}"><div>${messageBody(item.body)}</div><span>${escapeHtml(item.senderLabel || (fromCoach ? "Coach" : label))} · ${formatDateTime(item.createdAt)}</span></article>`;
    }).join("") || empty(coach ? "No private messages with this guardian yet." : "Start a private conversation with the coaching staff.");
    this.root.querySelector("#quickReplyBar").innerHTML = coach && conversation ? ["Thanks for reaching out—we’ll follow up shortly.", "Absolutely. We’ll make a note of that.", "Thanks for the update. See you at the next session!"].map(reply => `<button type="button" data-quick-reply="${escapeHtml(reply)}">${escapeHtml(reply)}</button>`).join("") : "";
    this.root.querySelector("#privateMessageSubmit").disabled = !conversation;
  }
  #belongsTo(message, conversation) {
    return conversation.kind === "guardian" ? message.guardianId === conversation.guardianId : message.familyId === conversation.familyId;
  }
}
