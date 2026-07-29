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
    this.form.querySelector("[data-field=single-date]").classList.toggle("hidden", weekly);
    this.form.querySelector("[data-field=recurrence]").classList.toggle("hidden", !weekly);
    const feedback = this.form.querySelector("#eventSchedulePreview");
    try {
      const dates = this.vm.previewEventSchedule(draft); this.previewError = "";
      if (weekly) {
        const days = draft.seriesWeekdays.map(day => weekdayLabels[day].slice(0, 3)).join(" and ");
        const scopeNote = draft.editScope === "series" ? " Saving will reconcile the date pattern and apply the shared details to every occurrence." : "";
        feedback.className = "summary-box";
        feedback.innerHTML = `<strong>${dates.length} ${escapeHtml(draft.type.toLowerCase())} events</strong><br>${escapeHtml(days)} from ${formatDate(dates[0])} through ${formatDate(dates.at(-1))}. All occurrences use ${escapeHtml(draft.time ? formatTime(draft.time) : "the same time")}, ${escapeHtml(draft.location || "the same location")}, and ${draft.slotCapacity ? `${draft.slotCapacity} RSVP slots` : "unlimited RSVPs"}.${escapeHtml(scopeNote)}`;
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
    ["time", "opponent", "location", "notes"].forEach(name => setValue(this.form, name, item?.[name]));
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
      time: value("time"), opponent: value("opponent").trim(), location: value("location").trim(), notes: value("notes").trim(),
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
