import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { afterAll, beforeEach, vi } from "vitest";

// ----- 1. Point everything at the TEST database, and refuse anything else -----
dotenv.config({ path: ".env.test", override: true });

const url = process.env.DATABASE_URL ?? "";
let dbName = "";
let host = "";
try {
  const parsed = new URL(url);
  dbName = parsed.pathname.replace(/^\//, "");
  host = parsed.hostname;
} catch {
  // handled below
}
if (!dbName.endsWith("_test") || !["localhost", "127.0.0.1"].includes(host)) {
  throw new Error(
    `Integration tests refused to start: DATABASE_URL in .env.test must be a local database whose name ends with _test (found "${dbName}" on "${host}").`
  );
}

// Temporary folders for files, so the real storage/ folder is never touched.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acadexis-it-"));
process.env.UPLOAD_DIR = path.join(tempRoot, "uploads");
process.env.GENERATED_DIR = path.join(tempRoot, "generated");
process.env.CRON_SECRET = "integration-test-secret-0123456789";

// ----- 2. Replace framework pieces that need a running Next.js server -----
vi.mock("@/lib/auth", () => ({
  auth: async () => globalThis.__testSession ?? null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

// The real redirect() throws; keep that so tests can check where it goes.
vi.mock("next/navigation", () => ({
  redirect: (to) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body, init) => Response.json(body, init),
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: actual, cache: (fn) => fn };
});

// No LibreOffice in tests: return a tiny valid PDF instead.
vi.mock("@/lib/docx/pdf", async () => {
  const { PDFDocument } = await import("pdf-lib");
  class PdfUnavailableError extends Error {}
  return {
    PdfUnavailableError,
    convertDocxToPdf: async () => {
      const pdf = await PDFDocument.create();
      pdf.addPage([200, 200]);
      return Buffer.from(await pdf.save());
    },
  };
});

// ----- 3. Clean database before every test -----
beforeEach(async () => {
  globalThis.__testSession = null;
  const { resetDb } = await import("./db.js");
  await resetDb();
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
