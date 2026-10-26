import { describe, expect, it, vi } from "vitest";

// The status function lives next to database code, so the database is replaced.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { deriveCourseFileStatus } from "@/lib/course-file-status";
import { getLockBlockers } from "@/lib/lock";
import { summarizeSections } from "@/lib/progress";
import { countsTowardCompletion, isAssignable, isReviewable } from "@/lib/sections";

let counter = 0;
function section(overrides = {}) {
  counter += 1;
  return {
    id: `s${counter}`,
    number: counter,
    title: `Section ${counter}`,
    formKey: "session-plan",
    source: "CONTRIBUTOR",
    isRequired: true,
    status: "PENDING",
    assigneeId: null,
    ...overrides,
  };
}

describe("section rules", () => {
  it("only contributor and setup sections are assignable, except coordinator-only ones", () => {
    expect(isAssignable(section())).toBe(true);
    expect(isAssignable(section({ source: "COURSE_SETUP", formKey: "course-description" }))).toBe(true);
    expect(isAssignable(section({ source: "PROGRAM_DATA" }))).toBe(false);
    expect(isAssignable(section({ source: "COMPUTED" }))).toBe(false);
    for (const formKey of ["course-details", "course-outcomes", "student-list"]) {
      expect(isAssignable(section({ source: "COURSE_SETUP", formKey }))).toBe(false);
    }
  });

  it("does not review system sections", () => {
    expect(isReviewable(section())).toBe(true);
    expect(isReviewable(section({ source: "PROGRAM_DATA" }))).toBe(false);
    expect(isReviewable(section({ source: "COMPUTED" }))).toBe(false);
    expect(isReviewable(section({ source: "COURSE_SETUP", formKey: "course-details" }))).toBe(false);
  });

  it("calculated and optional sections do not count towards completion", () => {
    expect(countsTowardCompletion(section())).toBe(true);
    expect(countsTowardCompletion(section({ source: "COMPUTED" }))).toBe(false);
    expect(countsTowardCompletion(section({ isRequired: false }))).toBe(false);
  });
});

describe("getLockBlockers", () => {
  it("is empty when every required section is approved", () => {
    const sections = [
      section({ status: "APPROVED" }),
      section({ source: "PROGRAM_DATA", status: "APPROVED" }),
      section({ source: "COMPUTED", status: "PENDING" }), // calculated: never blocks
      section({ isRequired: false, status: "PENDING" }), // optional and untouched
    ];
    expect(getLockBlockers(sections)).toEqual([]);
  });

  it("lists unfinished required sections with a reason", () => {
    const blockers = getLockBlockers([
      section({ status: "PENDING" }),
      section({ status: "SUBMITTED" }),
      section({ status: "CHANGES_REQUESTED" }),
    ]);
    expect(blockers.map((b) => b.reason)).toEqual([
      "Not submitted yet",
      "Waiting for your review",
      "Changes requested",
    ]);
  });

  it("blocks on an optional section that was submitted but not approved", () => {
    expect(getLockBlockers([section({ isRequired: false, status: "SUBMITTED" })])).toHaveLength(1);
    expect(getLockBlockers([section({ isRequired: false, status: "CHANGES_REQUESTED" })])).toHaveLength(1);
    expect(getLockBlockers([section({ isRequired: false, status: "APPROVED" })])).toHaveLength(0);
  });
});

describe("deriveCourseFileStatus", () => {
  const pending = (extra) => section({ status: "PENDING", ...extra });
  const submitted = () => section({ status: "SUBMITTED" });
  const approved = () => section({ status: "APPROVED" });

  it("never changes a locked or exported file", () => {
    expect(deriveCourseFileStatus("LOCKED", [pending()])).toBe("LOCKED");
    expect(deriveCourseFileStatus("EXPORTED", [section({ status: "CHANGES_REQUESTED" })])).toBe("EXPORTED");
  });

  it("stays created until something is assigned or submitted", () => {
    expect(deriveCourseFileStatus("CREATED", [pending()])).toBe("CREATED");
    expect(deriveCourseFileStatus("CREATED", [pending({ assigneeId: "u1" })])).toBe("IN_PROGRESS");
  });

  it("is in progress while required sections are pending", () => {
    expect(deriveCourseFileStatus("IN_PROGRESS", [submitted(), pending()])).toBe("IN_PROGRESS");
  });

  it("is under review once every required section is submitted or approved", () => {
    expect(deriveCourseFileStatus("IN_PROGRESS", [submitted(), approved()])).toBe("UNDER_REVIEW");
    expect(deriveCourseFileStatus("IN_PROGRESS", [approved(), approved()])).toBe("UNDER_REVIEW");
  });

  it("any section waiting for changes wins", () => {
    expect(
      deriveCourseFileStatus("UNDER_REVIEW", [section({ status: "CHANGES_REQUESTED" }), submitted(), approved()])
    ).toBe("CHANGES_REQUESTED");
  });

  it("returns to in progress after a resubmission leaves other work pending", () => {
    expect(deriveCourseFileStatus("CHANGES_REQUESTED", [submitted(), pending()])).toBe("IN_PROGRESS");
  });

  it("ignores calculated sections when deciding to go under review", () => {
    const sections = [submitted(), section({ source: "COMPUTED", status: "PENDING" })];
    expect(deriveCourseFileStatus("IN_PROGRESS", sections)).toBe("UNDER_REVIEW");
  });
});

describe("summarizeSections", () => {
  it("counts required sections only and computes the percentage", () => {
    const summary = summarizeSections([
      section({ status: "APPROVED" }),
      section({ status: "SUBMITTED" }),
      section({ status: "PENDING", assigneeId: "u1" }),
      section({ status: "PENDING" }), // unassigned
      section({ source: "COMPUTED", status: "PENDING" }),
      section({ isRequired: false, status: "PENDING" }),
    ]);
    expect(summary.total).toBe(6);
    expect(summary.requiredTotal).toBe(4);
    expect(summary.approvedRequired).toBe(1);
    expect(summary.percent).toBe(25);
    expect(summary.unassigned).toBe(1);
    expect(summary.countByStatus).toMatchObject({ APPROVED: 1, SUBMITTED: 1, PENDING: 4 });
  });

  it("gives 0 percent for an empty list", () => {
    expect(summarizeSections([]).percent).toBe(0);
  });
});