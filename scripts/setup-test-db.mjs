import "dotenv/config";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: true });

const url = process.env.DATABASE_URL ?? "";
let name = "";
let host = "";
try {
  const parsed = new URL(url);
  name = parsed.pathname.replace(/^\//, "");
  host = parsed.hostname;
} catch {
  // handled below
}
if (!name.endsWith("_test") || !["localhost", "127.0.0.1"].includes(host)) {
  console.error(
    `Refusing to continue: .env.test must point to a local database whose name ends with _test (found "${name}" on "${host}").`
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(result.status ?? 1);
