import { prisma } from "@/lib/prisma";

let counter = 0;

export function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

// Pretend this user is signed in (or pass null for signed out).
export function signInAs(user) {
  globalThis.__testSession = user ? { user: { id: user.id } } : null;
}

export async function makeUser(role, overrides = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}${counter}@test.local`,
      name: `${role} ${counter}`,
      passwordHash: "not-a-real-hash",
      role,
      ...overrides,
    },
  });
}

const SECTION_SPECS = [
  { number: 1, title: "Course Details", formKey: "course-details", source: "COURSE_SETUP" },
  { number: 2, title: "University Vision and Mission", formKey: "university-vision-mission", source: "PROGRAM_DATA" },
  { number: 3, title: "Course Description", formKey: "course-description", source: "COURSE_SETUP" },
  { number: 4, title: "Session Plan", formKey: "session-plan", source: "CONTRIBUTOR" },
  { number: 5, title: "Mid-semester Papers", formKey: "midsem-papers", source: "CONTRIBUTOR" },
  { number: 6, title: "CO Attainment", formKey: "co-attainment", source: "COMPUTED" },
];

// A small course file with one section of each kind. "sections" is keyed by formKey.
export async function makeCourseFile(coordinator, { status = "CREATED" } = {}) {
  counter += 1;
  const university = await prisma.university.create({
    data: { name: `Test University ${counter}`, vision: "v", mission: "m" },
  });
  const school = await prisma.school.create({
    data: { universityId: university.id, name: "Test School", vision: "v", mission: "m" },
  });
  const program = await prisma.program.create({
    data: { schoolId: school.id, name: "Test Program", code: "TP" },
  });
  const course = await prisma.course.create({
    data: { programId: program.id, code: `TST${counter}`, title: "Test Course" },
  });
  const template = await prisma.templateVersion.create({
    data: { name: `Test template ${counter}` },
  });
  const courseFile = await prisma.courseFile.create({
    data: {
      courseId: course.id,
      templateVersionId: template.id,
      coordinatorId: coordinator.id,
      semester: "5",
      academicYear: "2026-27",
      status,
    },
  });

  const sections = {};
  for (const spec of SECTION_SPECS) {
    sections[spec.formKey] = await prisma.courseFileSection.create({
      data: { courseFileId: courseFile.id, isRequired: true, ...spec },
    });
  }
  return { courseFile, sections };
}

export async function reload(model, id) {
  return prisma[model].findUnique({ where: { id } });
}

// One CO, one quiz component mapped to it, and two students.
// Step 41 will change how attainment is calculated; if the inputs it needs
// change, only this helper has to be updated.
export async function addAttainmentData(courseFile, { complete = true } = {}) {
  const outcome = await prisma.courseOutcome.create({
    data: {
      courseFileId: courseFile.id, code: "CO1", description: "Outcome 1", position: 1,
      attainmentWeight: 1,
    },
  });
  const component = await prisma.assessmentComponent.create({
    data: { courseFileId: courseFile.id, name: "Quiz", maxMarks: 10, position: 1 },
  });
  await prisma.componentCourseOutcome.create({
    data: { componentId: component.id, courseOutcomeId: outcome.id, weight: 1 },
  });
  for (const n of [1, 2]) {
    const student = await prisma.student.create({
      data: { courseFileId: courseFile.id, enrollmentNo: `E${n}`, name: `Student ${n}` },
    });
    if (complete) {
      await prisma.mark.create({
        data: { componentId: component.id, studentId: student.id, marks: 7 },
      });
    }
  }
}

// A course file that is ready to lock: every section that counts is Approved
// and the attainment data is complete.
export async function makeLockableFile(coordinator) {
  const made = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
  await prisma.courseFileSection.updateMany({
    where: { courseFileId: made.courseFile.id, source: { not: "COMPUTED" } },
    data: { status: "APPROVED" },
  });
  await addAttainmentData(made.courseFile);
  return made;
}

export const params = (value) => ({ params: Promise.resolve(value) });
