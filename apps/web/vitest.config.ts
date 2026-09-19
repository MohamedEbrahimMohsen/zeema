import path from "node:path";
import { defineConfig } from "vitest/config";

// The app resolves "@/..." through tsconfig paths; vitest needs the same mapping, and the
// database-backed tests want longer than the default timeout to migrate an embedded Postgres.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
