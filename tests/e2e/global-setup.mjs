import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import prismaPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PASSWORD, USERS } from "./constants.mjs";

const { PrismaClient } = prismaPackage;

export default async function globalSetup() {
  dotenv.config({ path: ".env.test", override: true, quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!url.pathname.replace(/^\//, "").endsWith("_test")) {
    throw new Error("E2E global setup refused: not a test database.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    // Empty every table except Prisma's own migration table.
    const [{ current_database: dbName }] = await prisma.$queryRaw`SELECT current_database()`;
    if (!String(dbName).endsWith("_test")) throw new Error(`Refused: "${dbName}"`);
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

    // Users
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const users = {};
    for (const [key, user] of Object.entries(USERS)) {
      users[key] = await prisma.user.create({ data: { ...user, passwordHash } });
    }

    // One small course file owned by the coordinator
    const university = await prisma.university.create({
      data: { name: "E2E University", vision: "Vision", mission: "Mission" },
    });
    const school = await prisma.school.create({
      data: { universityId: university.id, name: "E2E School", vision: "v", mission: "m" },
    });
    const program = await prisma.program.create({
      data: { schoolId: school.id, name: "E2E Program", code: "E2E" },
    });
    const course = await prisma.course.create({
      data: { programId: program.id, code: "E2E101", title: "End to End Testing" },
    });
    const template = await prisma.templateVersion.create({ data: { name: "E2E template" } });
    const courseFile = await prisma.courseFile.create({
      data: {
        courseId: course.id,
        templateVersionId: template.id,
        coordinatorId: users.coordinator.id,
        semester: "5",
        academicYear: "2026-27",
        status: "CREATED",
      },
    });

    const specs = [
      { number: 1, title: "Course Details", formKey: "course-details", source: "COURSE_SETUP" },
      { number: 2, title: "University Vision and Mission", formKey: "university-vision-mission", source: "PROGRAM_DATA", status: "APPROVED" },
      { number: 3, title: "Course Description", formKey: "course-description", source: "COURSE_SETUP" },
      { number: 4, title: "Session Plan", formKey: "session-plan", source: "CONTRIBUTOR" },
    ];
    const sections = {};
    for (const spec of specs) {
      sections[spec.formKey] = await prisma.courseFileSection.create({
        data: { courseFileId: courseFile.id, isRequired: true, ...spec },
      });
    }

    const dir = path.join("tests", "e2e", ".run");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "state.json"),
      JSON.stringify({
        courseFileId: courseFile.id,
        descriptionSectionId: sections["course-description"].id,
        teacher1Id: users.teacher1.id,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}
