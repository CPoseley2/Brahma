import { findPracticeConflicts, PRACTICE_DURATIONS, PRACTICE_START_TIMES, PRACTICE_STATUSES } from "../admin/admin-domain.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

export const scheduleHeaders = [
  "Practice ID", "Team ID", "Team Name", "Division", "Location ID", "Location Name",
  "Practice Date", "Practice Start Time", "Duration Minutes", "Status", "Notes",
];

const normalizedHeader = value => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const headerLookup = new Map(scheduleHeaders.map(header => [normalizedHeader(header), header]));

function validIsoDate(value) {
  const text = String(value ?? "").trim(); const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${text}T12:00:00`);
  return !Number.isNaN(date.valueOf()) && date.getFullYear() === Number(match[1]) && date.getMonth() + 1 === Number(match[2]) && date.getDate() === Number(match[3]);
}

export function normalizeScheduleRows(matrix, { teams = [], fields = [], practices = [] } = {}) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error("The file does not contain a header row and practice data.");
  const indexes = new Map();
  matrix[0].forEach((value, index) => { const header = headerLookup.get(normalizedHeader(value)); if (header && !indexes.has(header)) indexes.set(header, index); });
  const missing = scheduleHeaders.filter(header => !indexes.has(header));
  if (missing.length) throw new Error(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  const sourceRows = matrix.slice(1).filter(row => row.some(value => String(value ?? "").trim()));
  if (!sourceRows.length) throw new Error("The file has no practice rows.");
  if (sourceRows.length > MAX_ROWS) throw new Error(`Import at most ${MAX_ROWS} practices at a time.`);

  const teamById = new Map(teams.map(item => [item.id, item])); const fieldById = new Map(fields.map(item => [item.id, item]));
  const existingById = new Map(practices.map(item => [item.id, item])); const seenIds = new Set();
  const rows = []; const errors = []; const warnings = [];
  sourceRows.forEach((source, offset) => {
    const rowNumber = offset + 2; const get = header => String(source[indexes.get(header)] ?? "").trim();
    const id = get("Practice ID"); const teamId = get("Team ID"); const fieldId = get("Location ID");
    const team = teamById.get(teamId); const field = fieldById.get(fieldId); const durationMinutes = Number(get("Duration Minutes"));
    const value = {
      id, rowNumber, importAction: existingById.has(id) ? "Update" : "Add", teamId, type: "Practice", opponent: "Team practice",
      date: get("Practice Date"), time: get("Practice Start Time"), durationMinutes, fieldId,
      location: field?.name || get("Location Name"), status: get("Status"), notes: get("Notes"),
    };
    if (!id || id.includes("/") || id.length > 120) errors.push(`Row ${rowNumber}: Practice ID is required, must be 120 characters or fewer, and cannot contain “/”.`);
    if (seenIds.has(id)) errors.push(`Row ${rowNumber}: Practice ID “${id}” appears more than once.`); else seenIds.add(id);
    if (!team) errors.push(`Row ${rowNumber}: Team ID “${teamId || "blank"}” was not found.`);
    else {
      if (get("Team Name") !== team.name) errors.push(`Row ${rowNumber}: Team Name must be exactly “${team.name}” for ${teamId}.`);
      if (get("Division") !== team.division) errors.push(`Row ${rowNumber}: Division must be exactly “${team.division}” for ${teamId}.`);
    }
    if (!field) errors.push(`Row ${rowNumber}: Location ID “${fieldId || "blank"}” was not found.`);
    else if (get("Location Name") !== field.name) errors.push(`Row ${rowNumber}: Location Name must be exactly “${field.name}” for ${fieldId}.`);
    if (!validIsoDate(value.date)) errors.push(`Row ${rowNumber}: Practice Date must use YYYY-MM-DD.`);
    if (!PRACTICE_START_TIMES.includes(value.time)) errors.push(`Row ${rowNumber}: Practice Start Time must be one of ${PRACTICE_START_TIMES.join(", ")}.`);
    if (!PRACTICE_DURATIONS.includes(durationMinutes)) errors.push(`Row ${rowNumber}: Duration Minutes must be one of ${PRACTICE_DURATIONS.join(", ")}.`);
    if (!PRACTICE_STATUSES.includes(value.status)) errors.push(`Row ${rowNumber}: Status must be one of ${PRACTICE_STATUSES.join(", ")}.`);
    const existing = existingById.get(id);
    if (existing && existing.teamId !== teamId) errors.push(`Row ${rowNumber}: An existing Practice ID cannot move to another Team ID.`);
    rows.push(value);
  });
  if (!errors.length) {
    const importedIds = new Set(rows.map(item => item.id));
    const combined = [...practices.filter(item => !importedIds.has(item.id)), ...rows];
    findPracticeConflicts(combined).forEach(([left, right]) => {
      if (!importedIds.has(left.id) && !importedIds.has(right.id)) return;
      const imported = importedIds.has(left.id) ? left : right; const other = imported === left ? right : left;
      errors.push(`Row ${imported.rowNumber}: conflicts with Practice ID “${other.id}” at the same location and time.`);
    });
  }
  if (errors.length) return { rows: [], errors: [...new Set(errors)], warnings };
  const updates = rows.filter(row => row.importAction === "Update").length;
  if (updates) warnings.push(`${updates} existing practice${updates === 1 ? "" : "s"} will be updated by Practice ID.`);
  return { rows, errors: [], warnings };
}

export async function parseScheduleFile(file, references) {
  if (!file) throw new Error("Choose a CSV file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("The schedule file must be 5 MB or smaller.");
  if (file.name.split(".").pop()?.toLowerCase() !== "csv") throw new Error("Use a .csv file.");
  const { default: Papa } = await import("papaparse");
  const result = Papa.parse(await file.text(), { skipEmptyLines: "greedy" });
  if (result.errors.length) throw new Error(`CSV parsing failed on row ${result.errors[0].row + 1}: ${result.errors[0].message}`);
  return normalizeScheduleRows(result.data, references);
}

const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function scheduleTemplateCsv(teams, fields, date) {
  const rows = teams.slice(0, 2).map((team, index) => {
    const field = fields.find(item => item.id === team.defaultFieldId) || fields[index] || fields[0];
    return [`practice-${team.id}-${date}-${index + 1}`, team.id, team.name, team.division, field?.id || "", field?.name || "", date, PRACTICE_START_TIMES[index + 2], 60, "Scheduled", "Optional practice note"];
  });
  return [scheduleHeaders, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}
