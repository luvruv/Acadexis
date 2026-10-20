export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SECTION = 10;
export const ALLOWED_TYPES_LABEL = "PDF, PNG, JPG, DOCX or XLSX";

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // DOCX and XLSX are ZIP containers
const JPEG = [0xff, 0xd8, 0xff];

// The type is decided by the extension AND the file's first bytes.
const TYPES = {
  pdf: { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  png: { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { mime: "image/jpeg", signature: JPEG },
  jpeg: { mime: "image/jpeg", signature: JPEG },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: ZIP,
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signature: ZIP,
  },
};

// Keeps only the file name (no folders), removes control characters, caps length.
export function sanitizeFileName(name) {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(-150) || "file";
}

export function validateUpload(fileName, buffer) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  const type = TYPES[extension];

  if (!type) {
    return { ok: false, error: `File type not allowed. Use ${ALLOWED_TYPES_LABEL}.` };
  }

  const matches =
    buffer.length >= type.signature.length &&
    type.signature.every((byte, index) => buffer[index] === byte);
  if (!matches) {
    return { ok: false, error: "The file content does not match its type." };
  }

  return { ok: true, mimeType: type.mime };
}