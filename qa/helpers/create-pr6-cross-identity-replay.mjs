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
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validationOrigin() {
  const configured = new URL(requiredEnvironmentVariable("BASE_URL"));
  if (configured.protocol !== "https:") {
    throw new Error("BASE_URL must use HTTPS for the replay fixture.");
  }
  if (configured.username || configured.password || configured.search || configured.hash) {
    throw new Error("BASE_URL must not contain credentials, query parameters, or a fragment.");
  }
  return configured.origin;
}

function fixturePaths() {
  const directory = path.resolve(requiredEnvironmentVariable("PR6_REPLAY_FIXTURE_DIR"));
  if (isInside(repositoryRoot, directory)) {
    throw new Error("PR6_REPLAY_FIXTURE_DIR must be outside the repository.");
  }

  const storageState = path.join(directory, "identity-b.storage.json");
  const manifest = path.join(directory, "fixture.json");
  if (fs.existsSync(storageState) || fs.existsSync(manifest)) {
    throw new Error("Replay fixture files already exist; remove the external fixture files first.");
  }

  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return { directory, storageState, manifest };
}

function writePrivateJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.chmodSync(target, 0o600);
}

async function blockProvisioningRequests(context, origin, { blockChatDocument = false } = {}) {
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
      blockChatDocument &&
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

async function waitForAppLocation(page, origin, pathname) {
  await page.waitForURL(
    (url) => url.origin === origin && url.pathname === pathname,
    { timeout: AUTH_TIMEOUT_MS }
  );
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
  const domain = cookie.domain.startsWith(".") ? cookie.domain.slice(1) : cookie.domain;
  const expiresInFuture = cookie.expires === -1 || cookie.expires * 1000 > Date.now();

  if (
    !cookie.value ||
    !cookie.httpOnly ||
    !cookie.secure ||
    cookie.sameSite !== "Lax" ||
    cookie.path !== "/" ||
    cookie.domain.startsWith(".") ||
    domain !== hostname ||
    !expiresInFuture
  ) {
    throw new Error("Fixture creation failed: signup-intent cookie attributes were invalid.");
  }
}

async function createIdentityB(browser, origin, storageStatePath) {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  try {
    await blockProvisioningRequests(context, origin);
    const page = await context.newPage();

    process.stdout.write("Complete identity B direct Auth0 signup/login in the headed browser.\n");
    await page.goto(
      new URL("/auth/login?screen_hint=signup&returnTo=%2F", origin).toString(),
      { waitUntil: "domcontentloaded", timeout: AUTH_TIMEOUT_MS }
    );
    await waitForAppLocation(page, origin, "/");

    const profile = await context.request.get(new URL("/auth/profile", origin).toString());
    if (!profile.ok()) {
      throw new Error("Fixture creation failed: identity B did not establish an application session.");
    }

    const hasSignupIntent = (await context.cookies(origin)).some(
      (cookie) => cookie.name === SIGNUP_INTENT_COOKIE_NAME
    );
    if (hasSignupIntent) {
      throw new Error("Fixture creation failed: identity B unexpectedly has a signup-intent cookie.");
    }

    writePrivateJson(storageStatePath, await context.storageState());
  } finally {
    await context.close();
  }
}

async function createIdentityABoundIntent(browser, origin) {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  try {
    await blockProvisioningRequests(context, origin, { blockChatDocument: true });
    const page = await context.newPage();

    process.stdout.write("Complete identity A Start Trial signup in the headed browser.\n");
    const intentStartedAt = new Date().toISOString();
    await page.goto(new URL("/auth/start-trial", origin).toString(), {
      waitUntil: "domcontentloaded",
      timeout: AUTH_TIMEOUT_MS,
    });

    const cookie = await waitForSignupIntentCookie(context, origin);
    validateSignupIntentCookie(cookie, origin);
    return { value: cookie.value, createdAt: intentStartedAt };
  } finally {
    await context.close();
  }
}

async function main() {
  const origin = validationOrigin();
  const paths = fixturePaths();
  let storageStateCreated = false;
  const browser = await chromium.launch({ headless: false });

  try {
    await createIdentityB(browser, origin, paths.storageState);
    storageStateCreated = true;
    const boundIntent = await createIdentityABoundIntent(browser, origin);

    writePrivateJson(paths.manifest, {
      boundIntentCookie: boundIntent.value,
      crossIdentityStorageStatePath: paths.storageState,
      createdAt: boundIntent.createdAt,
      baseURL: origin,
    });

    process.stdout.write("Cross-identity replay fixture created. Run the isolated replay test promptly.\n");
  } catch {
    if (storageStateCreated && fs.existsSync(paths.storageState)) {
      fs.unlinkSync(paths.storageState);
    }
    process.stderr.write("Cross-identity replay fixture creation failed. No secret values were logged.\n");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
