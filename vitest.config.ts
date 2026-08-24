import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    root: ".",
    include: ["tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "./tests/__mocks__/server-only.ts"),
    },
  },
});
