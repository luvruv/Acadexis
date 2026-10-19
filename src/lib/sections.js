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