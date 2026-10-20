import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";

// Private storage folder. It is never served directly; every download goes
// through a permission check. Override with UPLOAD_DIR in .env if needed.
const BASE_DIR = path.resolve(
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads")
);

// Refuses any path that would leave the storage folder.
function resolveSafe(relativePath) {
  const full = path.resolve(BASE_DIR, relativePath);
  if (!full.startsWith(BASE_DIR + path.sep)) {
    throw new Error("Invalid storage path.");
  }
  return full;
}

export async function saveFile(relativePath, buffer) {
  const full = resolveSafe(relativePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer, { flag: "wx" }); // never overwrite
}

export function readStoredFile(relativePath) {
  return readFile(resolveSafe(relativePath));
}

export async function deleteStoredFile(relativePath) {
  try {
    await unlink(resolveSafe(relativePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}