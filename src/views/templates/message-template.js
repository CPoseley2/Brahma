export const messageTemplate = `
<section id="messages" class="view shared-view">
  <div class="page-head"><div><p class="eyebrow dark">Team communication</p><h2>Messages</h2><p id="messagePageDescription"></p></div></div>
  <div id="messageFeedback" aria-live="polite"></div>
  <article id="broadcastComposer" class="panel announcement-composer coach-only">
    <div class="panel-head"><div><p class="eyebrow dark">Communication studio</p><h3>Send a team announcement</h3><p>Set the context once, then start from a clear, family-friendly draft.</p></div><span class="badge gold">Entire team</span></div>
    <form id="broadcastForm" class="form-grid">
      <div class="message-studio full">
        <div class="message-studio-controls"><label class="field"><span>Message type</span><select id="broadcastIntent"><option value="update">Team update</option><option value="reminder">Friendly reminder</option><option value="schedule">Schedule change</option><option value="celebration">Team celebration</option></select></label><label class="field"><span>Voice</span><select id="broadcastTone"><option value="warm">Warm & clear</option><option value="direct">Direct</option><option value="encouraging">Encouraging</option></select></label></div>
        <label class="field"><span>What should families know?</span><input id="broadcastPrompt" maxlength="240" placeholder="e.g., Thursday practice moves to Field 2 at 5:30 PM"></label>
        <div class="message-studio-actions"><span class="small muted">Draft suggestions keep the coach in control. Review every word before sending.</span><button id="generateBroadcastDraft" class="button secondary" type="button">Create smart draft</button></div>
      </div>
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
      <div class="panel-head"><div><h3>Guardian inbox</h3><p>Find the conversations that need your attention.</p></div><span id="inboxVisibleCount" class="badge blue"></span></div>
      <div class="inbox-tools"><label class="sr-only" for="messageConversationSearch">Search guardian conversations</label><input id="messageConversationSearch" type="search" placeholder="Search guardian or message"><div id="messageInboxFilters" class="filter-chips" aria-label="Conversation filters"><button class="active" type="button" data-message-filter="all">All</button><button type="button" data-message-filter="unanswered">Needs reply</button><button type="button" data-message-filter="recent">Recent</button></div></div>
      <div id="familyThreadList" class="family-thread-list"></div>
    </aside>
    <article class="panel conversation-panel">
      <div class="panel-head"><div><h3 id="messageThreadTitle">Private conversation</h3><p id="messagePrivacyNote"></p></div><span class="badge">Private</span></div>
      <div id="messageThreadList" class="message-thread" aria-live="polite"></div>
      <div id="quickReplyBar" class="quick-reply-bar coach-only" aria-label="Quick reply suggestions"></div>
      <form id="privateMessageForm" class="message-compose">
        <label class="field"><span id="privateMessageLabel">Message</span><textarea id="privateMessageBody" maxlength="4000" rows="3" required></textarea></label>
        <div class="message-form-actions"><span id="privateMessageHelp" class="small muted"></span><button id="privateMessageSubmit" class="button primary" type="submit">Send private message</button></div>
      </form>
    </article>
  </div>
</section>`;
