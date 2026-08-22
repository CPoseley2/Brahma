import { escapeHtml, formatDate, formatTime, todayIso } from "../shared/format.js";
import { weekdayLabels } from "../shared/recurrence.js";

const setValue = (form, name, value = "") => { form.elements.namedItem(name).value = value; };

export class EventDialogView {
  constructor(root, vm) { this.root = root; this.vm = vm; this.busy = false; this.previewError = ""; this.saveError = ""; }
  mount() {
    this.dialog = this.root.querySelector("#gameDialog"); this.form = this.dialog.querySelector("form");
    this.form.addEventListener("input", () => { this.saveError = ""; this.render(); });
    this.form.addEventListener("change", () => { this.saveError = ""; this.render(); });
    this.form.querySelector("[data-event-save]").addEventListener("click", () => this.#save());
  }
  render() {
    if (!this.form) return;
    const draft = this.#draft(); const weekly = draft.scheduleMode === "weekly";
    const competitive = ["game", "scrimmage", "jamboree"].includes(draft.type.toLowerCase());
    this.form.querySelector("[data-field=single-date]").classList.toggle("hidden", weekly);
    this.form.querySelector("[data-field=recurrence]").classList.toggle("hidden", !weekly);
    this.form.querySelector("[data-field=custom-location]").classList.toggle("hidden", Boolean(draft.fieldId));
    this.form.querySelector("[data-field=game-details]").classList.toggle("hidden", !competitive);
    this.form.querySelector("[data-field=event-title]").classList.toggle("hidden", competitive);
    ["homeTeamName", "awayTeamName", "ageGroup"].forEach(name => { this.form.elements.namedItem(name).required = competitive; });
    const feedback = this.form.querySelector("#eventSchedulePreview");
    try {
      const dates = this.vm.previewEventSchedule(draft); this.previewError = "";
      if (weekly) {
        const days = draft.seriesWeekdays.map(day => weekdayLabels[day].slice(0, 3)).join(" and ");
        const scopeNote = draft.editScope === "series" ? " Saving will reconcile the date pattern and apply the shared details to every occurrence." : "";
        feedback.className = "summary-box";
        const field = this.vm.field(draft.fieldId);
        feedback.innerHTML = `<strong>${dates.length} ${escapeHtml(draft.type.toLowerCase())} events</strong><br>${escapeHtml(days)} from ${formatDate(dates[0])} through ${formatDate(dates.at(-1))}. All occurrences use ${escapeHtml(draft.time ? formatTime(draft.time) : "the same time")}, ${escapeHtml(field?.name || draft.location || "the same location")}, and ${draft.slotCapacity ? `${draft.slotCapacity} RSVP slots` : "unlimited RSVPs"}.${escapeHtml(scopeNote)}`;
      } else {
        feedback.className = "summary-box";
        feedback.innerHTML = `<strong>One ${escapeHtml(draft.type.toLowerCase())} event</strong><br>${formatDate(dates[0])}${draft.time ? ` at ${escapeHtml(draft.time)}` : ""} · ${draft.slotCapacity ? `${draft.slotCapacity} RSVP slots` : "Unlimited RSVPs"}.`;
      }
    } catch (error) {
      this.previewError = error.message; feedback.className = "login-message error"; feedback.textContent = error.message;
    }
    if (this.saveError) { feedback.className = "login-message error"; feedback.textContent = this.saveError; }
    const save = this.form.querySelector("[data-event-save]");
    save.disabled = this.busy || Boolean(this.previewError);
    save.textContent = this.busy ? "Saving…" : draft.editScope === "series" ? "Save entire series" : draft.scheduleMode === "weekly" ? "Create recurring events" : "Save event";
  }
  open(id = "", scope = "occurrence") {
    const item = this.vm.state.games.find(value => value.id === id); const seriesEdit = Boolean(item?.seriesId && scope === "series");
    this.busy = false; this.saveError = ""; this.form.reset();
    setValue(this.form, "id", item?.id); setValue(this.form, "seriesId", item?.seriesId); setValue(this.form, "editScope", seriesEdit ? "series" : "occurrence");
    setValue(this.form, "type", item?.type || "Practice"); setValue(this.form, "status", item?.status || "Scheduled");
    setValue(this.form, "slotCapacity", item?.slotCapacity || 0);
    setValue(this.form, "scheduleMode", seriesEdit ? "weekly" : "once");
    setValue(this.form, "date", item?.date || todayIso());
    setValue(this.form, "seriesStartDate", item?.seriesStartDate || item?.occurrenceDate || item?.date || todayIso());
    setValue(this.form, "seriesEndDate", item?.seriesEndDate || item?.occurrenceDate || item?.date || todayIso());
    this.form.elements.fieldId.innerHTML = `<option value="">Other location</option>${(this.vm.state.fields || []).filter(field => field.status !== "Closed").sort((a, b) => a.name.localeCompare(b.name)).map(field => `<option value="${escapeHtml(field.id)}">${escapeHtml(field.name)}${field.code ? ` · Field ${escapeHtml(field.code)}` : ""} · ${escapeHtml(field.arrivalLabel || field.address || "Map details pending")}</option>`).join("")}`;
    setValue(this.form, "fieldId", item?.fieldId || "");
    ["time", "opponent", "location", "notes"].forEach(name => setValue(this.form, name, item?.[name]));
    const details = item?.gameDetails || {};
    const team = this.vm.state.team || {};
    setValue(this.form, "homeTeamName", details.homeTeamName || item?.homeTeamName || team.name || "");
    setValue(this.form, "awayTeamName", details.awayTeamName || item?.awayTeamName || item?.opponent || "");
    setValue(this.form, "ageGroup", details.ageGroup || item?.ageGroup || team.ageGroup || team.division || String(team.name || "").match(/\bU\d+\b/i)?.[0]?.toUpperCase() || "");
    setValue(this.form, "homeCoachName", details.homeCoachName || item?.homeCoachName || this.vm.identity?.user?.displayName || "");
    setValue(this.form, "awayCoachName", details.awayCoachName || item?.awayCoachName || "");
    const selectedDays = item?.seriesWeekdays || [2, 4];
    this.form.querySelectorAll("[name=seriesWeekday]").forEach(input => { input.checked = selectedDays.includes(Number(input.value)); });
    this.form.querySelector("[data-field=schedule-mode]").classList.toggle("hidden", Boolean(item));
    this.form.querySelector("[data-title]").textContent = seriesEdit ? "Edit recurring series" : item ? "Edit one occurrence" : "Add event";
    this.render(); this.dialog.showModal();
  }
  #draft() {
    const value = name => this.form.elements.namedItem(name).value;
    return {
      id: value("id"), seriesId: value("seriesId"), editScope: value("editScope"),
      type: value("type"), status: value("status"), scheduleMode: value("scheduleMode"), date: value("date"),
      seriesStartDate: value("seriesStartDate"), seriesEndDate: value("seriesEndDate"),
      seriesWeekdays: [...this.form.querySelectorAll("[name=seriesWeekday]:checked")].map(input => Number(input.value)),
      time: value("time"), opponent: value("opponent").trim(), fieldId: value("fieldId"), location: value("location").trim(), notes: value("notes").trim(),
      gameDetails: {
        homeTeamName: value("homeTeamName").trim(), awayTeamName: value("awayTeamName").trim(), ageGroup: value("ageGroup").trim(),
        homeCoachName: value("homeCoachName").trim(), awayCoachName: value("awayCoachName").trim(),
      },
      slotCapacity: Number(value("slotCapacity") || 0),
    };
  }
  async #save() {
    if (!this.form.reportValidity() || this.previewError || this.busy) return;
    this.busy = true; this.render(); const draft = this.#draft();
    try {
      const result = await this.vm.saveEventSchedule(draft, draft.id, draft.editScope);
      this.dialog.close();
      this.root.dispatchEvent(new CustomEvent("schedule-feedback", { detail: { message: result.message } }));
    } catch (error) {
      this.saveError = error.message;
    }
    this.busy = false; this.render();
  }
}
