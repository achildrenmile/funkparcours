import { defineConfig } from "vitest/config";

// Server integration tests hit a real Postgres (CI service container, or a local
// throwaway on :5433). They share one DB, so run serially — no parallel files.
export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-please",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://funk:funk@localhost:5432/funkparcours",
    },
  },
});
