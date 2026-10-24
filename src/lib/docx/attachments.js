import { imageSize } from "image-size";
import { readStoredFile } from "../storage.js";

const EMU_PER_PIXEL = 9525; // 96 dpi
const MAX_WIDTH_EMU = 9026 * 635; // the text width of the page
const MAX_HEIGHT_EMU = 6 * 914400; // 6 inches, so a picture fits under its heading
const MAX_EMBEDDED_BYTES = 40 * 1024 * 1024;

const IMAGE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg" };

// Reads every uploaded file of the course file and decides what to do with it:
//   image (PNG/JPG) -> embedded in the document under its section
//   PDF             -> appended as a numbered annexure in the PDF copy
//   anything else   -> listed by name only
// Returns { byId, media, annexures }.
export async function loadAttachmentAssets(doc) {
  const byId = new Map();
  const media = [];
  const annexures = [];
  let embeddedBytes = 0;

  for (const section of doc.sections) {
    if (section.kind !== "form") continue;

    for (const file of section.data.attachments) {
      let buffer;
      try {
        buffer = await readStoredFile(file.storagePath);
      } catch {
        byId.set(file.id, { kind: "missing" });
        continue;
      }

      const extension = IMAGE_EXTENSIONS[file.mimeType];
      if (extension) {
        if (embeddedBytes + buffer.length > MAX_EMBEDDED_BYTES) {
          byId.set(file.id, { kind: "too-large" });
          continue;
        }

        let size;
        try {
          size = imageSize(buffer);
        } catch {
          byId.set(file.id, { kind: "other" });
          continue;
        }
        if (!size.width || !size.height) {
          byId.set(file.id, { kind: "other" });
          continue;
        }

        const widthEmu = size.width * EMU_PER_PIXEL;
        const heightEmu = size.height * EMU_PER_PIXEL;
        const scale = Math.min(1, MAX_WIDTH_EMU / widthEmu, MAX_HEIGHT_EMU / heightEmu);

        const number = media.length + 1;
        const asset = {
          kind: "image",
          relId: `rIdAcadexisImg${number}`,
          mediaName: `acadexis-image-${number}.${extension}`,
          drawingId: 1000 + number,
          buffer,
          cx: Math.round(widthEmu * scale),
          cy: Math.round(heightEmu * scale),
        };
        embeddedBytes += buffer.length;
        media.push(asset);
        byId.set(file.id, asset);
      } else if (file.mimeType === "application/pdf") {
        const number = annexures.length + 1;
        annexures.push({
          number,
          buffer,
          fileName: file.name,
          sectionNumber: section.number,
          sectionTitle: section.title,
        });
        byId.set(file.id, { kind: "pdf", annexureNumber: number });
      } else {
        byId.set(file.id, { kind: "other" });
      }
    }
  }

  return { byId, media, annexures };
}