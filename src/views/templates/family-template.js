export const familyTemplate = `
<section id="family-home" class="view family-only family-dashboard">
  <div id="familyHero" class="family-season-hero"></div>
  <div id="familyPlayerPicker" class="family-player-picker" aria-label="Choose a player"></div>
  <div class="family-dashboard-grid">
    <article id="familyNextEvent" class="family-next-card"></article>
    <article class="family-token-panel">
      <div class="family-section-head"><div><p class="eyebrow dark">The token trail</p><h2>Growth you can feel</h2><p>Tap a token to explore the moments the coach has shared.</p></div><span class="family-chart-note">A snapshot—not a grade</span></div>
      <div id="familyTokenChart" class="family-token-chart"></div>
      <div id="familyTokenDetail" class="family-token-detail"></div>
    </article>
    <article class="family-story-panel">
      <div class="family-section-head"><div><p class="eyebrow dark">Season story</p><h2>Latest celebrations</h2></div><button class="button" data-route="my-player">Full story</button></div>
      <div id="familyStoryPreview" class="family-story-list"></div>
    </article>
    <article id="familyActionCenter" class="family-action-panel"></article>
  </div>
</section>
<section id="my-player" class="view family-only"><div class="page-head"><div><p class="eyebrow dark">Our season</p><h2>Season Story</h2><p>Coach-shared celebrations and playful next steps—never rankings.</p></div></div><div id="myPlayerContent"></div></section>
<section id="team-philosophy" class="view family-only"><div class="page-head"><div><p class="eyebrow dark">How we coach</p><h2>Team Philosophy</h2><p>A child-centered first soccer experience.</p></div></div><div class="standards-grid">
  <article class="standard-card"><h3>Belonging first</h3><p>Every child should feel safe, included, and welcome on the field.</p></article><article class="standard-card"><h3>Brave attempts</h3><p>Trying, missing, recovering, and trying again are the work of learning.</p></article><article class="standard-card"><h3>Play teaches</h3><p>Short explanations and active games leave room for discovery.</p></article><article class="standard-card"><h3>No tiny professionals</h3><p>We do not expect adult tactics, fixed positions, or polished passing patterns from young children.</p></article>
</div></section>`;
