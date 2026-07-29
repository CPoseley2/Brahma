export const fieldModeTemplate = `<dialog id="fieldModeDialog" class="field-mode-dialog">
  <div class="field-mode-shell">
    <header class="field-mode-head">
      <div class="field-session-summary"><p id="fieldModeEyebrow" class="eyebrow">Today’s practice</p><h2 id="fieldModeTitle"></h2><p id="fieldModeMeta"></p></div>
      <div class="field-session-picker"><label for="fieldPracticeSelect">Practice session</label><div class="field-session-picker-row"><button data-field-action="previous-session" aria-label="Previous practice">←</button><select id="fieldPracticeSelect" aria-label="Choose a practice session"></select><button data-field-action="next-session" aria-label="Next practice">→</button></div><small id="fieldSessionFeedback">Choose any scheduled practice to preview.</small></div>
      <button class="field-close" data-field-action="close" aria-label="Close Field Mode">×</button>
    </header>
    <div class="field-progress"><span id="fieldProgressBar"></span></div>
    <div class="field-mode-main">
      <section class="field-current"><div class="field-block-label"><span id="fieldBlockPosition"></span><strong id="fieldBlockLabel"></strong></div><div id="fieldTimer" class="field-timer" aria-live="polite">00:00</div><p id="fieldTimerStatus" class="field-timer-status"></p>
        <div class="field-primary-controls"><button data-field-action="previous">← Back</button><button class="field-start" data-field-action="toggle">Start</button><button data-field-action="next">Next →</button></div><button class="field-reset" data-field-action="reset">Reset this block</button>
      </section>
      <section id="fieldDrillCard" class="field-drill-card"></section>
      <aside class="field-token-card"><div id="fieldTokenChip"></div><div><strong>Token opportunity</strong><p id="fieldTokenPrompt"></p></div></aside>
      <nav id="fieldBlockNav" class="field-block-nav" aria-label="Practice blocks"></nav>
    </div>
  </div>
</dialog>`;
