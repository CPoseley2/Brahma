export const clone = value => JSON.parse(JSON.stringify(value));
export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character]));
export const todayIso = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function formatDate(date) {
  if (!date) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}
export function formatTime(time) {
  if (!time) return "Time TBD";
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2000, 0, 1, hours, minutes));
}
export function formatDateTime(value) {
  if (!value) return "Just now";
  const raw = typeof value?.toDate === "function" ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(raw.valueOf())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(raw);
}
export function ageLabel(dateOfBirth) {
  if (!dateOfBirth) return "—";
  const birth = new Date(`${dateOfBirth}T12:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}
export const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
