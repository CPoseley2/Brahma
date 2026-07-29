export const rosterImportTemplate = `
<article class="panel roster-import-panel">
  <div class="panel-head"><div><h3>Import player roster</h3><p>Add or update athletes, family contacts, and guardian invitations from one file.</p></div><button class="button" data-action="download-roster-template">Download CSV template</button></div>
  <div class="import-dropzone">
    <div><strong>CSV or Excel (.xlsx)</strong><p class="small muted">Maximum 100 athletes and 5 MB. Your file is validated in this browser before import.</p></div>
    <label class="button primary" for="rosterImportInput">Choose roster file</label>
    <input id="rosterImportInput" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
  </div>
  <div id="rosterImportStatus" aria-live="polite"></div>
  <div id="rosterImportPreview" class="hidden">
    <div class="import-summary" id="rosterImportSummary"></div>
    <div id="rosterImportWarnings"></div>
    <div class="table-wrap"><table><thead><tr><th>Action</th><th>Athlete</th><th>Gender</th><th>Birthdate</th><th>Parent email</th><th>Parent phone</th></tr></thead><tbody id="rosterImportBody"></tbody></table></div>
    <div class="modal-actions"><button class="button" data-action="cancel-roster-import">Cancel</button><button class="button primary" data-action="confirm-roster-import">Import athletes</button></div>
  </div>
</article>`;
