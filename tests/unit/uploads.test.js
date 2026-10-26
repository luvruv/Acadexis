import { describe, expect, it } from "vitest";
import { sanitizeFileName, validateUpload } from "@/lib/uploads";
import { parseMarkValue } from "@/lib/validation/marks";

const PDF = Buffer.from("%PDF-1.7\n...");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);

describe("validateUpload", () => {
  it("accepts real files of each type", () => {
    expect(validateUpload("paper.pdf", PDF)).toEqual({ ok: true, mimeType: "application/pdf" });
    expect(validateUpload("scan.png", PNG).mimeType).toBe("image/png");
    expect(validateUpload("photo.JPG", JPG).mimeType).toBe("image/jpeg");
    expect(validateUpload("photo.jpeg", JPG).mimeType).toBe("image/jpeg");
    expect(validateUpload("notes.docx", ZIP).ok).toBe(true);
    expect(validateUpload("marks.xlsx", ZIP).ok).toBe(true);
  });

  it("rejects a text file renamed to .pdf", () => {
    const result = validateUpload("fake.pdf", Buffer.from("hello"));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not match/);
  });

  it("rejects a PNG renamed to .pdf", () => {
    expect(validateUpload("image.pdf", PNG).ok).toBe(false);
  });

  it("rejects types that are not allowed", () => {
    for (const name of ["virus.exe", "page.html", "script.js", "noextension", "archive.zip", ".pdf.exe"]) {
      expect(validateUpload(name, PDF).ok).toBe(false);
    }
  });

  it("rejects a file shorter than its signature", () => {
    expect(validateUpload("tiny.png", Buffer.from([0x89])).ok).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("keeps only the file name", () => {
    expect(sanitizeFileName("..\\..\\secret\\file.pdf")).toBe("file.pdf");
    expect(sanitizeFileName("/etc/passwd")).toBe("passwd");
  });
  it("removes control characters", () => {
    expect(sanitizeFileName("a\u0000b\u001fc.pdf")).toBe("abc.pdf");
  });
  it("caps very long names and falls back for empty ones", () => {
    expect(sanitizeFileName("x".repeat(400) + ".pdf").length).toBe(150);
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("/")).toBe("file");
  });
});

describe("parseMarkValue", () => {
  it("clears empty cells", () => {
    expect(parseMarkValue("", 10)).toEqual({ kind: "clear" });
    expect(parseMarkValue("   ", 10)).toEqual({ kind: "clear" });
  });
  it("reads absent in any case", () => {
    for (const text of ["AB", "ab", "Absent", "ABSENT"]) {
      expect(parseMarkValue(text, 10)).toEqual({ kind: "absent" });
    }
  });
  it("reads numbers up to the maximum", () => {
    expect(parseMarkValue("7.5", 10)).toEqual({ kind: "number", value: 7.5 });
    expect(parseMarkValue("10", 10)).toEqual({ kind: "number", value: 10 });
    expect(parseMarkValue("0", 10)).toEqual({ kind: "number", value: 0 });
  });
  it("rejects values above the maximum", () => {
    expect(parseMarkValue("10.01", 10).error).toBe("cannot be more than 10");
  });
  it.each(["-1", "abc", "1e3", "7,5", "1.234", "12345678", "NaN", "Infinity"])("rejects %j", (text) => {
    expect(parseMarkValue(text, 100000).error).toBeTruthy();
  });
});