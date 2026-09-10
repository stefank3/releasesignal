import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const MAX_FIXTURE_AGE_MS = 12 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const repoRoot = path.resolve(__dirname, "..");

type ConcurrentFixture = {
  concurrentSignupStorageStatePath: string;
  createdAt: string;
  baseURL: string;
};

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizedOrigin(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return parsed.origin;
}

function readConcurrentFixture(): ConcurrentFixture {
  const fixtureFile = path.resolve(requiredEnvironmentVariable("PR6_CONCURRENT_FIXTURE_FILE"));
  if (isInside(repoRoot, fixtureFile)) {
    throw new Error("PR6_CONCURRENT_FIXTURE_FILE must be outside the repository");
  }

  let fixture: unknown;
  try {
    fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
  } catch {
    throw new Error("Unable to read the external PR6 concurrency fixture file");
  }

  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new Error("The PR6 concurrency fixture has an invalid structure");
  }

  const record = fixture as Record<string, unknown>;
  const expectedKeys = ["baseURL", "concurrentSignupStorageStatePath", "createdAt"];
  if (Object.keys(record).sort().join("|") !== expectedKeys.join("|")) {
    throw new Error("The PR6 concurrency fixture contains unexpected fields");
  }

  if (
    typeof record.concurrentSignupStorageStatePath !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.baseURL !== "string"
  ) {
    throw new Error("The PR6 concurrency fixture contains invalid field values");
  }

  const storageStatePath = path.resolve(record.concurrentSignupStorageStatePath);
  if (isInside(repoRoot, storageStatePath) || !fs.existsSync(storageStatePath)) {
    throw new Error("The concurrency storage state must exist outside the repository");
  }

  const createdAt = Date.parse(record.createdAt);
  const age = Date.now() - createdAt;
  if (!Number.isFinite(createdAt) || age > MAX_FIXTURE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) {
    throw new Error("The PR6 concurrency fixture is stale or has an invalid creation time");
  }

  return {
    concurrentSignupStorageStatePath: storageStatePath,
    createdAt: record.createdAt,
    baseURL: record.baseURL,
  };
}

const baseURL = normalizedOrigin(requiredEnvironmentVariable("BASE_URL"), "BASE_URL");
requiredEnvironmentVariable("PR6_DATABASE_URL");
const fixture = readConcurrentFixture();
if (normalizedOrigin(fixture.baseURL, "fixture baseURL") !== baseURL) {
  throw new Error("The PR6 concurrency fixture belongs to a different application origin");
}

process.env.PR6_CONCURRENT_SIGNUP_AUTH_STATE = fixture.concurrentSignupStorageStatePath;

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  testMatch: /pr6-first-user-provisioning\.spec\.ts/,
  outputDir: path.join(__dirname, "test-results", "pr6-concurrent"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
