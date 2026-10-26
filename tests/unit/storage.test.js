import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakePng } from "./helpers.js";

// Storage reads its folders when it is first loaded, so they are set up first.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "acx-storage-"));
process.env.UPLOAD_DIR = path.join(root, "uploads");
process.env.GENERATED_DIR = path.join(root, "generated");

const storage = await import("@/lib/storage");
const { loadAttachmentAssets } = await import("@/lib/docx/attachments");

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("storage", () => {
  it("saves and reads a file back", async () => {
    await storage.saveFile("cf1/a.bin", Buffer.from("hello"));
    expect((await storage.readStoredFile("cf1/a.bin")).toString()).toBe("hello");
  });

  it("never overwrites an existing file", async () => {
    await storage.saveFile("cf1/once.bin", Buffer.from("1"));
    await expect(storage.saveFile("cf1/once.bin", Buffer.from("2"))).rejects.toThrow();
    expect((await storage.readStoredFile("cf1/once.bin")).toString()).toBe("1");
  });

  it("refuses paths that leave the storage folder", async () => {
    for (const bad of ["../outside.txt", "../../etc/passwd", "cf1/../../outside", path.join(root, "outside.txt")]) {
      await expect(storage.saveFile(bad, Buffer.from("x"))).rejects.toThrow("Invalid storage path.");
      await expect(storage.readStoredFile(bad)).rejects.toThrow("Invalid storage path.");
    }
    expect(fs.existsSync(path.join(root, "outside.txt"))).toBe(false);
  });

  it("keeps uploads and generated documents apart", async () => {
    await storage.saveGeneratedFile("cf1/doc.pdf", Buffer.from("pdf"));
    await expect(storage.readStoredFile("cf1/doc.pdf")).rejects.toThrow();
    expect((await storage.readGeneratedFile("cf1/doc.pdf")).toString()).toBe("pdf");
  });

  it("deleting a missing file is not an error", async () => {
    await expect(storage.deleteStoredFile("cf1/missing.bin")).resolves.toBeUndefined();
    await storage.deleteStoredFile("cf1/a.bin");
    await expect(storage.readStoredFile("cf1/a.bin")).rejects.toThrow();
  });
});

describe("loadAttachmentAssets", () => {
  const attachment = (id, name, mimeType, storagePath = `assets/${id}`) => ({
    id, name, mimeType, sizeBytes: 100, storagePath,
  });

  beforeAll(async () => {
    await storage.saveFile("assets/small", fakePng(100, 100));
    await storage.saveFile("assets/wide", fakePng(4000, 3000));
    await storage.saveFile("assets/tall", fakePng(1000, 8000));
    await storage.saveFile("assets/pdf1", Buffer.from("%PDF-1.7"));
    await storage.saveFile("assets/pdf2", Buffer.from("%PDF-1.7"));
    await storage.saveFile("assets/docx", Buffer.from("PK"));
    await storage.saveFile("assets/notimage", Buffer.from("definitely not a png"));
  });

  const doc = {
    sections: [
      { number: 5, kind: "details", data: {} }, // ignored: not a form
      {
        number: 13, title: "Papers", kind: "form",
        data: {
          attachments: [
            attachment("small", "small.png", "image/png"),
            attachment("wide", "wide.png", "image/png"),
            attachment("tall", "tall.png", "image/png"),
            attachment("pdf1", "a.pdf", "application/pdf"),
            attachment("docx", "b.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            attachment("gone", "gone.png", "image/png", "assets/does-not-exist"),
            attachment("notimage", "fake.png", "image/png"),
          ],
        },
      },
      { number: 17, title: "End sem", kind: "form", data: { attachments: [attachment("pdf2", "c.pdf", "application/pdf")] } },
    ],
  };

  it("sorts every file into image, annexure, list-only or missing", async () => {
    const { byId, media, annexures } = await loadAttachmentAssets(doc);
    expect(byId.get("small").kind).toBe("image");
    expect(byId.get("wide").kind).toBe("image");
    expect(byId.get("pdf1")).toEqual({ kind: "pdf", annexureNumber: 1 });
    expect(byId.get("pdf2")).toEqual({ kind: "pdf", annexureNumber: 2 });
    expect(byId.get("docx").kind).toBe("other");
    expect(byId.get("gone").kind).toBe("missing");
    expect(byId.get("notimage").kind).toBe("other"); // PNG by name, not by content
    expect(media).toHaveLength(3);
    expect(annexures.map((a) => [a.number, a.sectionNumber])).toEqual([[1, 13], [2, 17]]);
  });

  it("scales big pictures down to the page and never scales small ones up", async () => {
    const { byId } = await loadAttachmentAssets(doc);
    const textWidthEmu = 9026 * 635;
    const maxHeightEmu = 6 * 914400;

    const small = byId.get("small");
    expect([small.cx, small.cy]).toEqual([100 * 9525, 100 * 9525]);

    const wide = byId.get("wide");
    expect(wide.cx).toBeLessThanOrEqual(textWidthEmu);
    expect(wide.cy).toBeLessThanOrEqual(maxHeightEmu);
    expect(Math.abs(wide.cx / wide.cy - 4000 / 3000)).toBeLessThan(0.001);

    const tall = byId.get("tall");
    expect(tall.cy).toBeLessThanOrEqual(maxHeightEmu);
    expect(Math.abs(tall.cx / tall.cy - 1000 / 8000)).toBeLessThan(0.001);
  });

  it("gives every picture its own relationship id and file name", async () => {
    const { media } = await loadAttachmentAssets(doc);
    expect(new Set(media.map((m) => m.relId)).size).toBe(media.length);
    expect(new Set(media.map((m) => m.mediaName)).size).toBe(media.length);
  });
});