export const messageTemplate = `
<section id="messages" class="view shared-view">
  <div class="page-head"><div><p class="eyebrow dark">Team communication</p><h2>Messages</h2><p id="messagePageDescription"></p></div></div>
  <div id="messageFeedback" aria-live="polite"></div>
  <article id="broadcastComposer" class="panel announcement-composer coach-only">
    <div class="panel-head"><div><h3>Send a team announcement</h3><p>Every active coach and family member will be able to read this broadcast.</p></div><span class="badge gold">Entire team</span></div>
    <form id="broadcastForm" class="form-grid">
      <label class="field full"><span>Announcement title</span><input id="broadcastTitle" maxlength="120" required placeholder="Practice update"></label>
      <label class="field full"><span>Message</span><textarea id="broadcastBody" maxlength="8000" rows="5" required placeholder="Share the complete update with the team."></textarea></label>
      <div class="field full message-form-actions"><span>Broadcasts are team-wide and cannot be sent privately.</span><button class="button primary" type="submit">Review and send to team</button></div>
    </form>
  </article>
  <article class="panel">
    <div class="panel-head"><div><h3>Team announcements</h3><p>Official updates sent by the coaching staff.</p></div><span id="broadcastCount" class="badge blue"></span></div>
    <div id="broadcastList" class="announcement-list"></div>
  </article>
  <div id="messagesLayout" class="message-layout">
    <aside id="familyInboxPanel" class="panel family-inbox coach-only">
      <div class="panel-head"><div><h3>Guardian inbox</h3><p>Choose a private one-to-one guardian conversation.</p></div></div>
      <div id="familyThreadList" class="family-thread-list"></div>
    </aside>
    <article class="panel conversation-panel">
      <div class="panel-head"><div><h3 id="messageThreadTitle">Private conversation</h3><p id="messagePrivacyNote"></p></div><span class="badge">Private</span></div>
      <div id="messageThreadList" class="message-thread" aria-live="polite"></div>
      <form id="privateMessageForm" class="message-compose">
        <label class="field"><span id="privateMessageLabel">Message</span><textarea id="privateMessageBody" maxlength="4000" rows="3" required></textarea></label>
        <div class="message-form-actions"><span id="privateMessageHelp" class="small muted"></span><button id="privateMessageSubmit" class="button primary" type="submit">Send private message</button></div>
      </form>
    </article>
  </div>
</section>`;
