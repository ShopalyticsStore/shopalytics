import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Database suite: seeds the real fixture into a throwaway schema on the
 * database named by `SHOPALYTICS_TEST_DATABASE_URL`. It is a separate command
 * (`npm run test:db`) because it needs that connection; it never uses mocks.
 */
export default defineConfig({
  test: {
    include: ["tests/database/**/*.test.ts"],
    environment: "node",
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
