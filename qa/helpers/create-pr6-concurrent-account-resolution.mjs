import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIGNUP_INTENT_COOKIE_NAME = "rs_beta_signup";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
const COOKIE_POLL_INTERVAL_MS = 250;

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, "../..");

function requiredEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validationOrigin() {
  const configured = new URL(requiredEnvironmentVariable("BASE_URL"));
  if (configured.protocol !== "https:") {
    throw new Error("BASE_URL must use HTTPS for the concurrency fixture.");
  }
  if (configured.username || configured.password || configured.search || configured.hash) {
    throw new Error("BASE_URL must not contain credentials, query parameters, or a fragment.");
  }
  return configured.origin;
}

function fixturePaths() {
  const directory = path.resolve(requiredEnvironmentVariable("PR6_CONCURRENT_FIXTURE_DIR"));
  if (isInside(repositoryRoot, directory)) {
    throw new Error("PR6_CONCURRENT_FIXTURE_DIR must be outside the repository.");
  }

  const storageState = path.join(directory, "concurrent-signup.storage.json");
  const manifest = path.join(directory, "fixture.json");
  if (fs.existsSync(storageState) || fs.existsSync(manifest)) {
    throw new Error("Concurrency fixture files already exist; remove the external files first.");
  }

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return { storageState, manifest };
}

function writePrivateJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(target, 0o600);
}

async function blockProvisioningRequests(context, origin) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    let requested;
    try {
      requested = new URL(request.url());
    } catch {
      await route.continue();
      return;
    }

    if (requested.origin !== origin) {
      await route.continue();
      return;
    }

    if (requested.pathname === "/api/me" || requested.pathname === "/api/chat") {
      await route.abort("blockedbyclient");
      return;
    }

    if (
      requested.pathname === "/chat" &&
      request.isNavigationRequest() &&
      request.resourceType() === "document"
    ) {
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });
}

async function waitForSignupIntentCookie(context, origin) {
  const deadline = Date.now() + AUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const matching = (await context.cookies(origin)).filter(
      (cookie) => cookie.name === SIGNUP_INTENT_COOKIE_NAME
    );
    if (matching.length === 1) return matching[0];
    if (matching.length > 1) {
      throw new Error("Fixture creation failed: multiple signup-intent cookies were observed.");
    }
    await new Promise((resolve) => setTimeout(resolve, COOKIE_POLL_INTERVAL_MS));
  }
  throw new Error("Fixture creation failed: bound signup-intent cookie was not observed.");
}

function validateSignupIntentCookie(cookie, origin) {
  const hostname = new URL(origin).hostname;
  const expiresInFuture = cookie.expires === -1 || cookie.expires * 1000 > Date.now();

  if (
    !cookie.value ||
    !cookie.httpOnly ||
    !cookie.secure ||
    cookie.sameSite !== "Lax" ||
    cookie.path !== "/" ||
    cookie.domain.startsWith(".") ||
    cookie.domain !== hostname ||
    !expiresInFuture
  ) {
    throw new Error("Fixture creation failed: signup-intent cookie attributes were invalid.");
  }
}

async function createFixture(browser, origin, paths) {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  try {
    await blockProvisioningRequests(context, origin);
    const page = await context.newPage();
    const createdAt = new Date().toISOString();

    process.stdout.write("Complete the new-user Start Trial signup in the headed browser.\n");
    await page.goto(new URL("/auth/start-trial", origin).toString(), {
      waitUntil: "domcontentloaded",
      timeout: AUTH_TIMEOUT_MS,
    });

    const signupIntentCookie = await waitForSignupIntentCookie(context, origin);
    validateSignupIntentCookie(signupIntentCookie, origin);

    const profile = await context.request.get(new URL("/auth/profile", origin).toString());
    if (!profile.ok()) {
      throw new Error("Fixture creation failed: no authenticated application session was established.");
    }

    const state = await context.storageState();
    const savedIntentCookie = state.cookies.find(
      (cookie) => cookie.name === SIGNUP_INTENT_COOKIE_NAME
    );
    if (!savedIntentCookie || savedIntentCookie.value !== signupIntentCookie.value) {
      throw new Error("Fixture creation failed: storage state did not retain the bound intent.");
    }

    writePrivateJson(paths.storageState, state);
    writePrivateJson(paths.manifest, {
      concurrentSignupStorageStatePath: paths.storageState,
      createdAt,
      baseURL: origin,
    });
  } finally {
    await context.close();
  }
}

async function main() {
  const origin = validationOrigin();
  const paths = fixturePaths();
  const browser = await chromium.launch({ headless: false });

  try {
    await createFixture(browser, origin, paths);
    process.stdout.write("Concurrent account-resolution fixture created. Run its test promptly.\n");
  } catch {
    for (const target of [paths.storageState, paths.manifest]) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    process.stderr.write("Concurrency fixture creation failed. No secret values were logged.\n");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
