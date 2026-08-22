import { rosterImportTemplate } from "./roster-import-template.js";

export const coachTemplate = `
<section id="coach-dashboard" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Coach workspace</p><h2>Team dashboard</h2><p>Review the season at a glance or bring in a new player roster.</p></div><button class="button primary" data-route="data-settings">Import roster</button></div>
  <section id="todayPracticeCard" class="today-practice-card"></section>
  <div class="stats-grid">
    <article class="stat-card"><strong id="statPlayers">0</strong><span>active players</span></article>
    <article class="stat-card"><strong id="statDue">0</strong><span>development updates due</span></article>
    <article class="stat-card"><strong id="statGames">0</strong><span>scheduled games</span></article>
    <article class="stat-card"><strong id="statOpenVolunteers">0</strong><span>open volunteer jobs</span></article>
  </div>
  <div class="two-column">
    <article class="panel"><div class="panel-head"><div><h2>Player check-ins</h2><p>Short observations, not grades.</p></div><button class="button primary" data-route="development">Open development log</button></div><div id="duePlayers" class="card-list"></div></article>
    <article class="panel"><div class="panel-head"><div><h2>Next on the calendar</h2><p>Games and team activity.</p></div><button class="button" data-route="schedule">Manage</button></div><div id="coachUpcoming" class="card-list"></div></article>
  </div>
  <article class="panel"><div class="panel-head"><div><h2>Recent player notes</h2><p>Private coach notes stay private unless explicitly shared.</p></div></div><div id="recentObservations" class="timeline"></div></article>
</section>
<section id="development" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Coach tools</p><h2>Player Development</h2><p>Observe the child in play, record only what is useful, and avoid ranking players against one another.</p></div><button class="button primary" data-action="new-observation">Log an update</button></div>
  <div class="info-banner"><strong>Observation scale:</strong> Not observed · Exploring · Emerging · Seen in play. These labels describe what the coach noticed, not a permanent ability level.</div>
  <div class="toolbar"><input id="developmentSearch" type="search" placeholder="Search players"><select id="developmentDueFilter"><option value="all">All players</option><option value="due">Updates due</option><option value="recent">Updated recently</option></select></div>
  <div id="developmentGrid" class="player-grid"></div>
</section>
<section id="sessions" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Coach tools</p><h2>Practice Sessions</h2><p>Scheduled Practice events appear here automatically. Add attendance, focus areas, and one useful reflection to each practice.</p></div><button class="button primary" data-route="schedule">Manage practice schedule</button></div>
  <div class="info-banner"><strong>One schedule:</strong> Create or change practice dates in Schedule. This view keeps the attendance and coaching record for each scheduled practice.</div>
  <div id="sessionsList" class="card-list"></div>
</section>
<section id="roster" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Private</p><h2>Roster</h2><p>Manage player details and guardian access. This private information is never shown to other families.</p></div><div class="button-row"><button class="button" data-action="print">Print</button><button class="button" data-action="add-coach">Add coach</button><button class="button primary" data-action="new-player">Add player</button></div></div>
  <div class="toolbar"><input id="rosterSearch" type="search" placeholder="Search player or guardian contact"><select id="rosterFilter"><option value="active">Active</option><option value="all">All</option><option value="inactive">Inactive</option></select></div>
  <div class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>Player</th><th>Age</th><th>Birthday</th><th>Contacts & access</th><th>Status</th><th></th></tr></thead><tbody id="rosterBody"></tbody></table></div></div>
</section>
<section id="standards" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Methodology</p><h2>U6 Development Framework</h2><p>Official U.S. guidance translated into practical observation prompts.</p></div></div>
  <div class="info-banner"><strong>Important:</strong> There is no national U6 pass/fail test in these sources. This framework is a coaching aid.</div>
  <div id="standardsGrid" class="standards-grid"></div>
</section>
<section id="data-settings" class="view coach-only">
  <div class="page-head"><div><p class="eyebrow dark">Live team data</p><h2>Data & Settings</h2><p>Manage the team profile, roster imports, and a portable data backup.</p></div></div>
  ${rosterImportTemplate}
  <div class="two-column data-settings-grid"><article class="panel"><h3>Team settings</h3><div class="form-grid">
    <label class="field full"><span>Team label</span><input id="settingsTeamName"></label><label class="field"><span>Season</span><input id="settingsSeason"></label><label class="field"><span>Update reminder cadence</span><input id="settingsCadence" type="number" min="1" max="90"></label><label class="field full"><span>Team philosophy</span><textarea id="settingsPhilosophy" rows="4"></textarea></label>
  </div><button class="button primary" data-action="save-settings">Save settings</button></article>
  <article class="panel"><h3>Portable backup</h3><p>Download a read-only JSON copy of the team data currently visible to your account.</p><div class="button-row"><button class="button" data-action="export">Download JSON backup</button></div></article></div>
</section>`;
