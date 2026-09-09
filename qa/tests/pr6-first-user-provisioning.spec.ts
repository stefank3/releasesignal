import { expect, test, type Browser } from "@playwright/test";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const baseURL = process.env.BASE_URL || "http://localhost:3000";

type MeBody = {
  authenticated?: boolean;
  auth0Sub?: string;
  isAdmin?: boolean;
  organizationId?: string;
  planCode?: string | null;
  planStatus?: string | null;
  creditsRemaining?: number;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  error?: string;
};

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function storageStatePath(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

async function authenticatedContext(browser: Browser, envName: string) {
  const storageState = storageStatePath(envName);
  test.skip(!storageState || !fs.existsSync(storageState), `${envName} is not configured`);
  return browser.newContext({ baseURL, storageState: storageState! });
}

async function getMe(context: Awaited<ReturnType<Browser["newContext"]>>) {
  const response = await context.request.get(new URL("/api/me", baseURL).toString());
  return { status: response.status(), body: (await response.json()) as MeBody };
}

test.describe("PR6 static security contract", () => {
  test("marketing Start Trial uses only the Release Signal route", () => {
    const marketing = source("app/components/marketing/marketingContent.ts");
    expect(marketing).toMatch(/betaTrialHref\s*=\s*"\/auth\/start-trial"/);
    expect(marketing).toContain('signInHref = "/auth/login?returnTo=%2Fchat"');
    expect(marketing).not.toContain("/auth/login?screen_hint=signup");
  });

  test("Start Trial creates server state before starting Auth0 signup", () => {
    const route = source("app/auth/start-trial/route.ts");
    expect(route.indexOf("createPendingSignupIntent()")).toBeLessThan(
      route.indexOf("auth0.startInteractiveLogin")
    );
    expect(route).toContain('screen_hint: "signup"');
    expect(route).toContain("buildSignupIntentCallbackMarker(nonce)");
    expect(route).toContain('error: "account_provisioning_unavailable"');
  });

  test("Start Trial enforces the shared route rate limit before creating an intent", () => {
    const route = source("app/auth/start-trial/route.ts");
    const policies = source("lib/ratelimit.ts");
    const enforcement = source("lib/server/rateLimit.ts");

    expect(route).toContain("enforceRouteRateLimit({");
    expect(route).toContain('policy: "startTrial"');
    expect(route).toContain("if (!rateLimit.ok)");
    expect(route).toContain("return rateLimit.response");
    expect(route.indexOf("enforceRouteRateLimit({")).toBeLessThan(
      route.indexOf("createPendingSignupIntent()")
    );
    expect(route.indexOf("return rateLimit.response")).toBeLessThan(
      route.indexOf("createPendingSignupIntent()")
    );
    expect(policies).toContain("startTrial: {");
    expect(policies).toContain('prefix: `${env.REDIS_PREFIX}ratelimit:start-trial`');
    expect(enforcement).toContain(
      "startTrial: createSlidingWindowRatelimit(ROUTE_RATE_LIMITS.startTrial)"
    );
  });

  test("intent state is short-lived, purpose-bound, random, and product-truth free", () => {
    const intent = source("lib/auth/signupIntent.ts");
    expect(intent).toContain("crypto.getRandomValues(new Uint8Array(32))");
    expect(intent).toContain('crypto.subtle.digest("SHA-256"');
    expect(intent).toContain("15 * 60");
    expect(intent).toContain('const INTENT_PURPOSE = "beta_signup"');
    expect(intent).toContain('key(`auth:signup-intent:${INTENT_KEY_VERSION}:${nonceHash}`)');
    expect(intent).toContain('"KEEPTTL"');
    expect(intent).toContain('redis.call("TTL", KEYS[1])');
    expect(intent).toContain("current == ARGV[1]");
    expect(intent).toContain('redis.call("DEL", KEYS[1])');
    expect(intent).not.toMatch(/credits|trialDays|planCode|organizationId|isAuth0Admin/);
    expect(intent).not.toMatch(/console\.|\blog\s*\(/);
  });

  test("Auth0 callback binds identity and never provisions", () => {
    const auth0 = source("lib/auth0.ts");
    expect(auth0).toContain("onCallback:");
    expect(auth0).toContain("bindSignupIntentToSubject(signupIntentNonce, auth0Sub)");
    expect(auth0).toContain('NextResponse.redirect(new URL("/chat", env.APP_BASE_URL))');
    expect(auth0).toContain("SIGNUP_INTENT_COOKIE_NAME");
    expect(auth0).not.toContain("ensureOrgForUser");
  });

  test("Auth0 callback explicitly guards returnTo to the application origin", () => {
    const auth0 = source("lib/auth0.ts");

    expect(auth0).toContain("function resolveSameOriginReturnTo(returnTo?: string): URL");
    expect(auth0).toContain("const resolved = new URL(returnTo, appBaseUrl)");
    expect(auth0).toContain("resolved.origin === appBaseUrl.origin ? resolved : fallback");
    expect(auth0).toContain(
      "NextResponse.redirect(resolveSameOriginReturnTo(ctx.returnTo))"
    );
  });

  test("all production provisioning callers use the shared resolver", () => {
    const me = source("app/api/me/route.ts");
    const guards = source("lib/server/chat/requestGuards.ts");
    const resolver = source("lib/billing/resolveOrgForUser.ts");
    const provisioning = source("lib/billing/ensureOrgForUser.ts");

    expect(me).toContain("resolveOrgForUser(");
    expect(guards).toContain("resolveOrgForUser(");
    expect(me).not.toContain("ensureOrgForUser(");
    expect(guards).not.toContain("ensureOrgForUser(");
    expect(resolver).toContain("ensureOrgForUser(params)");
    expect(provisioning).toContain("export async function ensureOrgForUser(");
  });

  test("existing membership is checked before Redis authorization and consumption follows provisioning", () => {
    const resolver = source("lib/billing/resolveOrgForUser.ts");
    expect(resolver.indexOf("const member = await prisma.orgMember.findFirst")).toBeLessThan(
      resolver.indexOf("const validation = await validateBoundSignupIntent")
    );
    expect(resolver.indexOf("const orgState = await ensureOrgForUser(params)")).toBeLessThan(
      resolver.indexOf("await consumeBoundSignupIntent")
    );
  });

  test("locked beta provisioning constants remain unchanged", () => {
    const provisioning = source("lib/billing/ensureOrgForUser.ts");
    expect(provisioning).toContain("const TRIAL_DURATION_DAYS = 15");
    expect(provisioning).toContain("const TRIAL_STARTING_CREDITS = 100");
    expect(provisioning).toContain('const TRIAL_PLAN_CODE = "trial_v1"');
    expect(provisioning).toContain('const TRIAL_STATUS = "trialing"');
    expect(provisioning).toContain("const TRIAL_SEATS = 1");
  });
});

test.describe("PR6 live authorization", () => {
  test("new identity without intent is rejected by /api/me and /api/chat", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_UNPROVISIONED_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(403);
    expect(me.body).toMatchObject({ authenticated: true, error: "account_not_provisioned" });

    const chat = await context.request.post(new URL("/api/chat", baseURL).toString(), {
      data: { mode: "coach", message: "PR6 unauthorized provisioning check" },
    });
    const chatBody = await chat.json();
    expect(chat.status()).toBe(403);
    expect(chatBody).toMatchObject({ ok: false, reason: "account_not_provisioned" });
    expect(chatBody).not.toHaveProperty("creditsCharged");
    expect(chatBody).not.toHaveProperty("sessionId");
    await context.close();
  });

  test("tampered or random transport nonce is rejected", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_UNPROVISIONED_AUTH_STATE");
    await context.addCookies([
      {
        name: "rs_beta_signup",
        value: "A".repeat(43),
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        secure: baseURL.startsWith("https://"),
      },
    ]);
    expect((await getMe(context)).status).toBe(403);
    await context.close();
  });

  test("expired intent is rejected", async ({ browser }) => {
    const expiredNonce = process.env.PR6_EXPIRED_INTENT_COOKIE?.trim();
    test.skip(!expiredNonce, "PR6_EXPIRED_INTENT_COOKIE is not configured");
    const context = await authenticatedContext(browser, "PR6_UNPROVISIONED_AUTH_STATE");
    await context.addCookies([
      {
        name: "rs_beta_signup",
        value: expiredNonce!,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        secure: baseURL.startsWith("https://"),
      },
    ]);
    expect((await getMe(context)).status).toBe(403);
    await context.close();
  });

  test("identity-bound intent cannot be replayed by another identity", async ({ browser }) => {
    const boundNonce = process.env.PR6_BOUND_INTENT_COOKIE?.trim();
    test.skip(!boundNonce, "PR6_BOUND_INTENT_COOKIE is not configured");
    const context = await authenticatedContext(browser, "PR6_CROSS_IDENTITY_AUTH_STATE");
    await context.addCookies([
      {
        name: "rs_beta_signup",
        value: boundNonce!,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        secure: baseURL.startsWith("https://"),
      },
    ]);
    const replay = await getMe(context);
    expect(replay.status).toBe(403);
    expect(replay.body).toMatchObject({
      authenticated: true,
      error: "account_not_provisioned",
    });

    await context.clearCookies({ name: "rs_beta_signup" });
    const withoutReplayCookie = await getMe(context);
    expect(withoutReplayCookie.status).toBe(403);
    expect(withoutReplayCookie.body).toMatchObject({
      authenticated: true,
      error: "account_not_provisioned",
    });
    await context.close();
  });

  test("existing user signs in repeatedly without a new entitlement", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_EXISTING_AUTH_STATE");
    const first = await getMe(context);
    const second = await getMe(context);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.organizationId).toBe(first.body.organizationId);
    expect(second.body.planCode).toBe(first.body.planCode);
    expect(second.body.creditsRemaining).toBe(first.body.creditsRemaining);
    await context.close();
  });

  test("valid new signup creates exactly one locked beta entitlement", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_VALID_SIGNUP_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      authenticated: true,
      isAdmin: false,
      planCode: "trial_v1",
      planStatus: "trialing",
      creditsRemaining: 100,
    });

    const start = Date.parse(me.body.currentPeriodStart!);
    const end = Date.parse(me.body.currentPeriodEnd!);
    expect(end - start).toBe(15 * 24 * 60 * 60 * 1000);
    await context.close();
  });

  test("valid signup persistence has exact entitlement cardinality", async ({ browser }) => {
    const databaseUrl = process.env.PR6_DATABASE_URL?.trim();
    test.skip(!databaseUrl, "PR6_DATABASE_URL is required for cardinality assertions");
    const context = await authenticatedContext(browser, "PR6_VALID_SIGNUP_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(200);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const result = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM "OrgMember" WHERE "auth0Sub" = $1) AS members,
          (SELECT COUNT(*)::int FROM "Subscription" WHERE "organizationId" = $2 AND "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
          (SELECT COUNT(*)::int FROM "CreditWallet" WHERE "organizationId" = $2 AND currency = 'credits') AS wallets,
          (SELECT COUNT(*)::int FROM "CreditLedger" l JOIN "CreditWallet" w ON w.id = l."walletId" WHERE w."organizationId" = $2 AND l.reason = 'trial_grant' AND l.delta = 100) AS grants`,
        [me.body.auth0Sub, me.body.organizationId]
      );
      expect(result.rows[0]).toEqual({ members: 1, trials: 1, wallets: 1, grants: 1 });
    } finally {
      await client.end();
    }
    await context.close();
  });

  test("concurrent account resolution yields one organization", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_CONCURRENT_SIGNUP_AUTH_STATE");
    try {
      const [first, second] = await Promise.all([getMe(context), getMe(context)]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.organizationId).toEqual(expect.any(String));
      expect(first.body.organizationId).not.toBe("");
      expect(second.body.organizationId).toBe(first.body.organizationId);
      expect(first.body.auth0Sub).toEqual(expect.any(String));
      expect(first.body.auth0Sub).not.toBe("");
      expect(second.body.auth0Sub).toBe(first.body.auth0Sub);
      expect(first.body.creditsRemaining).toBe(100);
      expect(second.body.creditsRemaining).toBe(100);

      const databaseUrl = process.env.PR6_DATABASE_URL?.trim();
      expect(databaseUrl, "PR6_DATABASE_URL is required for concurrency cardinality").toBeTruthy();
      const client = new Client({ connectionString: databaseUrl! });
      await client.connect();
      try {
        const result = await client.query(
          `SELECT
            (SELECT COUNT(DISTINCT o.id)::int FROM "Organization" o JOIN "OrgMember" m ON m."organizationId" = o.id WHERE m."auth0Sub" = $1) AS organizations,
            (SELECT COUNT(*)::int FROM "OrgMember" WHERE "auth0Sub" = $1) AS members,
            (SELECT COUNT(*)::int FROM "Subscription" WHERE "organizationId" = $2 AND "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
            (SELECT COUNT(*)::int FROM "CreditWallet" WHERE "organizationId" = $2 AND currency = 'credits') AS wallets,
            (SELECT COUNT(*)::int FROM "CreditLedger" l JOIN "CreditWallet" w ON w.id = l."walletId" WHERE w."organizationId" = $2 AND l.reason = 'trial_grant' AND l.delta = 100) AS grants`,
          [first.body.auth0Sub, first.body.organizationId]
        );
        expect(result.rows[0]).toEqual({
          organizations: 1,
          members: 1,
          trials: 1,
          wallets: 1,
          grants: 1,
        });
      } finally {
        await client.end();
      }
    } finally {
      await context.close();
    }
  });

  test("/api/me and /api/chat race still resolves one account", async ({ browser }) => {
    test.skip(
      process.env.PR6_ENABLE_CHAT_RACE !== "true",
      "PR6_ENABLE_CHAT_RACE=true is required because this check invokes the AI provider"
    );
    const context = await authenticatedContext(browser, "PR6_CHAT_RACE_SIGNUP_AUTH_STATE");
    try {
      const [me, chat] = await Promise.all([
        getMe(context),
        context.request.post(new URL("/api/chat", baseURL).toString(), {
          data: { mode: "coach", message: "PR6 provisioning concurrency check" },
          timeout: 45_000,
        }),
      ]);
      expect(me.status).toBe(200);
      expect(chat.status()).toBe(200);
      expect((await chat.json()).ok).toBe(true);
      expect(me.body.auth0Sub).toEqual(expect.any(String));
      expect(me.body.auth0Sub).not.toBe("");
      expect(me.body.organizationId).toEqual(expect.any(String));
      expect(me.body.organizationId).not.toBe("");

      const after = await getMe(context);
      expect(after.status).toBe(200);
      expect(after.body.auth0Sub).toBe(me.body.auth0Sub);
      expect(after.body.organizationId).toBe(me.body.organizationId);

      const databaseUrl = process.env.PR6_DATABASE_URL?.trim();
      expect(databaseUrl, "PR6_DATABASE_URL is required for chat-race cardinality").toBeTruthy();
      const client = new Client({ connectionString: databaseUrl! });
      await client.connect();
      try {
        const result = await client.query(
          `SELECT
            (SELECT COUNT(DISTINCT o.id)::int FROM "Organization" o JOIN "OrgMember" m ON m."organizationId" = o.id WHERE m."auth0Sub" = $1) AS organizations,
            (SELECT COUNT(*)::int FROM "OrgMember" WHERE "auth0Sub" = $1) AS members,
            (SELECT COUNT(*)::int FROM "Subscription" WHERE "organizationId" = $2 AND "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
            (SELECT COUNT(*)::int FROM "CreditWallet" WHERE "organizationId" = $2 AND currency = 'credits') AS wallets,
            (SELECT COUNT(*)::int FROM "CreditLedger" l JOIN "CreditWallet" w ON w.id = l."walletId" WHERE w."organizationId" = $2 AND l.reason = 'trial_grant' AND l.delta = 100) AS grants`,
          [me.body.auth0Sub, me.body.organizationId]
        );
        expect(result.rows[0]).toEqual({
          organizations: 1,
          members: 1,
          trials: 1,
          wallets: 1,
          grants: 1,
        });
      } finally {
        await client.end();
      }
    } finally {
      await context.close();
    }
  });

  test("existing user Start Trial callback reuses account and clears intent", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_EXISTING_START_TRIAL_AUTH_STATE");
    try {
      const first = await getMe(context);
      const second = await getMe(context);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body).toMatchObject({
        authenticated: true,
        isAdmin: false,
        planCode: "trial_v1",
        planStatus: "trialing",
        creditsRemaining: 100,
      });
      expect(first.body.auth0Sub).toEqual(expect.any(String));
      expect(first.body.auth0Sub).not.toBe("");
      expect(second.body.auth0Sub).toBe(first.body.auth0Sub);
      expect(first.body.organizationId).toEqual(expect.any(String));
      expect(first.body.organizationId).not.toBe("");
      expect(second.body.organizationId).toBe(first.body.organizationId);
      expect(second.body.planCode).toBe(first.body.planCode);
      expect(second.body.planStatus).toBe(first.body.planStatus);
      expect(second.body.currentPeriodStart).toBe(first.body.currentPeriodStart);
      expect(second.body.currentPeriodEnd).toBe(first.body.currentPeriodEnd);
      expect(second.body.creditsRemaining).toBe(first.body.creditsRemaining);
      expect((await context.cookies()).some((cookie) => cookie.name === "rs_beta_signup")).toBe(false);

      const databaseUrl = process.env.PR6_DATABASE_URL?.trim();
      expect(databaseUrl, "PR6_DATABASE_URL is required for existing-user cardinality").toBeTruthy();
      const client = new Client({ connectionString: databaseUrl! });
      await client.connect();
      try {
        const result = await client.query(
          `SELECT
            (SELECT COUNT(DISTINCT o.id)::int FROM "Organization" o JOIN "OrgMember" m ON m."organizationId" = o.id WHERE m."auth0Sub" = $1) AS organizations,
            (SELECT COUNT(*)::int FROM "OrgMember" WHERE "auth0Sub" = $1) AS members,
            (SELECT COUNT(*)::int FROM "Subscription" WHERE "organizationId" = $2 AND "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
            (SELECT COUNT(*)::int FROM "CreditWallet" WHERE "organizationId" = $2 AND currency = 'credits') AS wallets,
            (SELECT COUNT(*)::int FROM "CreditLedger" l JOIN "CreditWallet" w ON w.id = l."walletId" WHERE w."organizationId" = $2 AND l.reason = 'trial_grant' AND l.delta = 100) AS grants`,
          [first.body.auth0Sub, first.body.organizationId]
        );
        expect(result.rows[0]).toEqual({
          organizations: 1,
          members: 1,
          trials: 1,
          wallets: 1,
          grants: 1,
        });
      } finally {
        await client.end();
      }
    } finally {
      await context.close();
    }
  });

  test("bound intent remains usable after a rolled-back provisioning attempt", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_RETRY_SIGNUP_AUTH_STATE");
    const firstSuccessfulRetry = await getMe(context);
    const duplicate = await getMe(context);
    expect(firstSuccessfulRetry.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.organizationId).toBe(firstSuccessfulRetry.body.organizationId);
    expect(duplicate.body.creditsRemaining).toBe(100);
    await context.close();
  });

  test("existing admin remains available without intent", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_EXISTING_ADMIN_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(200);
    expect(me.body.isAdmin).toBe(true);
    await context.close();
  });

  test("new admin without intent is rejected", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_NEW_ADMIN_NO_INTENT_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(403);
    expect(me.body.error).toBe("account_not_provisioned");
    await context.close();
  });

  test("new admin with intent uses the existing zero-credit admin branch", async ({ browser }) => {
    const context = await authenticatedContext(browser, "PR6_NEW_ADMIN_VALID_SIGNUP_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      authenticated: true,
      isAdmin: true,
      planCode: null,
      planStatus: null,
      creditsRemaining: 0,
    });
    await context.close();
  });

  test("Redis unavailability fails closed for a new identity", async ({ browser }) => {
    test.fixme(
      true,
      "Deferred: an isolated Redis-failure harness is required to induce and verify an actual outage"
    );
    const context = await authenticatedContext(browser, "PR6_REDIS_UNAVAILABLE_AUTH_STATE");
    const me = await getMe(context);
    expect(me.status).toBe(503);
    expect(me.body.error).toBe("account_provisioning_unavailable");
    await context.close();
  });
});
