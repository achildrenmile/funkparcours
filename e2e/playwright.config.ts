import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end happy path against the FULL stack (web served by the Fastify server +
 * Postgres). The stack is brought up externally — `docker compose up` in CI, or a
 * local server on :3000 — and its URL passed via E2E_BASE_URL.
 *
 * This suite is gated, not dark: it runs nightly / pre-release (not on every PR),
 * retries a flake once, and keeps a trace on failure for a human to review.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1, // a single flake retry; a second failure is real (human reviews the trace)
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
