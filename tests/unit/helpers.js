import { DOMParser } from "@xmldom/xmldom";

// Throws if the XML is not well-formed. Fragments are wrapped in a root tag.
export function assertWellFormed(xml, { wrap = true } = {}) {
  const text = wrap
    ? `<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${xml}</root>`
    : xml;
  const errors = [];
  new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") errors.push(message);
    },
  }).parseFromString(text, "text/xml");
  if (errors.length > 0) throw new Error(`XML is not well-formed: ${errors[0]}`);
}

// A minimal PNG header with the given size. Enough for image-size to read.
export function fakePng(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8; // bit depth
  buffer[25] = 2; // colour type
  return buffer;
}