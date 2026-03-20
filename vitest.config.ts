import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@anchor/core": path.resolve(__dirname, "packages/core/dist/index.js"),
      "@anchor/storage-sqlite": path.resolve(
        __dirname,
        "packages/storage-sqlite/dist/index.js"
      ),
      "@anchor/artifact-store-local": path.resolve(
        __dirname,
        "packages/artifact-store-local/dist/index.js"
      ),
      "@anchor/workflow": path.resolve(
        __dirname,
        "packages/workflow/dist/index.js"
      ),
      "@anchor/adapter-codex": path.resolve(
        __dirname,
        "packages/adapter-codex/dist/index.js"
      ),
      "@anchor/adapter-claude": path.resolve(
        __dirname,
        "packages/adapter-claude/dist/index.js"
      ),
      "@anchor/installer": path.resolve(
        __dirname,
        "packages/installer/dist/index.js"
      )
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts"]
  }
});
