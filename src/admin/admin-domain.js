export function timeToMinutes(value = "00:00") {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export const PRACTICE_START_TIMES = ["16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];
export const PRACTICE_DURATIONS = [45, 60, 75, 90];
export const PRACTICE_STATUSES = ["Scheduled", "Weather watch", "Canceled"];

export function dateToIso(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(value, amount) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount); return dateToIso(date);
}

export function startOfWeek(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateToIso(date);
}

export function weekDates(value = new Date()) {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function filterPractices(practices, filters, teams = []) {
  const teamById = new Map(teams.map(team => [team.id, team]));
  return practices.filter(practice => {
    if (filters.fieldId && filters.fieldId !== "all" && practice.fieldId !== filters.fieldId) return false;
    if (filters.startTime && filters.startTime !== "all" && practice.time !== filters.startTime) return false;
    if (filters.division && filters.division !== "all" && teamById.get(practice.teamId)?.division !== filters.division) return false;
    return true;
  });
}

export function seasonWeeks(start, end, blackoutDates = []) {
  if (!start || !end || start > end) return [];
  const first = startOfWeek(start); const blackoutSet = new Set(blackoutDates);
  const weeks = [];
  for (let cursor = first, index = 0; cursor <= end && index < 30; cursor = addDays(cursor, 7), index += 1) {
    const dates = weekDates(cursor).filter(date => date >= start && date <= end);
    weeks.push({ index: index + 1, start: cursor, end: addDays(cursor, 6), activeDays: dates.length, blackoutDates: dates.filter(date => blackoutSet.has(date)) });
  }
  return weeks;
}

export function scenarioMetrics(scenario, teams = [], fields = []) {
  const practices = scenario?.practices || []; const activeTeams = teams.filter(team => team.status !== "Inactive");
  const counts = new Map(activeTeams.map(team => [team.id, 0]));
  practices.filter(item => item.status !== "Canceled").forEach(item => counts.set(item.teamId, (counts.get(item.teamId) || 0) + 1));
  const unassignedTeamIds = activeTeams.filter(team => (counts.get(team.id) || 0) < 2).map(team => team.id);
  const conflicts = findPracticeConflicts(practices); const activeFields = fields.filter(field => field.status !== "Closed" && !(scenario?.closedFieldIds || []).includes(field.id));
  const occupied = new Set(practices.filter(item => item.status !== "Canceled").map(item => `${item.fieldId}|${item.date}|${item.time}`)).size;
  const capacity = Math.max(1, activeFields.length * 5 * PRACTICE_START_TIMES.length);
  const latePractices = practices.filter(item => item.status !== "Canceled" && timeToMinutes(item.time) >= 18 * 60).length;
  const readiness = Math.max(0, Math.round(100 - unassignedTeamIds.length * 1.7 - conflicts.length * 5 - Math.max(0, latePractices - practices.length * .32) * .15));
  return { assignedTeams: activeTeams.length - unassignedTeamIds.length, totalTeams: activeTeams.length, unassignedTeamIds, conflicts, conflictCount: conflicts.length, utilization: Math.round(occupied / capacity * 100), latePractices, practiceCount: practices.length, activeFieldCount: activeFields.length, readiness };
}

export function recommendPracticeAssignments({ scenario, teams = [], fields = [], weekStart, teamIds = [] }) {
  const practices = [...(scenario?.practices || [])]; const availableFields = fields.filter(field => field.status === "Open" && !(scenario?.closedFieldIds || []).includes(field.id));
  const targets = new Set(teamIds); const created = []; const unresolved = [];
  teams.filter(team => targets.has(team.id)).forEach(team => {
    const current = practices.filter(item => item.teamId === team.id && item.status !== "Canceled");
    let needed = Math.max(0, 2 - current.length); const divisionNumber = Number(String(team.division).replace(/\D/g, "")) || 10;
    while (needed > 0) {
      const candidates = [];
      for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
        const date = addDays(weekStart, dayIndex);
        if (practices.some(item => item.teamId === team.id && item.date === date && item.status !== "Canceled")) continue;
        for (const time of PRACTICE_START_TIMES) {
          const minutes = timeToMinutes(time);
          if (divisionNumber <= 8 && minutes > 18 * 60) continue;
          if (divisionNumber >= 12 && minutes < 17 * 60) continue;
          for (const field of availableFields) {
            if (minutes >= 18 * 60 && !field.lights) continue;
            const candidate = {
              id: `plan-${scenario.id}-${team.id}-${date}-${time.replace(":", "")}`, teamId: team.id, type: "Practice", opponent: "Team practice",
              date, time, durationMinutes: divisionNumber >= 11 ? 90 : divisionNumber >= 9 ? 75 : 60,
              fieldId: field.id, location: field.name, status: "Scheduled", notes: "Smart-allocated preseason recommendation.", adminManaged: true,
            };
            if (practices.some(item => practicesOverlap(candidate, item))) continue;
            const slotLoad = practices.filter(item => item.date === date && item.time === time && item.status !== "Canceled").length;
            const fieldLoad = practices.filter(item => item.fieldId === field.id && item.status !== "Canceled").length;
            const defaultBonus = field.id === team.defaultFieldId ? -4 : 0;
            const youngLatePenalty = divisionNumber <= 8 ? Math.max(0, minutes - 17 * 60) / 30 : 0;
            const dayBalance = dayIndex === 2 ? 1 : 0;
            candidates.push({ value: candidate, score: slotLoad * 3 + fieldLoad * .15 + youngLatePenalty + dayBalance + defaultBonus });
          }
        }
      }
      candidates.sort((a, b) => a.score - b.score || a.value.date.localeCompare(b.value.date) || a.value.time.localeCompare(b.value.time));
      const selected = candidates[0]?.value;
      if (!selected) { unresolved.push(team.id); break; }
      practices.push(selected); created.push(selected); needed -= 1;
    }
  });
  return { practices, created, unresolved: [...new Set(unresolved)] };
}

export function practicesOverlap(left, right) {
  if (!left || !right || left.id === right.id) return false;
  if (left.status === "Canceled" || right.status === "Canceled") return false;
  if (!left.fieldId || left.fieldId !== right.fieldId || left.date !== right.date) return false;
  const leftStart = timeToMinutes(left.time);
  const rightStart = timeToMinutes(right.time);
  const leftEnd = leftStart + Math.max(1, Number(left.durationMinutes) || 60);
  const rightEnd = rightStart + Math.max(1, Number(right.durationMinutes) || 60);
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function findPracticeConflicts(practices = []) {
  const conflicts = [];
  for (let leftIndex = 0; leftIndex < practices.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < practices.length; rightIndex += 1) {
      const left = practices[leftIndex]; const right = practices[rightIndex];
      if (practicesOverlap(left, right)) conflicts.push([left, right]);
    }
  }
  return conflicts;
}

export function resolveBroadcastTeamIds({ scope, division, selectedTeamIds = [] }, teams = []) {
  if (scope === "all") return teams.filter(team => team.status !== "Inactive").map(team => team.id);
  if (scope === "division") return teams.filter(team => team.status !== "Inactive" && team.division === division).map(team => team.id);
  if (scope === "teams") {
    const allowed = new Set(teams.filter(team => team.status !== "Inactive").map(team => team.id));
    return [...new Set(selectedTeamIds)].filter(id => allowed.has(id));
  }
  return [];
}

export function clearanceTone(status) {
  if (status === "Cleared") return "cleared";
  if (status === "Expiring soon") return "expiring";
  return "attention";
}
