export const documentsTemplate = `
<section id="documents" class="view shared-view">
  <div class="page-head"><div><p class="eyebrow dark">Team library</p><h2>Docs</h2><p>Find team PDFs, field maps, and shared photos in one private place.</p></div><button class="button primary coach-only-inline" data-action="add-document">Add file</button></div>
  <div id="documentFeedback" aria-live="polite"></div>
  <article id="documentUploadPanel" class="panel coach-only">
    <div class="panel-head"><div><h3>Add to Docs</h3><p>Upload one PDF or image at a time. Files are visible to coaches and team families.</p></div><span class="badge">10 MB maximum</span></div>
    <form id="documentUploadForm" class="form-grid">
      <label class="field"><span>Title</span><input name="title" maxlength="120" required placeholder="Example: Game day guide"></label>
      <label class="field"><span>Category</span><select name="category" required><option value="pdf">PDF</option><option value="map">Map</option><option value="photo">Photo</option></select></label>
      <label class="field full"><span>File</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label>
      <div class="field full document-upload-actions"><span id="documentStorageNote" class="small muted"></span><button class="button primary" type="submit">Upload file</button></div>
    </form>
  </article>
  <div class="toolbar document-toolbar"><input id="documentSearch" type="search" placeholder="Search Docs" aria-label="Search documents"><select id="documentCategoryFilter" aria-label="Filter documents by category"><option value="all">All files</option><option value="pdf">PDFs</option><option value="map">Maps</option><option value="photo">Photos</option></select><span id="documentCount" class="badge blue"></span></div>
  <div id="documentGrid" class="document-grid"></div>
</section>
<dialog id="documentEditDialog"><form class="modal" id="documentEditForm"><div class="modal-head"><div><p class="eyebrow dark">Team library</p><h2>Edit document</h2></div><button type="button" data-action="close-document-edit" class="icon-button" aria-label="Close">×</button></div><input type="hidden" name="id"><div class="form-grid"><label class="field full"><span>Title</span><input name="title" maxlength="120" required></label><label class="field full"><span>Category</span><select name="category" required><option value="pdf">PDF</option><option value="map">Map</option><option value="photo">Photo</option></select></label></div><div class="modal-actions"><button type="button" data-action="close-document-edit" class="button">Cancel</button><button type="submit" class="button primary">Save changes</button></div></form></dialog>`;
