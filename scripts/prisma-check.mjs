import "dotenv/config";
import prismaPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaPackage;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const counts = {
    users: await prisma.user.count(),
    templateVersions: await prisma.templateVersion.count(),
    courses: await prisma.course.count(),
    courseFiles: await prisma.courseFile.count(),
    courseFileSections: await prisma.courseFileSection.count(),
    attachments: await prisma.attachment.count(),
  };
  console.log("Prisma Client works. Row counts:", counts);
} catch (error) {
  console.error("Prisma check failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}