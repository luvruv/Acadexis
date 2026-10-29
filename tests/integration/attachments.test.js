import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as uploadRoute } from "@/app/api/sections/[id]/attachments/route";
import { GET as downloadRoute, DELETE as deleteRoute } from "@/app/api/attachments/[id]/route";
import { makeCourseFile, makeUser, params, reload, signInAs } from "./fixtures";

const PDF = () => Buffer.from("%PDF-1.7\n%acadexis test\n");

async function setup({ formKey = "midsem-papers", fileStatus = "IN_PROGRESS", sectionStatus } = {}) {
  const coordinator = await makeUser("COORDINATOR");
  const teacher = await makeUser("CO_TEACHER");
  const { courseFile, sections } = await makeCourseFile(coordinator, { status: fileStatus });
  const section = sections[formKey];
  await prisma.courseFileSection.update({
    where: { id: section.id },
    data: { assigneeId: teacher.id, ...(sectionStatus ? { status: sectionStatus } : {}) },
  });
  return { coordinator, teacher, courseFile, section };
}

function upload(section, file) {
  const body = new FormData();
  if (file) body.append("file", file);
  return uploadRoute(
    new Request("http://localhost/x", { method: "POST", body }),
    params({ id: section.id })
  );
}
const pdfFile = (name = "paper.pdf") => new File([PDF()], name, { type: "application/pdf" });
const download = (id) => downloadRoute(new Request("http://localhost/x"), params({ id }));
const remove = (id) => deleteRoute(new Request("http://localhost/x", { method: "DELETE" }), params({ id }));

describe("POST /api/sections/[id]/attachments", () => {
  it("stores a valid PDF for the assignee", async () => {
    const { teacher, section, courseFile } = await setup();
    signInAs(teacher);
    const response = await upload(section, pdfFile());
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.attachment.name).toBe("paper.pdf");

    const row = await prisma.attachment.findUnique({ where: { id: body.attachment.id } });
    expect(row.mimeType).toBe("application/pdf");
    expect(row.storagePath).toBe(`${courseFile.id}/${row.id}`);
    expect(fs.existsSync(path.join(process.env.UPLOAD_DIR, row.storagePath))).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "ATTACHMENT_UPLOADED" } })).toBe(1);
  });

  it("rejects a text file renamed to .pdf", async () => {
    const { teacher, section } = await setup();
    signInAs(teacher);
    const response = await upload(section, new File(["hello"], "fake.pdf", { type: "application/pdf" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The file content does not match its type." });
    expect(await prisma.attachment.count()).toBe(0);
  });

  it("rejects a disallowed file type", async () => {
    const { teacher, section } = await setup();
    signInAs(teacher);
    const response = await upload(section, new File(["MZ"], "virus.exe"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "File type not allowed. Use PDF, PNG, JPG, DOCX or XLSX.",
    });
  });

  it("rejects a request without a file", async () => {
    const { teacher, section } = await setup();
    signInAs(teacher);
    const response = await upload(section, null);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Choose a file to upload." });
  });

  it("rejects a file above 10 MB", async () => {
    const { teacher, section } = await setup();
    signInAs(teacher);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    const response = await upload(section, big);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "File is too large (max 10 MB)." });
  });

  it("allows at most 10 files per section", async () => {
    const { teacher, section } = await setup();
    for (let i = 0; i < 10; i += 1) {
      await prisma.attachment.create({
        data: {
          sectionId: section.id, uploadedById: teacher.id, originalName: `f${i}.pdf`,
          storagePath: `x/f${i}`, mimeType: "application/pdf", sizeBytes: 10,
        },
      });
    }
    signInAs(teacher);
    const response = await upload(section, pdfFile());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "At most 10 files per section." });
  });

  it("is limited to the assignee", async () => {
    const { section } = await setup();
    signInAs(await makeUser("CO_TEACHER"));
    const response = await upload(section, pdfFile());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Section not found." });
  });

  it("refuses an admin and a signed-out request", async () => {
    const { section } = await setup();
    signInAs(await makeUser("ADMIN"));
    expect((await upload(section, pdfFile())).status).toBe(403);
    signInAs(null);
    expect((await upload(section, pdfFile())).status).toBe(401);
  });

  it("is blocked when the file is locked or the section is submitted", async () => {
    let ctx = await setup({ fileStatus: "LOCKED" });
    signInAs(ctx.teacher);
    let response = await upload(ctx.section, pdfFile());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "The course file is locked." });

    ctx = await setup({ sectionStatus: "SUBMITTED" });
    signInAs(ctx.teacher);
    response = await upload(ctx.section, pdfFile());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This section can no longer be edited." });
  });

  it("refuses a section whose form has no uploads", async () => {
    const { teacher, section } = await setup({ formKey: "course-description" });
    signInAs(teacher);
    const response = await upload(section, pdfFile());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "This section does not accept file uploads." });
  });
});

describe("GET and DELETE /api/attachments/[id]", () => {
  async function withFile(options) {
    const ctx = await setup(options);
    signInAs(ctx.teacher);
    const body = await (await upload(ctx.section, pdfFile())).json();
    return { ...ctx, attachmentId: body.attachment.id };
  }

  it("lets the assignee and the owning coordinator download", async () => {
    const { teacher, coordinator, attachmentId } = await withFile();
    for (const user of [teacher, coordinator]) {
      signInAs(user);
      const response = await download(attachmentId);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toContain("attachment");
      expect(Buffer.from(await response.arrayBuffer()).equals(PDF())).toBe(true);
    }
  });

  it("returns 404 to other users and 401 when signed out", async () => {
    const { attachmentId } = await withFile();
    for (const role of ["CO_TEACHER", "COORDINATOR"]) {
      signInAs(await makeUser(role));
      expect((await download(attachmentId)).status).toBe(404);
    }
    signInAs(null);
    expect((await download(attachmentId)).status).toBe(401);
  });

  it("lets the assignee delete while the section is editable", async () => {
    const { teacher, attachmentId } = await withFile();
    signInAs(teacher);
    const response = await remove(attachmentId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await prisma.attachment.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "ATTACHMENT_DELETED" } })).toBe(1);
  });

  it("does not let the coordinator delete someone else's file", async () => {
    const { coordinator, attachmentId } = await withFile();
    signInAs(coordinator);
    expect((await remove(attachmentId)).status).toBe(404);
    expect(await prisma.attachment.count()).toBe(1);
  });

  it("blocks delete after submission and after locking", async () => {
    const { teacher, section, courseFile, attachmentId } = await withFile();
    await prisma.courseFileSection.update({ where: { id: section.id }, data: { status: "SUBMITTED" } });
    signInAs(teacher);
    let response = await remove(attachmentId);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This section can no longer be edited." });

    await prisma.courseFileSection.update({ where: { id: section.id }, data: { status: "PENDING" } });
    await prisma.courseFile.update({ where: { id: courseFile.id }, data: { status: "LOCKED" } });
    response = await remove(attachmentId);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "The course file is locked." });
    expect(await reload("attachment", attachmentId)).not.toBeNull();
  });
});
