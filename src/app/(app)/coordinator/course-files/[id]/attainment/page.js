import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeAttainment } from "@/lib/attainment";
import { loadAttainmentInputs } from "@/lib/attainment-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsForm from "./settings-form";

export const metadata = { title: "CO attainment | Acadexis" };

export default async function AttainmentPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  const courseFile = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    select: {
      status: true,
      course: { select: { code: true, title: true } },
    },
  });
  if (!courseFile) notFound();

  const inputs = await loadAttainmentInputs(prisma, id);
  const result = computeAttainment(inputs);
  const { settings } = inputs;
  const readOnly = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href={`/coordinator/course-files/${id}`} className="text-sm underline">
          Back to course file
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          CO attainment: {courseFile.course.code}
        </h1>
        <p className="text-muted-foreground">{courseFile.course.title}</p>
      </div>

      {!settings.confirmed && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Provisional settings.</strong> These values are a working assumption, not
          a confirmed department rule. Update them when the official rule arrives, then tick
          "Confirmed by the department".
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it is calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            A student attains a CO when their marks in the components mapped to that CO,
            divided by the maximum marks of those components, are at least{" "}
            <strong>{settings.thresholdPercent}%</strong>.
          </p>
          <p>
            Level 1 needs at least {settings.level1MinPercent}% of students to attain, Level 2
            at least {settings.level2MinPercent}%, and Level 3 at least{" "}
            {settings.level3MinPercent}%. Below Level 1 is shown as Level 0. Absent students
            are {settings.absentAsZero ? "counted as 0 marks" : "left out"}.
          </p>
        </CardContent>
      </Card>

      <SettingsForm
        key={JSON.stringify(settings)}
        courseFileId={id}
        settings={settings}
        readOnly={readOnly}
      />

      <Card>
        <CardHeader>
          <CardTitle>CO attainment measurement analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.problems.length > 0 && (
            <div className="rounded-md border bg-muted p-3 text-sm">
              <p className="font-medium">Not ready to calculate everything:</p>
              <ul className="list-disc pl-5">
                {result.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link href={`/coordinator/course-files/${id}/outcomes`} className="underline">
                  Course outcomes
                </Link>
                {" · "}
                <Link href={`/coordinator/course-files/${id}/assessments`} className="underline">
                  Assessment components
                </Link>
                {" · "}
                <Link href={`/marks/${id}`} className="underline">
                  Marks
                </Link>
              </p>
            </div>
          )}

          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Course Outcome</th>
                    {result.rows.map((row) => (
                      <th key={row.outcomeId} className="p-2 text-center">
                        {row.code}
                        <div className="text-xs font-normal text-muted-foreground">
                          {row.componentNames.length > 0
                            ? row.componentNames.join(", ")
                            : "no component"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-2">No. of students who attained</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.percentage === null ? "-" : `${row.attained} of ${row.assessed}`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">% of students who attained</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.percentage === null ? "-" : `${row.percentage.toFixed(2)}%`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t font-medium">
                    <td className="p-2">Attainment level</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.level === null ? "-" : row.level}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {result.students.length > 0 && result.rows.length > 0 && (
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Show the calculation for each student
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead className="text-left">
                    <tr>
                      <th className="p-2">Enrollment no.</th>
                      <th className="p-2">Name</th>
                      {result.rows.map((row) => (
                        <th key={row.outcomeId} className="p-2 text-center">
                          {row.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.students.map((student) => (
                      <tr key={student.id} className="border-t">
                        <td className="whitespace-nowrap p-2">{student.enrollmentNo}</td>
                        <td className="whitespace-nowrap p-2">{student.name}</td>
                        {result.rows.map((row) => {
                          const cell = student.perCo[row.outcomeId];
                          return (
                            <td key={row.outcomeId} className="p-2 text-center">
                              {!cell || cell.percent === null
                                ? "-"
                                : `${cell.percent}% ${cell.attained ? "✓" : "✗"}`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}