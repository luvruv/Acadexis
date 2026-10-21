"use client";

import Link from "next/link";
import { useActionState } from "react";
import { assignSectionsAction } from "./actions";
import FormStatus from "@/components/form-status";
import NativeSelect from "@/components/native-select";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { SECTION_SOURCE_LABELS, SECTION_STATUS_LABELS } from "@/lib/labels";

export default function AssignmentsTable({
  courseFileId,
  sections,
  candidates,
  readOnly,
}) {
  const [state, formAction, isPending] = useActionState(assignSectionsAction, {
    ok: null,
    message: "",
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseFileId" value={courseFileId} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Section</th>
              <th className="p-3">Filled by</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id} className="border-t align-top">
                <td className="p-3">{section.number}</td>
                <td className="p-3">
                  {section.title}
                  {!section.isRequired && (
                    <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
                  )}
                                    {section.status === "SUBMITTED" && (
                    <div>
                      <Link
                        href={`/sections/${section.id}`}
                        className="text-xs font-medium underline"
                      >
                        Review
                      </Link>
                    </div>
                  )}
                  {section.openHref && (
                    <div>
                      <Link href={section.openHref} className="text-xs underline">
                        Open
                      </Link>
                    </div>
                  )}
                </td>
                <td className="p-3">{SECTION_SOURCE_LABELS[section.source]}</td>
                <td className="p-3">
                  <StatusBadge status={section.status} labels={SECTION_STATUS_LABELS} />
                </td>
                <td className="p-3">
                  {section.assignable ? (
                    <NativeSelect
                      name={`assignee:${section.id}`}
                      defaultValue={section.assigneeId ?? ""}
                      disabled={readOnly || section.status === "APPROVED"}
                      aria-label={`Assignee for section ${section.number}`}
                      className="min-w-44"
                    >
                      <option value="">Unassigned</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="text-muted-foreground">{section.fixedLabel}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormStatus state={state} />
      <Button type="submit" disabled={readOnly || isPending}>
        {isPending ? "Saving..." : "Save assignments"}
      </Button>
    </form>
  );
}