import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildSectionBody } from "./section-body.js";

export const TEMPLATE_PATH = path.join(process.cwd(), "templates", "bmu-course-file.docx");

const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const CONTENT_TYPES = { png: "image/png", jpg: "image/jpeg" };

// Adds the embedded pictures to the package: the files, the relationships that
// point at them, and the content types Word needs to open them.
function injectMedia(zip, media) {
  if (media.length === 0) return;

  for (const item of media) zip.file(`word/media/${item.mediaName}`, item.buffer);

  const relsPath = "word/_rels/document.xml.rels";
  const relationships = media
    .map(
      (item) =>
        `<Relationship Id="${item.relId}" Type="${IMAGE_REL_TYPE}" Target="media/${item.mediaName}"/>`
    )
    .join("");
  zip.file(relsPath, zip.file(relsPath).asText().replace("</Relationships>", `${relationships}</Relationships>`));

  let types = zip.file("[Content_Types].xml").asText();
  for (const [extension, contentType] of Object.entries(CONTENT_TYPES)) {
    const used = media.some((item) => item.mediaName.endsWith(`.${extension}`));
    if (used && !new RegExp(`Extension="${extension}"`, "i").test(types)) {
      types = types.replace("</Types>", `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`);
    }
  }
  zip.file("[Content_Types].xml", types);
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// doc: the structure returned by loadCourseFileDocument().
// documentId: the official Document ID, or null for a draft.
// assets: the result of loadAttachmentAssets() (optional).
export function renderCourseFileDocx(
  doc,
  { documentId = null, generatedAt = new Date(), assets = null } = {}
) {
  const { header } = doc;

  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));
  const template = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  template.render({
    universityName: header.universityName ?? "",
    schoolName: header.schoolName,
    programName: header.programName,
    courseCode: header.courseCode,
    courseTitle: header.courseTitle,
    semester: header.semester,
    academicYear: header.academicYear,
    batch: header.batch ?? "-",
    coordinatorName: header.coordinatorName,
    documentId: documentId ?? "DRAFT (not issued)",
    generatedOn: formatDate(generatedAt),
    draftNotice: documentId ? "" : "DRAFT: not an official copy.",
    sections: doc.sections.map((section) => ({
      number: section.number,
      title: section.title,
      body: buildSectionBody(section, assets),
    })),
  });

  const output = template.getZip();
  if (assets) injectMedia(output, assets.media);
  return output.generate({ type: "nodebuffer", compression: "DEFLATE" });
}