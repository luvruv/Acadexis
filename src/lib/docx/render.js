import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { buildSectionBody } from "./section-body.js";

export const TEMPLATE_PATH = path.join(process.cwd(), "templates", "bmu-course-file.docx");

function formatDate(date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// doc: the structure returned by loadCourseFileDocument().
// documentId: the official Document ID, or null for a draft.
export function renderCourseFileDocx(doc, { documentId = null, generatedAt = new Date() } = {}) {
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
      body: buildSectionBody(section),
    })),
  });

  return template.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}