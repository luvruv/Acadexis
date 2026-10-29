import { prisma } from "@/lib/prisma";

// Empties every table (except Prisma's own migration table).
// Refuses to run on any database whose name does not end with _test.
export async function resetDb() {
  const [{ current_database: dbName }] = await prisma.$queryRaw`SELECT current_database()`;
  if (!String(dbName).endsWith("_test")) {
    throw new Error(`resetDb refused: "${dbName}" is not a test database.`);
  }
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
