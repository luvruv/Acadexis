import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EDITABLE_SECTION_STATUSES } from "@/lib/sections";
import MarksEditor from "./marks-editor";

export const metadata = { title: "Marks | Acadexis" };

export default async function MarksPage({ params }) {
  const user = await requireUser();
  const { id } = await params;

  // The coordinator, or the assignee of the marks section. Others get a 404.
  const courseFile = await prisma.courseFile.findFirst({
    where: {
      id,
      OR: [
        { coordinatorId: user.id },
        { sections: { some: { formKey: "marks-all-components", assigneeId: user.id } } },
      ],
    },
    include: {
      course: { select: { code: true, title: true } },
      students: { orderBy: [{ classGroup: "asc" }, { enrollmentNo: "asc" }] },
      assessmentComponents: { orderBy: { position: "asc" } },
      sections: {
        where: { formKey: "marks-all-components" },
        select: { status: true },
      },
    },
  });
  if (!courseFile) notFound();

  const isCoordinator = courseFile.coordinatorId === user.id;
  const locked = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";
  const marksSection = courseFile.sections[0];

  let readOnlyReason = null;
  if (locked) {
    readOnlyReason = "The course file is locked, so marks are view only.";
  } else if (!isCoordinator && !EDITABLE_SECTION_STATUSES.includes(marksSection?.status)) {
    readOnlyReason = "The marks section is submitted or approved, so you cannot edit it.";
  }

  const backHref = isCoordinator
    ? `/coordinator/course-files/${id}`
    : "/teacher";

  let body;
  if (courseFile.students.length === 0 || courseFile.assessmentComponents.length === 0) {
    body = (
      <p className="rounded-md border bg-muted p-3 text-sm">
        {courseFile.students.length === 0 && "The student list is empty. "}
        {courseFile.assessmentComponents.length === 0 &&
          "No assessment components are defined. "}
        {isCoordinator
          ? "The coordinator needs to complete these first."
          : "Ask the coordinator to complete these first."}
        {isCoordinator && (
          <>
            {" "}
            <Link href={`/coordinator/course-files/${id}/students`} className="underline">
              Student list
            </Link>
            {" · "}
            <Link href={`/coordinator/course-files/${id}/assessments`} className="underline">
              Assessment components
            </Link>
          </>
        )}
      </p>
    );
  } else {
    const marks = await prisma.mark.findMany({
      where: { component: { courseFileId: id } },
      select: { componentId: true, studentId: true, marks: true, absent: true, updatedAt: true },
    });

    const values = {};
    let latest = 0;
    for (const mark of marks) {
      values[`${mark.studentId}:${mark.componentId}`] = mark.absent
        ? "AB"
        : String(Number(mark.marks));
      latest = Math.max(latest, mark.updatedAt.getTime());
    }

    body = (
      <MarksEditor
        courseFileId={id}
        revision={`${marks.length}-${latest}`}
        readOnlyReason={readOnlyReason}
        students={courseFile.students.map((student) => ({
          id: student.id,
          enrollmentNo: student.enrollmentNo,
          rollNo: student.rollNo,
          name: student.name,
        }))}
        components={courseFile.assessmentComponents.map((component) => ({
          id: component.id,
          name: component.name,
          maxMarks: Number(component.maxMarks),
        }))}
        initialValues={values}
      />
    );
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href={backHref} className="text-sm underline">
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Marks: {courseFile.course.code}
        </h1>
        <p className="text-muted-foreground">{courseFile.course.title}</p>
      </div>
      {body}
    </div>
  );
}