"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { assignSectionsAction, remindSectionAction } from "./actions";
import FormStatus from "@/components/form-status";
import NativeSelect from "@/components/native-select";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SECTION_SOURCE_LABELS, SECTION_STATUS_LABELS } from "@/lib/labels";

const OPEN_STATUSES = ["PENDING", "CHANGES_REQUESTED"];

function RemindButton({ sectionId }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(null);

  function handleClick() {
    startTransition(async () => {
      setResult(await remindSectionAction(sectionId));
    });
  }

  return (
    <div className="mt-1">
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Sending..." : "Remind"}
      </Button>
      {result && (
        <span
          role={result.ok ? "status" : "alert"}
          className={`ml-1 text-xs ${result.ok ? "text-green-700" : "text-red-600"}`}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}

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
              <th className="p-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const open = OPEN_STATUSES.includes(section.status);
              return (
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
                      <>
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
                        {!readOnly && section.assigneeId && open && (
                          <RemindButton sectionId={section.id} />
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{section.fixedLabel}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {section.assignable ? (
                      <>
                        <Input
                          type="date"
                          name={`due:${section.id}`}
                          defaultValue={section.dueDate}
                          disabled={readOnly || section.status === "APPROVED"}
                          aria-label={`Due date for section ${section.number}`}
                          className="w-40"
                        />
                        {open && section.dueState === "overdue" && (
                          <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                            Overdue
                          </span>
                        )}
                        {open && section.dueState === "soon" && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            Due soon
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
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