import { escapeHtml, formatDate, formatTime, todayIso } from "../shared/format.js";
import { fieldMapAsset, gameMapDetails, hasFieldMap, locationForEvent } from "../shared/field-location.js";
import { ALL_FIELD_MAP_LOCATIONS, confirmedEventsForMapSelection } from "../shared/field-map-explorer.js";

const archiveBadge = asset => `<span class="badge ${asset?.position ? "blue" : "gold"}">${asset?.position ? escapeHtml(asset.sourceLabel || "Archive ready") : "Archive pending"}</span>`;

export class FieldGuideView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.message = ""; this.selectedAssetId = ALL_FIELD_MAP_LOCATIONS; this.selectedEventId = ""; }
  mount() {
    this.root.addEventListener("click", event => this.#onClick(event));
    this.root.addEventListener("change", event => this.#onChange(event));
  }

  #onChange(event) {
    const locationSelect = event.target.closest("[data-field-location-picker]");
    const dateSelect = event.target.closest("[data-field-date-picker]");
    if (locationSelect) { this.selectedAssetId = locationSelect.value; this.selectedEventId = ""; this.render(); }
    if (dateSelect) { this.selectedEventId = dateSelect.value; this.render(); }
  }

  async #onClick(event) {
    const button = event.target.closest("[data-field-share]"); if (!button) return;
    const field = this.vm.state.fields.find(item => item.id === button.dataset.fieldShare);
    const asset = fieldMapAsset(field || {}, this.vm.state.fieldMapAssets || []); if (!field || !asset) return;
    const url = new URL(asset.previewUrl || asset.url, window.location.href).href;
    const text = [field.name, `Field ${field.code || asset.fieldCode}`, field.arrivalInstructions, url].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: field.name, text, url });
      else { await navigator.clipboard.writeText(text); this.message = "Field archive link copied."; this.render(); }
    } catch (error) { if (error.name !== "AbortError") { this.message = "Could not share automatically. Open the field image and share it from your browser."; this.render(); } }
  }

  render() {
    const fields = [...(this.vm.state.fields || [])]; const events = [...(this.vm.state.games || [])]; const archives = this.#archives(fields);
    const usedIds = new Set(events.map(event => event.fieldId).filter(Boolean));
    fields.sort((a, b) => Number(usedIds.has(b.id)) - Number(usedIds.has(a.id)) || a.name.localeCompare(b.name));
    this.root.querySelector("#fieldGuideDescription").textContent = this.vm.role === "coach"
      ? "Browse every confirmed date or narrow by location. The scheduled event highlights its field and supplies the matchup, time, coaches, and age group."
      : "Choose a confirmed date across all locations—or narrow the list—to see the exact field your player is expected at.";
    this.root.querySelector("#fieldGuideFeedback").innerHTML = this.message ? `<div class="login-message success">${escapeHtml(this.message)}</div>` : "";
    const diagramCount = fields.filter(field => hasFieldMap(field, archives)).length;
    this.root.querySelector("#fieldDirectoryCount").textContent = `${diagramCount} mapped field${diagramCount === 1 ? "" : "s"}`;
    this.#renderExplorer(events, fields, archives);
    this.root.querySelector("#fieldGuideGrid").innerHTML = fields.map(field => this.#fieldCard(field, usedIds.has(field.id), archives)).join("")
      || `<div class="empty-state">The club field archive is waiting for its first PNG or PDF.</div>`;
  }

  #archives(fields) {
    const configured = [...(this.vm.state.fieldMapAssets || [])];
    fields.forEach(field => {
      const asset = fieldMapAsset(field, configured);
      if (!asset?.archiveId || configured.some(item => item.id === asset.archiveId)) return;
      configured.push({ id: asset.archiveId, name: asset.locationName || field.park || field.name, park: field.park || field.name, previewUrl: asset.previewUrl, originalUrl: asset.url, contentType: asset.contentType, page: asset.page, alt: asset.alt, sourceLabel: asset.sourceLabel, fields: {} });
    });
    return configured.sort((a, b) => String(a.park || a.name).localeCompare(String(b.park || b.name)));
  }

  #renderExplorer(events, fields, archives) {
    const container = this.root.querySelector("#nextGameMap"); const controls = this.root.querySelector("#fieldMapControls");
    if (!archives.length) {
      controls.innerHTML = "";
      container.innerHTML = `<div class="empty-state">No location maps have been added to the Firestore archive yet.</div>`;
      return;
    }
    if (this.selectedAssetId !== ALL_FIELD_MAP_LOCATIONS && !archives.some(asset => asset.id === this.selectedAssetId)) this.selectedAssetId = ALL_FIELD_MAP_LOCATIONS;
    const allLocations = this.selectedAssetId === ALL_FIELD_MAP_LOCATIONS;
    const selectedArchive = archives.find(asset => asset.id === this.selectedAssetId) || null;
    const confirmed = confirmedEventsForMapSelection(events, fields, archives, this.selectedAssetId);
    if (!confirmed.some(event => event.id === this.selectedEventId)) {
      this.selectedEventId = confirmed.find(event => event.date >= todayIso())?.id || confirmed.at(-1)?.id || "";
    }
    const selectedEvent = confirmed.find(event => event.id === this.selectedEventId) || null;
    const locationOptions = `<option value="${ALL_FIELD_MAP_LOCATIONS}" ${allLocations ? "selected" : ""}>All locations</option>${archives.map(asset => `<option value="${escapeHtml(asset.id)}" ${asset.id === selectedArchive?.id ? "selected" : ""}>${escapeHtml(asset.park || asset.name || asset.id)}</option>`).join("")}`;
    const dateOptions = confirmed.length ? confirmed.map(event => {
      const location = locationForEvent(event, fields);
      const venue = location?.park || location?.name || event.location || "Location TBD";
      const locationLabel = allLocations ? ` · ${escapeHtml(venue)}` : "";
      return `<option value="${escapeHtml(event.id)}" ${event.id === this.selectedEventId ? "selected" : ""}>${formatDate(event.date)} · ${formatTime(event.time)}${locationLabel} · Field ${escapeHtml(location?.code || event.fieldCode || "TBD")}</option>`;
    }).join("") : `<option>${allLocations ? "No confirmed dates across club locations" : "No confirmed dates at this location"}</option>`;
    controls.innerHTML = `<div><p class="eyebrow dark">Find your field</p><h3>${allLocations ? "All locations" : escapeHtml(selectedArchive?.park || selectedArchive?.name || "Location map")}</h3></div><div class="field-map-pickers"><label><span>Location</span><select data-field-location-picker>${locationOptions}</select></label><label><span>Confirmed date</span><select data-field-date-picker ${confirmed.length ? "" : "disabled"}>${dateOptions}</select></label></div>`;
    container.innerHTML = selectedEvent ? this.#scheduledGameMap(selectedEvent, fields, archives) : allLocations ? this.#allLocationsEmpty() : this.#archiveOnly(selectedArchive);
  }

  #allLocationsEmpty() {
    return `<div class="empty-state">No confirmed game dates are currently posted across the club’s mapped locations.</div>`;
  }

  #archiveOnly(asset) {
    const source = asset.previewUrl || asset.originalUrl;
    const fieldCodes = Object.keys(asset.fields || {});
    if (!source) return `<div class="empty-state">${escapeHtml(asset.park || asset.name)} does not have a preview image yet.</div>`;
    return `<div class="coach-game-map"><div class="field-diagram-stage"><img class="field-diagram-media" src="${escapeHtml(source)}" alt="${escapeHtml(asset.alt || `${asset.park || asset.name} field map`)}"></div><section class="game-map-assignment archive-empty"><span class="game-map-label">Location archive</span><strong>No confirmed dates are currently posted here.</strong><p>${fieldCodes.length ? `Mapped fields: ${fieldCodes.map(escapeHtml).join(", ")}.` : "Field coordinates will appear when they are configured."}</p></section></div>`;
  }

  #scheduledGameMap(event, fields, archives) {
    const details = gameMapDetails(event, this.vm.state.team || {}, fields, archives);
    const asset = details.mapAsset;
    const assignment = `<section class="game-map-assignment"><span class="game-map-label">Confirmed at this location</span><div class="game-map-matchup"><div><small>Home</small><strong>${escapeHtml(details.homeTeamName)}</strong></div><b>vs</b><div><small>Away</small><strong>${escapeHtml(details.awayTeamName)}</strong></div></div><dl><div><dt>Game time</dt><dd>${formatTime(details.time)}</dd></div><div><dt>Game date</dt><dd>${formatDate(details.date)}</dd></div><div><dt>Age group</dt><dd>${escapeHtml(details.ageGroup)}</dd></div><div><dt>Coach 1 · Home</dt><dd>${escapeHtml(details.homeCoachName)}</dd></div><div><dt>Coach 2 · Away</dt><dd>${escapeHtml(details.awayCoachName)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(details.locationName)}</dd></div><div><dt>Field code</dt><dd>${escapeHtml(details.fieldCode)}</dd></div></dl></section>`;
    let visual;
    if (asset?.position) {
      const source = asset.previewUrl || asset.url;
      const media = asset.contentType === "application/pdf" && !asset.previewUrl
        ? `<iframe class="field-diagram-media" title="${escapeHtml(asset.alt)}" src="${escapeHtml(source)}#page=${asset.page}&view=FitH"></iframe>`
        : `<img class="field-diagram-media" src="${escapeHtml(source)}" alt="${escapeHtml(asset.alt)}">`;
      const position = asset.position; const placement = position.labelPlacement === "above" ? "above" : "below";
      const regionStyle = `left:${position.xPercent}%;top:${position.yPercent}%;${position.widthPercent ? `width:${position.widthPercent}%;` : ""}${position.heightPercent ? `height:${position.heightPercent}%;` : ""}--field-rotation:${position.rotation || 0}deg`;
      const smartField = `<div class="smart-field-assignment ${placement}" style="left:${position.xPercent}%;top:${position.yPercent}%"><span>You’re expected at Field ${escapeHtml(details.fieldCode)}</span><strong>${escapeHtml(details.homeTeamName)} vs ${escapeHtml(details.awayTeamName)}</strong><small>${formatDate(details.date)} · ${formatTime(details.time)} · ${escapeHtml(details.ageGroup)}</small></div>`;
      visual = `<div class="field-diagram-stage" aria-live="polite">${media}<span class="field-diagram-focus ${position.widthPercent ? "region" : ""}" style="${regionStyle}" aria-hidden="true"></span>${smartField}</div>`;
    } else {
      visual = `<div class="field-diagram-stage missing"><div><strong>Archival map not added for Field ${escapeHtml(details.fieldCode)}</strong><span>Add the location asset and register this field code’s X/Y region.</span></div></div>`;
    }
    const actions = `<footer class="game-map-actions"><span>${escapeHtml(details.locationName)} · Field ${escapeHtml(details.fieldCode)}</span><div class="button-row">${asset?.previewUrl ? `<a class="button small primary" href="${escapeHtml(asset.previewUrl)}" target="_blank" rel="noopener noreferrer">Open field image</a>` : ""}${asset ? `<a class="button small" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">Open original ${asset.contentType === "application/pdf" ? "PDF" : "map"}</a>` : ""}${this.vm.role === "coach" ? `<button class="button small" data-route="schedule">Edit game</button>` : ""}</div></footer>`;
    return `<div class="coach-game-map">${visual}${assignment}${actions}</div>`;
  }

  #fieldCard(field, used, archives) {
    const asset = fieldMapAsset(field, archives);
    const preview = asset?.previewUrl || (asset?.contentType?.startsWith("image/") ? asset.url : "");
    return `<article class="field-guide-card ${used ? "team-field" : ""}">${preview ? `<div class="field-guide-thumb"><img src="${escapeHtml(preview)}" alt="${escapeHtml(asset.alt)}"><span>Field ${escapeHtml(field.code || asset.fieldCode)}</span></div>` : ""}<div class="field-guide-card-head"><div><span>${used ? "On your team schedule" : escapeHtml(field.park || "Club field")}</span><h3>${escapeHtml(field.name)}</h3></div></div><div class="button-row">${archiveBadge(asset)}${field.code ? `<span class="badge">Field ${escapeHtml(field.code)}</span>` : ""}</div>${field.address ? `<p>${escapeHtml(field.address)}</p>` : ""}${field.arrivalInstructions || field.parking ? `<div class="arrival-callout"><strong>${escapeHtml(field.arrivalLabel || "Game-day notes")}</strong><span>${escapeHtml(field.arrivalInstructions || field.parking)}</span></div>` : ""}<div class="button-row">${asset?.previewUrl ? `<a class="button small primary" href="${escapeHtml(asset.previewUrl)}" target="_blank" rel="noopener noreferrer">Open image</a>` : ""}${asset ? `<a class="button small" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">Original ${asset.contentType === "application/pdf" ? "PDF" : "map"}</a><button class="button small" data-field-share="${escapeHtml(field.id)}">Share</button>` : ""}</div></article>`;
  }
}
