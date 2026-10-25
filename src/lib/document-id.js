import { randomInt } from "node:crypto";

// No 0, O, 1, I or L, so an ID read out loud or copied by hand is unambiguous.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SUFFIX_LENGTH = 4;

function courseCodePart(courseCode) {
  const cleaned = String(courseCode).toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return cleaned || "COURSE";
}

function academicYearPart(academicYear) {
  const cleaned = String(academicYear).replace(/[^0-9-]+/g, "").replace(/^-+|-+$/g, "");
  return cleaned || "YEAR";
}

// "Semester 5" -> "S5", "5th" -> "S5", "Monsoon" -> "MON".
function semesterPart(semester) {
  const digits = String(semester).match(/\d+/)?.[0];
  if (digits) return `S${digits}`;
  const letters = String(semester).toUpperCase().replace(/[^A-Z]+/g, "").slice(0, 3);
  return letters || "SEM";
}

// Example: ACX-CSE3005-2026-27-S5-R1-K7QD
export function buildDocumentId({ courseCode, academicYear, semester, revision }) {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return [
    "ACX",
    courseCodePart(courseCode),
    academicYearPart(academicYear),
    semesterPart(semester),
    `R${revision}`,
    suffix,
  ].join("-");
}