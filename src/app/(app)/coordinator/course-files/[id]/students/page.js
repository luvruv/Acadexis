import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import StudentsEditor from "./students-editor";

export const metadata = { title: "Student list | Acadexis" };

export default async function StudentListPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  const courseFile = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    include: {
      course: { select: { code: true, title: true } },
      students: { orderBy: [{ classGroup: "asc" }, { enrollmentNo: "asc" }] },
      sections: {
        where: { formKey: "student-list" },
        select: { version: true },
      },
    },
  });
  if (!courseFile || courseFile.sections.length === 0) notFound();

  const students = courseFile.students.map((student) => ({
    id: student.id,
    enrollmentNo: student.enrollmentNo,
    rollNo: student.rollNo ?? "",
    name: student.name,
    classGroup: student.classGroup ?? "",
  }));

  const readOnly = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link href={`/coordinator/course-files/${id}`} className="text-sm underline">
          Back to course file
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Registered students: {courseFile.course.code}
        </h1>
        <p className="text-muted-foreground">{courseFile.course.title}</p>
      </div>

      <StudentsEditor
        courseFileId={id}
        sectionVersion={courseFile.sections[0].version}
        readOnly={readOnly}
        students={students}
      />
    </div>
  );
}