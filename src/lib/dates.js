const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(number) {
  return String(number).padStart(2, "0");
}

// Today's date on the server, as yyyy-mm-dd.
export function todayString(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Due dates are plain dates (no time), stored as midnight UTC. Comparing them
// as yyyy-mm-dd text avoids time zone surprises.
export function toDateString(dueDate) {
  return dueDate instanceof Date ? dueDate.toISOString().slice(0, 10) : String(dueDate);
}

// "overdue": the date has passed. "soon": today or within the next 2 days.
export function dueState(dueDate, now = new Date()) {
  if (!dueDate) return null;
  const due = toDateString(dueDate);
  const today = todayString(now);
  if (due < today) return "overdue";
  if (due <= addDays(today, 2)) return "soon";
  return "ok";
}

// Accepts yyyy-mm-dd only. Returns a Date at midnight UTC, or null.
export function parseDateInput(value) {
  const text = String(value ?? "").trim();
  if (!DATE_PATTERN.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return date;
}

export function formatDueDate(dueDate) {
  return new Date(`${toDateString(dueDate)}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}