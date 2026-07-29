export const sharedTemplate = `
<section id="schedule" class="view shared-view">
  <div class="page-head"><div><p class="eyebrow dark">Team calendar</p><h2>Games & Events</h2><p id="scheduleDescription">Manage the team schedule.</p></div><button class="button primary coach-only-inline" data-action="new-game">Add event</button></div>
  <div id="scheduleFeedback" aria-live="polite"></div>
  <div id="gamesList" class="card-list"></div>
</section>
<section id="volunteers" class="view shared-view">
  <div class="page-head"><div><p class="eyebrow dark">Team support</p><h2>Volunteers</h2><p id="volunteerDescription">Create and assign team jobs.</p></div><button class="button primary coach-only-inline" data-action="new-volunteer">Add job</button></div>
  <div class="two-column"><article class="panel"><h3>Volunteer jobs</h3><div id="volunteerList" class="card-list"></div></article><article class="panel"><h3>Coverage</h3><div id="volunteerSummary" class="summary-box"></div></article></div>
</section>`;
