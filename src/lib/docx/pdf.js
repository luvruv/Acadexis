import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONVERSION_TIMEOUT_MS = 90_000;

export class PdfUnavailableError extends Error {}

// Finds the LibreOffice command. SOFFICE_PATH in .env wins.
function findSoffice() {
  if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;

  const candidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "soffice";
}

async function convertOnce(docxBuffer) {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "acadexis-pdf-"));
  try {
    const inputPath = path.join(workDir, "course-file.docx");
    await fs.promises.writeFile(inputPath, docxBuffer);

    // A fresh profile per conversion, so LibreOffice never fights over a
    // shared profile and nothing is left behind.
    const profileUrl = pathToFileURL(path.join(workDir, "profile")).href;

    try {
      await execFileAsync(
        findSoffice(),
        [
          "--headless",
          "--norestore",
          "--nolockcheck",
          `-env:UserInstallation=${profileUrl}`,
          "--convert-to",
          "pdf",
          "--outdir",
          workDir,
          inputPath,
        ],
        { timeout: CONVERSION_TIMEOUT_MS, windowsHide: true }
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new PdfUnavailableError(
          "LibreOffice was not found. Install it, or set SOFFICE_PATH in .env to the full path of soffice."
        );
      }
      throw error;
    }

    const pdfPath = path.join(workDir, "course-file.pdf");
    if (!fs.existsSync(pdfPath)) {
      throw new Error("LibreOffice did not produce a PDF.");
    }
    return await fs.promises.readFile(pdfPath);
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
}

// One conversion at a time: LibreOffice is heavy, and this keeps the server
// responsive when several coordinators export together.
let queue = Promise.resolve();

export function convertDocxToPdf(docxBuffer) {
  const job = queue.then(() => convertOnce(docxBuffer));
  queue = job.catch(() => {});
  return job;
}