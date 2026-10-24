import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MAX_ANNEXURE_PAGES = 1000;
const A4 = [595.28, 841.89];

// The built-in PDF fonts only support Latin characters.
function latin(text, maxLength) {
  const clean = String(text).replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3)}...` : clean;
}

// Appends each uploaded PDF after the main document, each behind a divider page.
export async function appendAnnexures(pdfBuffer, annexures) {
  if (annexures.length === 0) return pdfBuffer;

  const output = await PDFDocument.load(pdfBuffer);
  const regular = await output.embedFont(StandardFonts.TimesRoman);
  const bold = await output.embedFont(StandardFonts.TimesRomanBold);
  let pagesAdded = 0;

  for (const annexure of annexures) {
    const divider = output.addPage(A4);
    divider.drawText(`Annexure ${annexure.number}`, {
      x: 72, y: 600, size: 30, font: bold, color: rgb(0, 0, 0),
    });
    divider.drawText(
      latin(`Section ${annexure.sectionNumber}: ${annexure.sectionTitle}`, 80),
      { x: 72, y: 560, size: 13, font: regular }
    );
    divider.drawText(latin(`File: ${annexure.fileName}`, 80), {
      x: 72, y: 538, size: 13, font: regular,
    });

    let problem = null;
    let source = null;
    try {
      source = await PDFDocument.load(annexure.buffer);
    } catch {
      problem = "Not merged: the file is encrypted or damaged. It is still stored in the system.";
    }

    if (source) {
      const count = source.getPageCount();
      if (pagesAdded + count > MAX_ANNEXURE_PAGES) {
        problem = `Not merged: it would exceed the ${MAX_ANNEXURE_PAGES} annexure page limit.`;
      } else {
        const pages = await output.copyPages(source, source.getPageIndices());
        pages.forEach((page) => output.addPage(page));
        pagesAdded += count;
      }
    }

    if (problem) {
      divider.drawText(latin(problem, 95), {
        x: 72, y: 500, size: 11, font: regular, color: rgb(0.75, 0, 0),
      });
    }
  }

  return Buffer.from(await output.save());
}