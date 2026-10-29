import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.js"],
    setupFiles: ["tests/integration/setup.js"],
    // One shared database, so test files must run one after another.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
