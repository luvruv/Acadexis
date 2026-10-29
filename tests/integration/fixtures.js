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
