const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 100;

export const rosterHeaders = [
  "Athlete Last Name", "Athlete First Name", "Gender",
  "Birthdate", "Parent Email", "Parent Phone",
];

const normalizedHeader = value => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const headerLookup = new Map(rosterHeaders.map(header => [normalizedHeader(header), header]));

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    const us = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (us) {
      const year = us[3].length === 2 ? Number(us[3]) + (Number(us[3]) > 50 ? 1900 : 2000) : Number(us[3]);
      match = [text, String(year), us[1], us[2]];
    }
  }
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function rosterIdentity(row) {
  return [row.firstName, row.lastName, row.dateOfBirth].map(value => String(value).trim().toLowerCase()).join("|");
}

export function normalizeRosterRows(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error("The file does not contain a header row and athlete data.");
  const indexes = new Map();
  matrix[0].forEach((value, index) => {
    const header = headerLookup.get(normalizedHeader(value));
    if (header && !indexes.has(header)) indexes.set(header, index);
  });
  const missing = rosterHeaders.filter(header => !indexes.has(header));
  if (missing.length) throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  const dataRows = matrix.slice(1).filter(row => row.some(value => String(value ?? "").trim()));
  if (!dataRows.length) throw new Error("The file has no athlete rows.");
  if (dataRows.length > MAX_ROWS) throw new Error(`Import at most ${MAX_ROWS} athletes at a time.`);

  const rows = []; const errors = []; const warnings = []; const identities = new Set();
  dataRows.forEach((source, offset) => {
    const rowNumber = offset + 2;
    const get = header => source[indexes.get(header)];
    const row = {
      rowNumber,
      lastName: String(get("Athlete Last Name") ?? "").trim(),
      firstName: String(get("Athlete First Name") ?? "").trim(),
      gender: String(get("Gender") ?? "").trim(),
      dateOfBirth: isoDate(get("Birthdate")),
      familyEmail: String(get("Parent Email") ?? "").trim().toLowerCase(),
      familyPhone: String(get("Parent Phone") ?? "").trim(),
    };
    if (!row.lastName) errors.push(`Row ${rowNumber}: Athlete Last Name is required.`);
    if (!row.firstName) errors.push(`Row ${rowNumber}: Athlete First Name is required.`);
    if (!row.dateOfBirth) errors.push(`Row ${rowNumber}: Birthdate is invalid.`);
    if (!/^\S+@\S+\.\S+$/.test(row.familyEmail)) errors.push(`Row ${rowNumber}: Parent Email is invalid.`);
    const identity = rosterIdentity(row);
    if (identities.has(identity)) warnings.push(`Row ${rowNumber}: duplicate athlete skipped.`);
    else { identities.add(identity); rows.push(row); }
  });
  if (errors.length) return { rows: [], errors, warnings };
  return { rows, errors: [], warnings };
}

export async function parseRosterFile(file) {
  if (!file) throw new Error("Choose a CSV or Excel file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("The roster file must be 5 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let matrix;
  if (extension === "csv") {
    const { default: Papa } = await import("papaparse");
    const result = Papa.parse(await file.text(), { skipEmptyLines: "greedy" });
    if (result.errors.length) throw new Error(`CSV parsing failed on row ${result.errors[0].row + 1}: ${result.errors[0].message}`);
    matrix = result.data;
  } else if (extension === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    matrix = await readXlsxFile(file);
  } else {
    throw new Error("Use a .csv or .xlsx file.");
  }
  return normalizeRosterRows(matrix);
}
