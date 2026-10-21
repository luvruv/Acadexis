// Sections the coordinator can hand to someone else.
const COORDINATOR_ONLY_FORM_KEYS = new Set([
  "course-details",
  "course-outcomes",
  "student-list",
]);

export function isAssignable(section) {
  return (
    (section.source === "CONTRIBUTOR" || section.source === "COURSE_SETUP") &&
    !COORDINATOR_ONLY_FORM_KEYS.has(section.formKey)
  );
}

// Sections that already have their own coordinator page.
export const SECTION_PAGE_SEGMENTS = {
  "course-outcomes": "outcomes",
  "student-list": "students",
};

// Statuses in which the assigned person may still edit a section.
export const EDITABLE_SECTION_STATUSES = ["PENDING", "CHANGES_REQUESTED"];


// Sections the coordinator reviews. Program data, Course Details and
// calculated sections are completed by the system and never reviewed.
export function isReviewable(section) {
  return (
    (section.source === "CONTRIBUTOR" || section.source === "COURSE_SETUP") &&
    section.formKey !== "course-details"
  );
}

// Sections that must be done before the course file can be locked.
// Calculated sections are produced by the system, so they never block.
export function countsTowardCompletion(section) {
  return section.isRequired && section.source !== "COMPUTED";
}