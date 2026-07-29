export const playbookTemplate = `
<section id="playbook" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Season curriculum</p><h2>13-Week Practice Playbook</h2><p>Two joyful, one-hour practices each week. Every session moves from exploration to a small-sided game and closes by noticing character in action.</p></div><button class="button" data-action="print-playbook">Print selected week</button></div>
  <div class="playbook-principles">
    <article><strong>Play first</strong><span>Children spend the hour moving, imagining, deciding, and touching the ball.</span></article>
    <article><strong>No elimination</strong><span>A mistake creates the next repetition; nobody waits outside the game.</span></article>
    <article><strong>Tokens tell stories</strong><span>Reward a visible choice—not talent, goals, speed, or comparison.</span></article>
    <article><strong>Game is the teacher</strong><span>Every practice includes at least 14 minutes of free small-sided soccer.</span></article>
  </div>
  <div id="tokenDomainGuide" class="token-domain-grid"></div>
  <div class="toolbar playbook-toolbar"><label class="field"><span>Week</span><select id="playbookWeek"></select></label><div id="playbookSummary" class="summary-box compact"></div></div>
  <div id="seasonSessionList" class="season-session-list"></div>
</section>
<section id="drills" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Coaching library</p><h2>Drill Cards</h2><p>Use the text cards now. Add a PNG to any drill when artwork is ready; the image becomes part of the shared coaching library.</p></div></div>
  <div id="drillArtworkWorkflow" class="info-banner"></div>
  <div class="toolbar"><input id="drillSearch" type="search" placeholder="Search drills, stories, or coaching cues"><select id="drillDomainFilter"><option value="all">All token domains</option></select></div>
  <div id="drillLibraryFeedback" aria-live="polite"></div>
  <div id="drillLibraryStats" class="summary-box compact"></div>
  <div id="drillCardGrid" class="drill-card-grid"></div>
</section>`;
