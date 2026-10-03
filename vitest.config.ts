import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit suite: no database, no network. `npm test` runs this. */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
