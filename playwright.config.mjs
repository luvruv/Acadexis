import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The browser tests run the app against the TEST database only.
const parsed = dotenv.config({ path: ".env.test", override: true, quiet: true }).parsed ?? {};
let dbName = "";
let host = "";
try {
  const url = new URL(parsed.DATABASE_URL ?? "");
  dbName = url.pathname.replace(/^\//, "");
  host = url.hostname;
} catch {
  // handled below
}
if (!dbName.endsWith("_test") || !["localhost", "127.0.0.1"].includes(host)) {
  throw new Error(
    `E2E tests refused to start: .env.test must point to a local database whose name ends with _test (found "${dbName}" on "${host}").`
  );
}

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.mjs",
  globalSetup: "./tests/e2e/global-setup.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: parsed.DATABASE_URL,
      AUTH_TRUST_HOST: "true",
    },
  },
});
