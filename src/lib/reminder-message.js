import { dueState, formatDueDate } from "./dates.js";

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function buildReminderMessage({ number, title, courseCode, dueDate }, now = new Date()) {
  const base = `Section ${number} "${shorten(title, 70)}" of ${courseCode}`;
  const state = dueState(dueDate, now);
  if (state === "overdue") return `Overdue: ${base} was due on ${formatDueDate(dueDate)}.`;
  if (state === "soon") return `Reminder: ${base} is due on ${formatDueDate(dueDate)}.`;
  return `Reminder: ${base} is waiting for your input.`;
}