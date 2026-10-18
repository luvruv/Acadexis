// TEMPORARY demo accounts for development only. They are not real users.
// The password comes from SEED_USER_PASSWORD in your local .env, never from code.
// Existing accounts are left untouched, so re-running is safe.

import "dotenv/config";
import prismaPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const { PrismaClient } = prismaPackage;

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create demo users in production.");
  process.exit(1);
}

const password = process.env.SEED_USER_PASSWORD;
if (!password || password.length < 8) {
  console.error("Set SEED_USER_PASSWORD in .env first (at least 8 characters).");
  process.exit(1);
}

const DEMO_USERS = [
  { email: "admin@acadexis.local", name: "Demo Admin", role: "ADMIN" },
  { email: "coordinator@acadexis.local", name: "Demo Coordinator", role: "COORDINATOR" },
  { email: "teacher1@acadexis.local", name: "Demo Teacher One", role: "CO_TEACHER" },
  { email: "teacher2@acadexis.local", name: "Demo Teacher Two", role: "CO_TEACHER" },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  for (const demoUser of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: { ...demoUser, passwordHash },
    });
    console.log(`${user.role.padEnd(11)} ${user.email}`);
  }
  console.log("Demo users ready.");
} catch (error) {
  console.error("Seeding users failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}