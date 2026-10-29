import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeAttainment, suggestedCoWeightPercents } from "@/lib/attainment";
import { loadAttainmentInputs } from "@/lib/attainment-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsForm from "./settings-form";

export const metadata = { title: "CO attainment | Acadexis" };

const percentOf = (fraction) => Math.round(fraction * 10000) / 100;

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

  const suggested = suggestedCoWeightPercents(inputs.outcomes.length);
  const formOutcomes = inputs.outcomes.map((outcome, index) => ({
    id: outcome.id,
    code: outcome.code,
    weightPercent: outcome.weight === null ? suggested[index] : percentOf(outcome.weight),
  }));
  const formSettings = {
    studentLevel3MinPercent: percentOf(settings.studentLevel3Min),
    studentLevel2MinPercent: percentOf(settings.studentLevel2Min),
    courseLevel3MinPercent: settings.courseLevel3MinPercent,
    courseLevel2MinPercent: settings.courseLevel2MinPercent,
    absentAsZero: settings.absentAsZero,
    confirmed: settings.confirmed,
  };

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
          <strong>Not yet confirmed.</strong> The starting values come from the department&apos;s
          HCI (CSE2724) attainment workbook. Check them for this course, then tick &quot;Confirmed
          by the department&quot;.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it is calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            For each Course Outcome (CO), every student gets a score: the sum of (component weight
            x marks) divided by the sum of (component weight x maximum marks), using the weights set
            for that CO on the assessment components page.
          </p>
          <p>
            Student level: Level 3 at {percentOf(settings.studentLevel3Min)}% or more, Level 2 at{" "}
            {percentOf(settings.studentLevel2Min)}% or more, otherwise Level 1. Absent students are{" "}
            {settings.absentAsZero ? "counted as 0 marks" : "left out"}.
          </p>
          <p>
            <strong>CO attainment</strong> is the average of the student levels.{" "}
            <strong>Target attainment level</strong>: Level 3 when {settings.courseLevel3MinPercent}%
            or more of the students are at Level 3, Level 2 at {settings.courseLevel2MinPercent}% or
            more, otherwise Level 1. Overall course attainment is the sum of (target level x CO
            weight).
          </p>
        </CardContent>
      </Card>

      <SettingsForm
        key={JSON.stringify([formSettings, formOutcomes])}
        courseFileId={id}
        settings={formSettings}
        outcomes={formOutcomes}
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
                  Assessment components and weights
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
                          {row.componentWeights.length > 0
                            ? row.componentWeights
                                .map((item) =>
                                  item.weightPercent === null
                                    ? `${item.name} (no weight)`
                                    : `${item.name} ${item.weightPercent}%`
                                )
                                .join(", ")
                            : "no component"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-2">Students at Level 3</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.level === null ? "-" : `${row.attained} of ${row.assessed}`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">% of students at Level 3</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.level === null ? "-" : `${row.percentage.toFixed(2)}%`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">Target attainment level</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.level === null ? "-" : row.level}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t font-medium">
                    <td className="p-2">CO attainment (average of student levels)</td>
                    {result.rows.map((row) => (
                      <td key={row.outcomeId} className="p-2 text-center">
                        {row.average === null ? "-" : row.average.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {result.overall !== null && (
            <p className="text-sm">
              <strong>Overall course attainment:</strong> {result.overall.toFixed(2)}
            </p>
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
                              {cell ? `${cell.percent}% (Level ${cell.level})` : "-"}
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
      <Card>
        <CardHeader>
          <CardTitle>PO and PSO attainment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {result.po.length === 0 ? (
            <p className="text-muted-foreground">
              Shown once the CO attainment above is complete (no items under &quot;Not ready&quot;).
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">Programme outcome</th>
                      <th className="p-2 text-center">Attainment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.po.map((item) => (
                      <tr key={item.code} className="border-t">
                        <td className="p-2">{item.code}</td>
                        <td className="p-2 text-center">
                          {item.value === null ? "-" : item.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground">
                Each value is the sum of (CO attainment x CO-PO level) divided by the sum of the
                CO-PO levels. A dash means no Course Outcome is mapped to that outcome. The CO-PO
                levels come from the course outcomes page.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
