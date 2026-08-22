import { escapeHtml, formatDate, formatTime, todayIso } from "../shared/format.js";
import { fieldMapAsset, gameMapDetails, hasExactPin, hasFieldMap, locationForEvent, locationLinks } from "../shared/field-location.js";

const exactBadge = field => `<span class="badge ${hasExactPin(field) ? "blue" : "gold"}">${hasExactPin(field) ? "Exact pin verified" : "Address only"}</span>`;

export class FieldGuideView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.message = ""; }
  mount() { this.root.addEventListener("click", event => this.#onClick(event)); }

  async #onClick(event) {
    const button = event.target.closest("[data-field-share]"); if (!button) return;
    const field = this.vm.state.fields.find(item => item.id === button.dataset.fieldShare);
    const links = locationLinks(field); if (!field || !links) return;
    const text = [field.name, field.arrivalLabel, field.address, field.arrivalInstructions, links.directions].filter(Boolean).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: field.name, text, url: links.directions });
      else { await navigator.clipboard.writeText(text); this.message = "Field directions copied."; this.render(); }
    } catch (error) { if (error.name !== "AbortError") { this.message = "Could not share automatically. Open directions and share from your map app."; this.render(); } }
  }

  render() {
    const fields = [...(this.vm.state.fields || [])]; const events = [...this.vm.state.games];
    const usedIds = new Set(events.map(event => event.fieldId).filter(Boolean));
    fields.sort((a, b) => Number(usedIds.has(b.id)) - Number(usedIds.has(a.id)) || a.name.localeCompare(b.name));
    this.root.querySelector("#fieldGuideDescription").textContent = this.vm.role === "coach"
      ? "Assign the game details in Schedule. Your field card is placed on the club’s venue map."
      : "Open your game and drive to the exact field pin—not simply the park address.";
    this.root.querySelector("#fieldGuideFeedback").innerHTML = this.message ? `<div class="login-message success">${escapeHtml(this.message)}</div>` : "";
    const diagramCount = fields.filter(hasFieldMap).length;
    this.root.querySelector("#fieldDirectoryCount").textContent = diagramCount ? `${diagramCount} field diagrams` : `${fields.filter(hasExactPin).length} exact pins`;
    this.#renderNext(events, fields);
    this.root.querySelector("#fieldGuideGrid").innerHTML = fields.map(field => this.#fieldCard(field, usedIds.has(field.id))).join("")
      || `<div class="empty-state">The club field repository is waiting for its first verified map.</div>`;
  }

  #renderNext(events, fields) {
    const upcoming = events.filter(event => event.status === "Scheduled" && event.date >= todayIso()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const next = upcoming.find(event => ["game", "scrimmage", "jamboree"].includes(String(event.type).toLowerCase())) || upcoming[0];
    const container = this.root.querySelector("#nextGameMap");
    if (!next) { container.innerHTML = `<div class="empty-state">The next game has not been assigned yet. Once it is posted, the exact destination will appear here.</div>`; return; }
    const location = locationForEvent(next, fields); const links = locationLinks(location);
    if (!location) { container.innerHTML = `<div class="field-map-copy"><p class="eyebrow">Next up</p><h2>${escapeHtml(next.type)} · ${formatDate(next.date)}</h2><p>The exact field has not been assigned. Ask the coach to choose a trusted field map before game day.</p></div>`; return; }
    if (this.vm.role === "coach" && ["game", "scrimmage", "jamboree"].includes(String(next.type).toLowerCase())) {
      container.innerHTML = this.#coachGameMap(next, fields, links);
      return;
    }
    if (!links) { container.innerHTML = `<div class="field-map-copy"><p class="eyebrow">Next up</p><h2>${escapeHtml(next.type)} · ${formatDate(next.date)}</h2><p>Directions have not been configured for this location yet.</p></div>`; return; }
    container.innerHTML = `<div class="field-map-copy"><p class="eyebrow">Your next ${escapeHtml(next.type.toLowerCase())}</p><h2>${formatDate(next.date)} · ${formatTime(next.time)}</h2><h3>${escapeHtml(location.name)}</h3>${exactBadge(location)}<p>${escapeHtml(location.arrivalLabel || location.address || "Open the pin for the arrival point.")}</p>${location.arrivalInstructions ? `<div class="arrival-callout"><strong>Final walk</strong><span>${escapeHtml(location.arrivalInstructions)}</span></div>` : ""}${location.parking ? `<p class="parking-note"><strong>Parking:</strong> ${escapeHtml(location.parking)}</p>` : ""}<div class="button-row"><a class="button primary" href="${escapeHtml(links.directions)}" target="_blank" rel="noopener noreferrer">Drive to exact pin</a><a class="button" href="${escapeHtml(links.appleMaps)}" target="_blank" rel="noopener noreferrer">Apple Maps</a><button class="button" data-field-share="${escapeHtml(location.id)}">Share</button></div></div><iframe class="field-map-frame" title="Exact map for ${escapeHtml(location.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escapeHtml(links.embed)}"></iframe>`;
  }

  #coachGameMap(event, fields, links) {
    const details = gameMapDetails(event, this.vm.state.team || {}, fields);
    const asset = details.mapAsset;
    const fieldCard = `<section class="game-map-assignment"><span class="game-map-label">Your field</span><div class="game-map-matchup"><div><small>Home</small><strong>${escapeHtml(details.homeTeamName)}</strong></div><b>vs</b><div><small>Away</small><strong>${escapeHtml(details.awayTeamName)}</strong></div></div><dl><div><dt>Game time</dt><dd>${formatTime(details.time)}</dd></div><div><dt>Game date</dt><dd>${formatDate(details.date)}</dd></div><div><dt>Age group</dt><dd>${escapeHtml(details.ageGroup)}</dd></div><div><dt>Coach 1 · Home</dt><dd>${escapeHtml(details.homeCoachName)}</dd></div><div><dt>Coach 2 · Away</dt><dd>${escapeHtml(details.awayCoachName)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(details.locationName)}</dd></div><div><dt>Field code</dt><dd>${escapeHtml(details.fieldCode)}</dd></div></dl></section>`;
    let visual;
    if (asset?.position) {
      const source = asset.previewUrl || asset.url;
      const media = asset.contentType === "application/pdf" && !asset.previewUrl
        ? `<iframe class="field-diagram-media" title="${escapeHtml(asset.alt)}" src="${escapeHtml(source)}#page=${asset.page}&view=FitH"></iframe>`
        : `<img class="field-diagram-media" src="${escapeHtml(source)}" alt="${escapeHtml(asset.alt)}">`;
      visual = `<div class="field-diagram-stage">${media}<span class="field-diagram-pin" style="left:${asset.position.xPercent}%;top:${asset.position.yPercent}%" aria-hidden="true"><i></i></span>${fieldCard}<span class="field-code-chip" style="left:${asset.position.xPercent}%;top:${asset.position.yPercent}%">${escapeHtml(details.fieldCode)}</span></div>`;
    } else if (links) {
      visual = `<div class="field-diagram-stage fallback"><iframe class="field-diagram-media" title="Map for ${escapeHtml(details.locationName)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escapeHtml(links.embed)}"></iframe>${fieldCard}</div>`;
    } else {
      visual = `<div class="field-diagram-stage missing"><div><strong>Venue map not configured</strong><span>Ask a club administrator to attach a PNG or PDF and place the field marker.</span></div>${fieldCard}</div>`;
    }
    const actions = `<footer class="game-map-actions"><span>${escapeHtml(details.locationName)} · Field ${escapeHtml(details.fieldCode)}</span><div class="button-row">${links ? `<a class="button small primary" href="${escapeHtml(links.directions)}" target="_blank" rel="noopener noreferrer">Directions</a>` : ""}${asset ? `<a class="button small" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">Open original map</a>` : ""}<button class="button small" data-route="schedule">Edit game</button></div></footer>`;
    return `<div class="coach-game-map">${visual}${actions}</div>`;
  }

  #fieldCard(field, used) {
    const links = locationLinks(field); const asset = fieldMapAsset(field);
    return `<article class="field-guide-card ${used ? "team-field" : ""}"><div class="field-guide-card-head"><div><span>${used ? "On your team schedule" : escapeHtml(field.park || "Club field")}</span><h3>${escapeHtml(field.name)}</h3></div>${exactBadge(field)}</div><div class="button-row"><span class="badge ${asset?.position ? "blue" : "gold"}">${asset?.position ? "Diagram ready" : "Diagram pending"}</span>${field.code ? `<span class="badge">Field ${escapeHtml(field.code)}</span>` : ""}</div><p>${escapeHtml(field.address || "Street address pending")}</p><div class="arrival-callout"><strong>${escapeHtml(field.arrivalLabel || "Arrival point not yet verified")}</strong><span>${escapeHtml(field.arrivalInstructions || "Use the address for now; an administrator still needs to add the exact field pin and final walk.")}</span></div>${field.parking ? `<p class="parking-note"><strong>Parking:</strong> ${escapeHtml(field.parking)}</p>` : ""}<div class="button-row">${links ? `<a class="button small primary" href="${escapeHtml(links.directions)}" target="_blank" rel="noopener noreferrer">Directions</a><a class="button small" href="${escapeHtml(links.map)}" target="_blank" rel="noopener noreferrer">Open map</a>` : ""}${asset ? `<a class="button small" href="${escapeHtml(asset.url)}" target="_blank" rel="noopener noreferrer">Venue map</a>` : ""}<button class="button small" data-field-share="${escapeHtml(field.id)}">Share</button></div></article>`;
  }
}
