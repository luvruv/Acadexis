import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { issueOfficialDocument, sha256 } from "@/lib/export-service";
import { lockCourseFileAction } from "@/app/(app)/coordinator/course-files/[id]/lock-actions";
import { POST as exportRoute } from "@/app/api/course-files/[id]/export/route";
import { GET as documentRoute } from "@/app/api/documents/[documentId]/route";
import { form, makeCourseFile, makeLockableFile, makeUser, params, signInAs } from "./fixtures";

async function lockedFile() {
  const coordinator = await makeUser("COORDINATOR");
  const made = await makeLockableFile(coordinator);
  signInAs(coordinator);
  const locked = await lockCourseFileAction(null, form({ courseFileId: made.courseFile.id }));
  expect(locked.ok).toBe(true);
  return { coordinator, ...made };
}

const callExport = (courseFileId) =>
  exportRoute(new Request("http://localhost/x", { method: "POST" }), params({ id: courseFileId }));
const callDownload = (documentId, format = "pdf") =>
  documentRoute(
    new Request(`http://localhost/api/documents/${documentId}?format=${format}`),
    params({ documentId })
  );

describe("issueOfficialDocument", () => {
  it("refuses a course file that is not locked", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
    await expect(issueOfficialDocument(courseFile.id, coordinator)).rejects.toMatchObject({
      status: 409,
      message: "Lock the course file before exporting it.",
    });
  });

  it("refuses a coordinator who does not own the file", async () => {
    const { courseFile } = await lockedFile();
    const other = await makeUser("COORDINATOR");
    await expect(issueOfficialDocument(courseFile.id, other)).rejects.toMatchObject({
      status: 404,
      message: "Course file not found.",
    });
  });

  it("issues a document, stores both files and marks the file Exported", async () => {
    const { coordinator, courseFile } = await lockedFile();
    const { document, created } = await issueOfficialDocument(courseFile.id, coordinator);

    expect(created).toBe(true);
    expect(document.documentId).toMatch(/^ACX-TST\d+-2026-27-S5-R1-[A-HJKMNP-Z2-9]{4}$/);
    expect((await prisma.courseFile.findUnique({ where: { id: courseFile.id } })).status).toBe("EXPORTED");

    for (const [rel, hash] of [[document.docxPath, document.docxSha256], [document.pdfPath, document.pdfSha256]]) {
      const bytes = fs.readFileSync(path.join(process.env.GENERATED_DIR, rel));
      expect(bytes.length).toBeGreaterThan(0);
      expect(sha256(bytes)).toBe(hash);
    }
    expect(await prisma.auditLog.count({ where: { action: "DOCUMENT_ISSUED" } })).toBe(1);
  });

  it("returns the same document when called again", async () => {
    const { coordinator, courseFile } = await lockedFile();
    const first = await issueOfficialDocument(courseFile.id, coordinator);
    const second = await issueOfficialDocument(courseFile.id, coordinator);
    expect(second.created).toBe(false);
    expect(second.document.documentId).toBe(first.document.documentId);
    expect(await prisma.generatedDocument.count({ where: { courseFileId: courseFile.id } })).toBe(1);
  });
});

describe("POST /api/course-files/[id]/export", () => {
  it("returns 409 for an unlocked file", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
    signInAs(coordinator);
    const response = await callExport(courseFile.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Lock the course file before exporting it." });
  });

  it("returns 401 signed out and 403 for a co-teacher", async () => {
    const { courseFile } = await lockedFile();
    signInAs(null);
    expect((await callExport(courseFile.id)).status).toBe(401);
    signInAs(await makeUser("CO_TEACHER"));
    expect((await callExport(courseFile.id)).status).toBe(403);
  });

  it("returns 404 for another coordinator", async () => {
    const { courseFile } = await lockedFile();
    signInAs(await makeUser("COORDINATOR"));
    expect((await callExport(courseFile.id)).status).toBe(404);
  });

  it("issues the document for the owner, then reports created false", async () => {
    const { coordinator, courseFile } = await lockedFile();
    signInAs(coordinator);
    const first = await (await callExport(courseFile.id)).json();
    expect(first.created).toBe(true);
    expect(first.documentId).toMatch(/^ACX-/);
    const second = await (await callExport(courseFile.id)).json();
    expect(second).toEqual({ documentId: first.documentId, created: false });
  });
});

describe("GET /api/documents/[documentId]", () => {
  async function issued() {
    const base = await lockedFile();
    const { document } = await issueOfficialDocument(base.courseFile.id, base.coordinator);
    return { ...base, document };
  }

  it("lets the owning coordinator download the PDF and DOCX", async () => {
    const { coordinator, document } = await issued();
    signInAs(coordinator);
    const pdf = await callDownload(document.documentId, "pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain(`${document.documentId}.pdf`);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");

    const docx = await callDownload(document.documentId, "docx");
    expect(docx.status).toBe(200);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
    expect(await prisma.auditLog.count({ where: { action: "DOCUMENT_DOWNLOADED" } })).toBe(2);
  });

  it("lets an admin download", async () => {
    const { document } = await issued();
    signInAs(await makeUser("ADMIN"));
    expect((await callDownload(document.documentId)).status).toBe(200);
  });

  it("returns 404 to another coordinator and to a co-teacher", async () => {
    const { document } = await issued();
    for (const role of ["COORDINATOR", "CO_TEACHER"]) {
      signInAs(await makeUser(role));
      const response = await callDownload(document.documentId);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Document not found." });
    }
  });

  it("returns 401 when signed out and 404 for an unknown id", async () => {
    const { coordinator, document } = await issued();
    signInAs(null);
    expect((await callDownload(document.documentId)).status).toBe(401);
    signInAs(coordinator);
    expect((await callDownload("ACX-NOPE")).status).toBe(404);
  });

  it("returns 500 when the stored file was changed", async () => {
    const { coordinator, document } = await issued();
    fs.appendFileSync(path.join(process.env.GENERATED_DIR, document.pdfPath), "tampered");
    signInAs(coordinator);
    const response = await callDownload(document.documentId, "pdf");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The stored file failed its integrity check." });
  });

  it("returns 404 when the stored file is missing", async () => {
    const { coordinator, document } = await issued();
    fs.rmSync(path.join(process.env.GENERATED_DIR, document.pdfPath));
    signInAs(coordinator);
    const response = await callDownload(document.documentId, "pdf");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "The stored file is missing." });
  });
});
