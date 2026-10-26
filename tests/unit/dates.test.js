import { describe, expect, it } from "vitest";
import { dueState, formatDueDate, parseDateInput, todayString } from "@/lib/dates";
import { buildReminderMessage } from "@/lib/reminder-message";

// 24 October 2026, 03:00 in the machine's own time zone.
const now = new Date(2026, 9, 24, 3, 0);
const day = (text) => new Date(`${text}T00:00:00.000Z`);

describe("dueState", () => {
  it("is overdue before today", () => {
    expect(dueState(day("2026-10-23"), now)).toBe("overdue");
  });
  it("is due soon from today until two days ahead", () => {
    expect(dueState(day("2026-10-24"), now)).toBe("soon");
    expect(dueState(day("2026-10-26"), now)).toBe("soon");
  });
  it("is ok after that", () => {
    expect(dueState(day("2026-10-27"), now)).toBe("ok");
  });
  it("is null without a date", () => {
    expect(dueState(null, now)).toBeNull();
  });
  it("accepts a yyyy-mm-dd string too", () => {
    expect(dueState("2026-10-20", now)).toBe("overdue");
  });
});

describe("todayString", () => {
  it("formats the local date", () => {
    expect(todayString(now)).toBe("2026-10-24");
  });
});

describe("parseDateInput", () => {
  it("accepts a valid date", () => {
    expect(parseDateInput("2026-11-05")?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });
  it("trims spaces", () => {
    expect(parseDateInput(" 2026-11-05 ")?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });
  it.each(["2026-02-30", "2026-13-01", "26-10-24", "abc", "", null, undefined])(
    "rejects %j",
    (value) => {
      expect(parseDateInput(value)).toBeNull();
    }
  );
});

describe("formatDueDate", () => {
  it("prints the same calendar day whatever the time zone", () => {
    expect(formatDueDate(day("2026-11-05"))).toBe("5 Nov 2026");
  });
});

describe("buildReminderMessage", () => {
  const section = { number: 13, title: "Mid Semester Question papers", courseCode: "CSE3005" };

  it("says overdue with the date", () => {
    expect(buildReminderMessage({ ...section, dueDate: day("2026-10-20") }, now)).toBe(
      'Overdue: Section 13 "Mid Semester Question papers" of CSE3005 was due on 20 Oct 2026.'
    );
  });
  it("says due soon", () => {
    expect(buildReminderMessage({ ...section, dueDate: day("2026-10-25") }, now)).toContain(
      "is due on 25 Oct 2026"
    );
  });
  it("works without a date", () => {
    expect(buildReminderMessage({ ...section, dueDate: null }, now)).toContain(
      "is waiting for your input"
    );
  });
  it("shortens very long titles", () => {
    const message = buildReminderMessage({ ...section, title: "x".repeat(200), dueDate: null }, now);
    expect(message.length).toBeLessThan(160);
    expect(message).toContain("...");
  });
});