import { isAssignable } from "@/lib/sections";

// Each section needs: status, isRequired, assigneeId, source, formKey.
export function summarizeSections(sections) {
  const required = sections.filter((section) => section.isRequired);
  const approvedRequired = required.filter(
    (section) => section.status === "APPROVED"
  ).length;

  const countByStatus = { PENDING: 0, SUBMITTED: 0, CHANGES_REQUESTED: 0, APPROVED: 0 };
  for (const section of sections) countByStatus[section.status] += 1;

  const unassigned = sections.filter(
    (section) =>
      isAssignable(section) &&
      section.isRequired &&
      !section.assigneeId &&
      section.status === "PENDING"
  ).length;

  return {
    total: sections.length,
    requiredTotal: required.length,
    approvedRequired,
    countByStatus,
    unassigned,
    percent:
      required.length === 0
        ? 0
        : Math.round((approvedRequired / required.length) * 100),
  };
}