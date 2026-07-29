const MAX_OCCURRENCES = 100;

const validIsoDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

export function recurringDates(startDate, endDate, weekdays) {
  if (!validIsoDate(startDate) || !validIsoDate(endDate)) throw new Error("Choose valid start and end dates.");
  if (startDate > endDate) throw new Error("The end date must be on or after the start date.");
  const selectedDays = [...new Set((weekdays || []).map(Number))].filter(day => day >= 0 && day <= 6);
  if (!selectedDays.length) throw new Error("Choose at least one practice day.");
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    if (selectedDays.includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > MAX_OCCURRENCES) throw new Error(`A recurring series can contain at most ${MAX_OCCURRENCES} events.`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!dates.length) throw new Error("No selected weekdays occur within this date range.");
  return dates;
}

export function scheduleDates(draft) {
  if (draft.scheduleMode !== "weekly") {
    if (!validIsoDate(draft.date)) throw new Error("Choose an event date.");
    return [draft.date];
  }
  return recurringDates(draft.seriesStartDate, draft.seriesEndDate, draft.seriesWeekdays);
}

export const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
