const NUMBER_PATTERN = /^\d{1,5}(\.\d{1,2})?$/;

// A cell is "" (not entered), "AB" (absent), or a number up to maxMarks.
export function parseMarkValue(raw, maxMarks) {
  const text = String(raw ?? "").trim();
  if (text === "") return { kind: "clear" };
  if (/^ab(sent)?$/i.test(text)) return { kind: "absent" };
  if (!NUMBER_PATTERN.test(text)) {
    return { error: "must be a number (up to 2 decimals) or AB" };
  }
  const value = Number(text);
  if (value > maxMarks) return { error: `cannot be more than ${maxMarks}` };
  return { kind: "number", value };
}