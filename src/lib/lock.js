import { countsTowardCompletion } from "@/lib/sections";

const REASONS = {
  PENDING: "Not submitted yet",
  SUBMITTED: "Waiting for your review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

// Returns everything that currently prevents locking. Empty means ready.
// Required sections must be approved. Optional sections may stay empty, but
// not be left submitted or sent back. Later steps add the CO attainment check.
export function getLockBlockers(sections) {
  const blockers = [];
  for (const section of sections) {
    const mustBeApproved = countsTowardCompletion(section);
    const unfinished =
      section.status === "SUBMITTED" || section.status === "CHANGES_REQUESTED";

    if (
      (mustBeApproved && section.status !== "APPROVED") ||
      (!mustBeApproved && unfinished)
    ) {
      blockers.push({
        id: section.id,
        number: section.number,
        title: section.title,
        reason: REASONS[section.status] ?? section.status,
      });
    }
  }
  return blockers;
}