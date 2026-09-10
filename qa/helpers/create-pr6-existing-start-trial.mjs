import { chromium } from "@playwright/test";
import { Client } from "pg";
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
    throw new Error("BASE_URL must use HTTPS for the existing-user fixture.");
  }
  if (configured.username || configured.password || configured.search || configured.hash) {
    throw new Error("BASE_URL must not contain credentials, query parameters, or a fragment.");
  }
  return configured.origin;
}

function fixturePaths() {
  const directory = path.resolve(
    requiredEnvironmentVariable("PR6_EXISTING_START_TRIAL_FIXTURE_DIR")
  );
  if (isInside(repositoryRoot, directory)) {
    throw new Error("PR6_EXISTING_START_TRIAL_FIXTURE_DIR must be outside the repository.");
  }

  const storageState = path.join(directory, "existing-start-trial.storage.json");
  const manifest = path.join(directory, "fixture.json");
  if (fs.existsSync(storageState) || fs.existsSync(manifest)) {
    throw new Error("Existing-user fixture files already exist; remove the external files first.");
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

async function getMe(context, origin) {
  const response = await context.request.get(new URL("/api/me", origin).toString());
  if (response.status() !== 200) {
    throw new Error("Fixture creation failed: the existing account was not available.");
  }
  return response.json();
}

function requireLockedTrialAccount(account) {
  if (
    account?.authenticated !== true ||
    account.isAdmin !== false ||
    typeof account.auth0Sub !== "string" ||
    !account.auth0Sub ||
    typeof account.organizationId !== "string" ||
    !account.organizationId ||
    account.planCode !== "trial_v1" ||
    account.planStatus !== "trialing" ||
    account.creditsRemaining !== 100 ||
    typeof account.currentPeriodStart !== "string" ||
    !account.currentPeriodStart ||
    typeof account.currentPeriodEnd !== "string" ||
    !account.currentPeriodEnd
  ) {
    throw new Error("Fixture creation failed: the baseline account is not the locked normal trial.");
  }
}

function requireSameAccount(before, after) {
  if (
    after?.authenticated !== true ||
    after.isAdmin !== false ||
    after.auth0Sub !== before.auth0Sub ||
    after.organizationId !== before.organizationId ||
    after.planCode !== before.planCode ||
    after.planStatus !== before.planStatus ||
    after.currentPeriodStart !== before.currentPeriodStart ||
    after.currentPeriodEnd !== before.currentPeriodEnd ||
    after.creditsRemaining !== before.creditsRemaining
  ) {
    throw new Error("Fixture creation failed: Start Trial did not preserve the existing account.");
  }
}

async function assertExactCardinality(databaseUrl, auth0Sub, organizationId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT
        (SELECT COUNT(DISTINCT o.id)::int FROM "Organization" o JOIN "OrgMember" m ON m."organizationId" = o.id WHERE m."auth0Sub" = $1) AS organizations,
        (SELECT COUNT(*)::int FROM "OrgMember" WHERE "auth0Sub" = $1) AS members,
        (SELECT COUNT(*)::int FROM "Subscription" WHERE "organizationId" = $2 AND "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
        (SELECT COUNT(*)::int FROM "CreditWallet" WHERE "organizationId" = $2 AND currency = 'credits') AS wallets,
        (SELECT COUNT(*)::int FROM "CreditLedger" l JOIN "CreditWallet" w ON w.id = l."walletId" WHERE w."organizationId" = $2 AND l.reason = 'trial_grant' AND l.delta = 100) AS grants`,
      [auth0Sub, organizationId]
    );
    const counts = result.rows[0];
    if (
      counts?.organizations !== 1 ||
      counts.members !== 1 ||
      counts.trials !== 1 ||
      counts.wallets !== 1 ||
      counts.grants !== 1
    ) {
      throw new Error("Fixture creation failed: existing-account cardinality is not exact.");
    }
  } finally {
    await client.end();
  }
}

async function blockPageProvisioningRequests(context, origin) {
  await context.route("**/*", async (route) => {
    let requested;
    try {
      requested = new URL(route.request().url());
    } catch {
      await route.continue();
      return;
    }

    if (
      requested.origin === origin &&
      (requested.pathname === "/api/me" || requested.pathname === "/api/chat")
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
  throw new Error("Fixture creation failed: signup-intent cleanup could not be exercised.");
}

async function waitForSignupIntentCleanup(context, origin) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const exists = (await context.cookies(origin)).some(
      (cookie) => cookie.name === SIGNUP_INTENT_COOKIE_NAME
    );
    if (!exists) return;
    await new Promise((resolve) => setTimeout(resolve, COOKIE_POLL_INTERVAL_MS));
  }
  throw new Error("Fixture creation failed: signup-intent cookie was not cleared.");
}

async function createFixture(browser, origin, databaseUrl, paths, diagnostics) {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    diagnostics.begin("ordinary Auth0 login");
    process.stdout.write("Complete ordinary login for the existing normal PR6 user.\n");
    await page.goto(new URL("/auth/login?returnTo=%2F", origin).toString(), {
      waitUntil: "domcontentloaded",
      timeout: AUTH_TIMEOUT_MS,
    });
    await page.waitForURL(
      (url) => url.origin === origin && url.pathname === "/",
      { timeout: AUTH_TIMEOUT_MS }
    );

    diagnostics.begin("Auth0 application session confirmation");
    const profile = await context.request.get(new URL("/auth/profile", origin).toString());
    if (!profile.ok()) {
      throw new Error("Fixture creation failed: no authenticated application session was established.");
    }
    diagnostics.complete(1, "Auth0 application session confirmed");

    diagnostics.begin("existing /api/me baseline confirmation");
    const before = await getMe(context, origin);
    requireLockedTrialAccount(before);
    diagnostics.complete(2, "Existing /api/me baseline confirmed");

    diagnostics.begin("baseline DB cardinality confirmation");
    await assertExactCardinality(databaseUrl, before.auth0Sub, before.organizationId);
    diagnostics.complete(3, "Baseline DB cardinality confirmed");

    await blockPageProvisioningRequests(context, origin);
    diagnostics.begin("Start Trial flow startup");
    process.stdout.write("Continue the existing user through Start Trial in the headed browser.\n");
    await page.goto(new URL("/auth/start-trial", origin).toString(), {
      waitUntil: "domcontentloaded",
      timeout: AUTH_TIMEOUT_MS,
    });
    diagnostics.complete(4, "Start Trial flow started");

    diagnostics.begin("Auth0 callback completion");
    await waitForSignupIntentCookie(context, origin);
    diagnostics.complete(5, "Auth0 callback completed");
    diagnostics.begin("signup-intent cookie observation");
    diagnostics.complete(6, "Signup-intent cookie observed");

    diagnostics.begin("existing account resolution and cookie cleanup");
    const after = await getMe(context, origin);
    requireSameAccount(before, after);
    await waitForSignupIntentCleanup(context, origin);
    diagnostics.complete(7, "Existing account resolved and cookie cleared");

    diagnostics.begin("post-resolution DB cardinality confirmation");
    await assertExactCardinality(databaseUrl, after.auth0Sub, after.organizationId);
    diagnostics.complete(8, "Post-resolution DB cardinality confirmed");

    const hasSignupIntent = (await context.cookies(origin)).some(
      (cookie) => cookie.name === SIGNUP_INTENT_COOKIE_NAME
    );
    if (hasSignupIntent) {
      throw new Error("Fixture creation failed: signup-intent cookie remained before state capture.");
    }

    writePrivateJson(paths.storageState, await context.storageState());
    writePrivateJson(paths.manifest, {
      existingStartTrialStorageStatePath: paths.storageState,
      createdAt: new Date().toISOString(),
      baseURL: origin,
    });
  } finally {
    await context.close();
  }
}

async function main() {
  let activeStage = "environment validation";
  let paths;
  let browser;
  const diagnostics = {
    begin(stage) {
      activeStage = stage;
    },
    complete(number, message) {
      process.stdout.write(`[${number}/8] ${message}\n`);
    },
  };

  try {
    const origin = validationOrigin();
    const databaseUrl = requiredEnvironmentVariable("PR6_DATABASE_URL");
    paths = fixturePaths();
    diagnostics.begin("headed Chromium launch");
    browser = await chromium.launch({ headless: false });
    await createFixture(browser, origin, databaseUrl, paths, diagnostics);
    process.stdout.write("Existing-user Start Trial fixture created.\n");
  } catch {
    if (paths) {
      for (const target of [paths.storageState, paths.manifest]) {
        try {
          if (fs.existsSync(target)) fs.unlinkSync(target);
        } catch {
          // Keep diagnostics secret-free even if partial-file cleanup fails.
        }
      }
    }
    process.stderr.write(`Existing-user fixture creation failed at stage: ${activeStage}\n`);
    process.exitCode = 1;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Do not replace the sanitized stage result with browser shutdown details.
      }
    }
  }
}

await main();
