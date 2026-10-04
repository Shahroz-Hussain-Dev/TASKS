import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      JWT_SECRET: "test-secret-test-secret-test-secret-test-secret",
      ADMIN_PASSWORD: "Admin12345!",
      AUTO_MIGRATE: "true",
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/raahi_test",
    },
  },
});
