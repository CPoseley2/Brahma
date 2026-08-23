function eventTimeValue(event = {}) {
  if (!event.date) return Number.POSITIVE_INFINITY;
  const time = event.time || "23:59:59.999";
  const value = new Date(`${event.date}T${time}`).valueOf();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function compareEvents(a, b) {
  return eventTimeValue(a) - eventTimeValue(b)
    || String(a.id || "").localeCompare(String(b.id || ""));
}

export function partitionScheduleEvents(events = [], now = new Date()) {
  const nowValue = now instanceof Date ? now.valueOf() : new Date(now).valueOf();
  const chronological = [...events].sort(compareEvents);
  const past = [];
  const future = [];

  chronological.forEach(event => {
    const startsAt = eventTimeValue(event);
    if (Number.isFinite(startsAt) && startsAt < nowValue) past.push(event);
    else future.push(event);
  });

  return {
    next: future[0] || null,
    upcoming: future.slice(1),
    past,
  };
}
