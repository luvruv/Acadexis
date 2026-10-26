import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendAnnexures } from "@/lib/docx/annexures";

async function makePdf(pageCount) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) pdf.addPage([300, 300]);
  return Buffer.from(await pdf.save());
}

async function pageCountOf(buffer) {
  return (await PDFDocument.load(buffer)).getPageCount();
}

const meta = (number, extra = {}) => ({
  number, fileName: `file${number}.pdf`, sectionNumber: 13, sectionTitle: "Mid Semester Papers", ...extra,
});

describe("appendAnnexures", () => {
  it("returns the same file when there is nothing to append", async () => {
    const main = await makePdf(2);
    expect(await appendAnnexures(main, [])).toBe(main);
  });

  it("adds a divider page and then the pages of each annexure", async () => {
    const result = await appendAnnexures(await makePdf(2), [
      { ...meta(1), buffer: await makePdf(3) },
      { ...meta(2), buffer: await makePdf(1) },
    ]);
    expect(await pageCountOf(result)).toBe(2 + (1 + 3) + (1 + 1));
  });

  it("keeps going when a file is damaged, leaving only its divider page", async () => {
    const result = await appendAnnexures(await makePdf(1), [
      { ...meta(1), buffer: Buffer.from("this is not a pdf") },
      { ...meta(2), buffer: await makePdf(2) },
    ]);
    expect(await pageCountOf(result)).toBe(1 + 1 + (1 + 2));
  });

  it("copes with non-Latin text in file and section names", async () => {
    const result = await appendAnnexures(await makePdf(1), [
      { ...meta(1, { fileName: "प्रश्न पत्र 試験.pdf", sectionTitle: "पत्र" }), buffer: await makePdf(1) },
    ]);
    expect(await pageCountOf(result)).toBe(3);
  });

  it("skips an annexure that would pass the page limit", async () => {
    const big = await makePdf(600);
    const result = await appendAnnexures(await makePdf(1), [
      { ...meta(1), buffer: big },
      { ...meta(2), buffer: big }, // 600 + 600 > 1000: its pages are left out
    ]);
    expect(await pageCountOf(result)).toBe(1 + (1 + 600) + 1);
  });
});