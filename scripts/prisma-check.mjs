import "dotenv/config";
import prismaPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaPackage;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const users = await prisma.user.count();
  const templates = await prisma.templateVersion.count();
  console.log("Prisma Client works. Users:", users, "| Template versions:", templates);
} catch (error) {
  console.error("Prisma check failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}