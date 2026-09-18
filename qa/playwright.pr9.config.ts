import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { randomUUID } from "node:crypto";

dotenv.config({ path: path.join(__dirname, ".env") });
// The teardown may stop only the fixture process belonging to this run.
process.env.PR9_FIXTURE_RUN_ID ??= randomUUID();

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  testMatch: ["pr8-reviews.spec.ts", "pr9-landing-reviews.spec.ts"],
  outputDir: path.join(__dirname, "test-results/pr9"),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalTeardown: path.join(__dirname, "helpers/pr9-review-fixture-server.mjs"),
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    storageState: { cookies: [], origins: [] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node helpers/pr9-review-fixture-server.mjs",
    cwd: __dirname,
    url: "http://127.0.0.1:3109/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
