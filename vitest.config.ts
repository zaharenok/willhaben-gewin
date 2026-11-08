import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^webextension-polyfill$/,
        replacement: fileURLToPath(new URL("./tests/mocks/webextension-polyfill.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
