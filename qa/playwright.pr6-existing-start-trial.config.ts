import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const MAX_FIXTURE_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const repoRoot = path.resolve(__dirname, "..");

type ExistingStartTrialFixture = {
  existingStartTrialStorageStatePath: string;
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

function readExistingStartTrialFixture(): ExistingStartTrialFixture {
  const fixtureFile = path.resolve(
    requiredEnvironmentVariable("PR6_EXISTING_START_TRIAL_FIXTURE_FILE")
  );
  if (isInside(repoRoot, fixtureFile)) {
    throw new Error("PR6_EXISTING_START_TRIAL_FIXTURE_FILE must be outside the repository");
  }

  let fixture: unknown;
  try {
    fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
  } catch {
    throw new Error("Unable to read the external existing-user fixture file");
  }

  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new Error("The existing-user fixture has an invalid structure");
  }

  const record = fixture as Record<string, unknown>;
  const expectedKeys = ["baseURL", "createdAt", "existingStartTrialStorageStatePath"];
  if (Object.keys(record).sort().join("|") !== expectedKeys.join("|")) {
    throw new Error("The existing-user fixture contains unexpected fields");
  }

  if (
    typeof record.existingStartTrialStorageStatePath !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.baseURL !== "string"
  ) {
    throw new Error("The existing-user fixture contains invalid field values");
  }

  const storageStatePath = path.resolve(record.existingStartTrialStorageStatePath);
  if (isInside(repoRoot, storageStatePath) || !fs.existsSync(storageStatePath)) {
    throw new Error("The existing-user storage state must exist outside the repository");
  }

  const createdAt = Date.parse(record.createdAt);
  const age = Date.now() - createdAt;
  if (!Number.isFinite(createdAt) || age > MAX_FIXTURE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) {
    throw new Error("The existing-user fixture is stale or has an invalid creation time");
  }

  return {
    existingStartTrialStorageStatePath: storageStatePath,
    createdAt: record.createdAt,
    baseURL: record.baseURL,
  };
}

const baseURL = normalizedOrigin(requiredEnvironmentVariable("BASE_URL"), "BASE_URL");
requiredEnvironmentVariable("PR6_DATABASE_URL");
const fixture = readExistingStartTrialFixture();
if (normalizedOrigin(fixture.baseURL, "fixture baseURL") !== baseURL) {
  throw new Error("The existing-user fixture belongs to a different application origin");
}

process.env.PR6_EXISTING_START_TRIAL_AUTH_STATE =
  fixture.existingStartTrialStorageStatePath;

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  testMatch: /pr6-first-user-provisioning\.spec\.ts/,
  outputDir: path.join(__dirname, "test-results", "pr6-existing-start-trial"),
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
