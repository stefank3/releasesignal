import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SIGNUP_INTENT_COOKIE_NAME = "rs_beta_signup";
const MAX_FIXTURE_AGE_MS = 12 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const repoRoot = path.resolve(__dirname, "..");

type ChatRaceFixture = {
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

function readChatRaceFixture(): ChatRaceFixture {
  const fixtureFile = path.resolve(requiredEnvironmentVariable("PR6_CHAT_RACE_FIXTURE_FILE"));
  if (isInside(repoRoot, fixtureFile)) {
    throw new Error("PR6_CHAT_RACE_FIXTURE_FILE must be outside the repository");
  }

  let fixture: unknown;
  try {
    fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
  } catch {
    throw new Error("Unable to read the external PR6 chat-race fixture file");
  }

  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    throw new Error("The PR6 chat-race fixture has an invalid structure");
  }

  const record = fixture as Record<string, unknown>;
  const expectedKeys = ["baseURL", "concurrentSignupStorageStatePath", "createdAt"];
  if (Object.keys(record).sort().join("|") !== expectedKeys.join("|")) {
    throw new Error("The PR6 chat-race fixture contains unexpected fields");
  }

  if (
    typeof record.concurrentSignupStorageStatePath !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.baseURL !== "string"
  ) {
    throw new Error("The PR6 chat-race fixture contains invalid field values");
  }

  const storageStatePath = path.resolve(record.concurrentSignupStorageStatePath);
  if (isInside(repoRoot, storageStatePath) || !fs.existsSync(storageStatePath)) {
    throw new Error("The chat-race storage state must exist outside the repository");
  }

  const createdAt = Date.parse(record.createdAt);
  const age = Date.now() - createdAt;
  if (!Number.isFinite(createdAt) || age > MAX_FIXTURE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) {
    throw new Error("The PR6 chat-race fixture is stale or has an invalid creation time");
  }

  let storageState: unknown;
  try {
    storageState = JSON.parse(fs.readFileSync(storageStatePath, "utf8"));
  } catch {
    throw new Error("Unable to read the external chat-race storage state");
  }
  const cookies =
    storageState && typeof storageState === "object" && "cookies" in storageState
      ? (storageState as { cookies?: unknown }).cookies
      : null;
  if (!Array.isArray(cookies)) {
    throw new Error("The chat-race storage state has an invalid structure");
  }
  const signupIntentCookies = cookies.filter(
    (cookie): cookie is { name: string; expires?: number } =>
      Boolean(cookie) &&
      typeof cookie === "object" &&
      "name" in cookie &&
      (cookie as { name?: unknown }).name === SIGNUP_INTENT_COOKIE_NAME
  );
  if (
    signupIntentCookies.length !== 1 ||
    (typeof signupIntentCookies[0].expires === "number" &&
      signupIntentCookies[0].expires !== -1 &&
      signupIntentCookies[0].expires * 1000 <= Date.now())
  ) {
    throw new Error("The chat-race storage state lacks a valid bound signup intent");
  }

  return {
    concurrentSignupStorageStatePath: storageStatePath,
    createdAt: record.createdAt,
    baseURL: record.baseURL,
  };
}

const baseURL = normalizedOrigin(requiredEnvironmentVariable("BASE_URL"), "BASE_URL");
requiredEnvironmentVariable("PR6_DATABASE_URL");
if (requiredEnvironmentVariable("PR6_ENABLE_CHAT_RACE") !== "true") {
  throw new Error('PR6_ENABLE_CHAT_RACE must explicitly equal "true"');
}
const fixture = readChatRaceFixture();
if (normalizedOrigin(fixture.baseURL, "fixture baseURL") !== baseURL) {
  throw new Error("The PR6 chat-race fixture belongs to a different application origin");
}

process.env.PR6_CHAT_RACE_SIGNUP_AUTH_STATE = fixture.concurrentSignupStorageStatePath;

export default defineConfig({
  testDir: path.join(__dirname, "tests"),
  testMatch: /pr6-first-user-provisioning\.spec\.ts/,
  grep: /\/api\/me and \/api\/chat race still resolves one account/,
  outputDir: path.join(__dirname, "test-results", "pr6-chat-race"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: 1,
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
