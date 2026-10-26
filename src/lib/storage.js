import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";

// Two private folders, neither served directly. Every download goes through a
// permission check. Override with UPLOAD_DIR and GENERATED_DIR in .env.
const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads")
);
const GENERATED_DIR = path.resolve(
  process.env.GENERATED_DIR ?? path.join(process.cwd(), "storage", "generated")
);

// Refuses any path that would leave the storage folder.
function resolveSafe(baseDir, relativePath) {
  const full = path.resolve(baseDir, relativePath);
  if (!full.startsWith(baseDir + path.sep)) {
    throw new Error("Invalid storage path.");
  }
  return full;
}

async function save(baseDir, relativePath, buffer) {
  const full = resolveSafe(baseDir, relativePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer, { flag: "wx" }); // never overwrite
}

async function remove(baseDir, relativePath) {
  try {
    await unlink(resolveSafe(baseDir, relativePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// ----- Uploaded evidence files -----
export const saveFile = (relativePath, buffer) => save(UPLOADS_DIR, relativePath, buffer);
export const readStoredFile = async (relativePath) =>
  readFile(resolveSafe(UPLOADS_DIR, relativePath));
export const deleteStoredFile = (relativePath) => remove(UPLOADS_DIR, relativePath);

// ----- Official generated documents -----
export const saveGeneratedFile = (relativePath, buffer) =>
  save(GENERATED_DIR, relativePath, buffer);
export const readGeneratedFile = async (relativePath) =>
  readFile(resolveSafe(GENERATED_DIR, relativePath));
export const deleteGeneratedFile = (relativePath) => remove(GENERATED_DIR, relativePath);