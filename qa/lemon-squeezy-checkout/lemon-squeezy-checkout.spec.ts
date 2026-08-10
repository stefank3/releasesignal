import { expect, test } from "@playwright/test";
import {
  createLemonSqueezyCheckout,
  evaluateCheckoutEligibility,
  resolveCheckoutConfiguration,
  type LemonSqueezyEnvironment,
} from "../../lib/server/billing/lemonSqueezyCheckout";

const VALID_ENVIRONMENT: LemonSqueezyEnvironment = {
  runtimeStage: "dev",
  enabled: "true",
  mode: "test",
  storeId: "12345",
  variantId: "67890",
  apiKey: "test-api-key",
  appBaseUrl: "http://localhost:3000",
};

type HarnessOptions = {
  auth0Sub?: string;
  environment?: Partial<LemonSqueezyEnvironment>;
  memberships?: Array<{ organizationId: string }>;
  subscription?: { status: string; currentPeriodEnd: Date } | null;
  wallet?: { balance: number } | null;
  providerResponse?: Response;
  providerError?: Error;
};

function createHarness(options: HarnessOptions = {}) {
  const calls = {
    memberships: [] as string[],
    accountAccess: [] as string[],
    provider: [] as Array<{ input: string; init: RequestInit }>,
  };

  const run = () =>
    createLemonSqueezyCheckout({
      auth0Sub: options.auth0Sub === undefined ? "auth0|user-1" : options.auth0Sub,
      environment: { ...VALID_ENVIRONMENT, ...options.environment },
      dependencies: {
        findMemberships: async (auth0Sub) => {
          calls.memberships.push(auth0Sub);
          return options.memberships ?? [{ organizationId: "org-server" }];
        },
        checkoutEligible: async (organizationId) => {
          calls.accountAccess.push(organizationId);
          return evaluateCheckoutEligibility({
            organizationId,
            subscription:
              options.subscription === undefined
                ? { status: "trialing", currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z") }
                : options.subscription,
            wallet: options.wallet === undefined ? { balance: 100 } : options.wallet,
          }).ok;
        },
        fetchProvider: (async (input: URL | RequestInfo, init?: RequestInit) => {
          calls.provider.push({ input: String(input), init: init ?? {} });
          if (options.providerError) throw options.providerError;
          return (
            options.providerResponse ??
            new Response(
              JSON.stringify({ data: { attributes: { url: "https://example.lemonsqueezy.com/checkout/abc" } } }),
              { status: 201, headers: { "Content-Type": "application/json" } }
            )
          );
        }) as typeof fetch,
      },
    });

  return { calls, run };
}

function requestPayload(calls: ReturnType<typeof createHarness>["calls"]) {
  expect(calls.provider).toHaveLength(1);
  return JSON.parse(String(calls.provider[0].init.body));
}

test("unauthenticated requests return 401 before all prerequisites", async () => {
  const harness = createHarness({ auth0Sub: "" });
  await expect(harness.run()).resolves.toEqual({
    ok: false,
    status: 401,
    body: { error: "unauthenticated" },
  });
  expect(harness.calls.memberships).toHaveLength(0);
  expect(harness.calls.provider).toHaveLength(0);
});

test("kill switch accepts only true and blocks all disabled or malformed values", async () => {
  for (const enabled of [undefined, "", "false", "1", "0", "yes"]) {
    const harness = createHarness({ environment: { enabled } });
    expect((await harness.run()).status).toBe(503);
    expect(harness.calls.provider).toHaveLength(0);
  }

  const enabled = createHarness({ environment: { enabled: "TRUE" } });
  expect((await enabled.run()).status).toBe(200);
  expect(enabled.calls.provider).toHaveLength(1);
});

test("invalid environment and provider-mode combinations fail closed", async () => {
  for (const environment of [
    { runtimeStage: "dev", mode: "live" },
    { runtimeStage: "prod", mode: "test" },
    { runtimeStage: "prod", mode: "live" },
    { runtimeStage: "preview", mode: "test" },
    { runtimeStage: "unknown", mode: "test" },
  ]) {
    const harness = createHarness({ environment });
    expect((await harness.run()).status).toBe(503);
    expect(harness.calls.provider).toHaveLength(0);
  }
});

test("missing or malformed required provider configuration fails closed", async () => {
  for (const environment of [
    { storeId: undefined },
    { variantId: undefined },
    { apiKey: undefined },
    { storeId: "not-an-id" },
    { variantId: "0" },
  ]) {
    const harness = createHarness({ environment });
    expect((await harness.run()).status).toBe(503);
    expect(harness.calls.provider).toHaveLength(0);
  }
});

test("zero memberships returns 409 before account and provider calls", async () => {
  const harness = createHarness({ memberships: [] });
  expect((await harness.run()).status).toBe(409);
  expect(harness.calls.accountAccess).toHaveLength(0);
  expect(harness.calls.provider).toHaveLength(0);
});

test("multiple memberships returns support-required 409", async () => {
  const harness = createHarness({
    memberships: [{ organizationId: "org-1" }, { organizationId: "org-2" }],
  });
  await expect(harness.run()).resolves.toMatchObject({
    status: 409,
    body: { supportRequired: true },
  });
  expect(harness.calls.provider).toHaveLength(0);
});

test("missing wallet is a checkout-specific structural denial", async () => {
  const harness = createHarness({ wallet: null });
  expect((await harness.run()).status).toBe(403);
  expect(harness.calls.provider).toHaveLength(0);
});

test("active trial with positive credits can create checkout", async () => {
  const harness = createHarness({ wallet: { balance: 25 } });
  expect((await harness.run()).status).toBe(200);
  expect(harness.calls.accountAccess).toEqual(["org-server"]);
});

test("active trial with zero credits can create checkout", async () => {
  const harness = createHarness({ wallet: { balance: 0 } });
  expect((await harness.run()).status).toBe(200);
  expect(harness.calls.provider).toHaveLength(1);
});

test("expired trial can create checkout without trial mutation", async () => {
  const harness = createHarness({
    subscription: { status: "trialing", currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z") },
    wallet: { balance: 0 },
  });
  expect((await harness.run()).status).toBe(200);
  expect(harness.calls.provider).toHaveLength(1);
});

test("expired active subscription can create checkout to renew", async () => {
  const harness = createHarness({
    subscription: { status: "active", currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z") },
    wallet: { balance: 0 },
  });
  expect((await harness.run()).status).toBe(200);
  expect(harness.calls.provider).toHaveLength(1);
});

test("repository-supported inactive paid states remain purchase eligible", () => {
  for (const status of ["past_due", "canceled"]) {
    expect(
      evaluateCheckoutEligibility({
        organizationId: "org-server",
        subscription: { status, currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z") },
        wallet: { balance: 0 },
      })
    ).toEqual({ ok: true });
  }
});

test("missing subscription and unsupported states fail closed", async () => {
  for (const subscription of [
    null,
    { status: "unknown", currentPeriodEnd: new Date("2099-01-01T00:00:00.000Z") },
  ]) {
    const harness = createHarness({ subscription });
    expect((await harness.run()).status).toBe(403);
    expect(harness.calls.provider).toHaveLength(0);
  }
});

test("browser organization input cannot override the server membership", async () => {
  const harness = createHarness();
  await createLemonSqueezyCheckout({
    auth0Sub: "auth0|user-1",
    environment: VALID_ENVIRONMENT,
    dependencies: {
      findMemberships: async () => [{ organizationId: "org-server" }],
      checkoutEligible: async () => true,
      fetchProvider: (async (input: URL | RequestInfo, init?: RequestInit) => {
        harness.calls.provider.push({ input: String(input), init: init ?? {} });
        return new Response(
          JSON.stringify({ data: { attributes: { url: "https://example.lemonsqueezy.com/checkout/abc" } } }),
          { status: 201 }
        );
      }) as typeof fetch,
    },
    browserInput: { organizationId: "org-browser" },
  } as Parameters<typeof createLemonSqueezyCheckout>[0] & { browserInput: { organizationId: string } });
  expect(requestPayload(harness.calls).data.attributes.checkout_data.custom.organization_id).toBe("org-server");
});

test("browser variant input cannot override the configured variant", async () => {
  const harness = createHarness();
  await harness.run();
  const payload = requestPayload(harness.calls);
  expect(payload.data.relationships.variant.data.id).toBe("67890");
  expect(JSON.stringify(payload)).not.toContain("browser-variant");
});

test("provider payload uses the configured store relationship", async () => {
  const harness = createHarness();
  await harness.run();
  expect(requestPayload(harness.calls).data.relationships.store).toEqual({
    data: { type: "stores", id: "12345" },
  });
});

test("provider payload uses the configured variant relationship", async () => {
  const harness = createHarness();
  await harness.run();
  expect(requestPayload(harness.calls).data.relationships.variant).toEqual({
    data: { type: "variants", id: "67890" },
  });
});

test("enabled variants contains only the configured numeric variant", async () => {
  const harness = createHarness();
  await harness.run();
  expect(requestPayload(harness.calls).data.attributes.product_options.enabled_variants).toEqual([67890]);
});

test("custom metadata contains only server correlation fields", async () => {
  const harness = createHarness();
  await harness.run();
  expect(requestPayload(harness.calls).data.attributes.checkout_data.custom).toEqual({
    organization_id: "org-server",
    user_id: "auth0|user-1",
    plan_code: "standard_v1",
  });
});

test("trusted success and cancellation URLs derive from APP_BASE_URL", () => {
  const result = resolveCheckoutConfiguration(VALID_ENVIRONMENT);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.configuration.successUrl).toBe("http://localhost:3000/billing/checkout/success");
  expect(result.configuration.cancellationUrl).toBe("http://localhost:3000/billing/checkout/cancel");
});

test("untrusted or malformed origins fail before the provider call", async () => {
  for (const appBaseUrl of [
    "http://attacker.example",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/base-path",
    "https://example.com/?organizationId=attacker",
  ]) {
    const harness = createHarness({ environment: { appBaseUrl } });
    expect((await harness.run()).status).toBe(503);
    expect(harness.calls.provider).toHaveLength(0);
  }
});

test("provider request uses the documented endpoint, method, headers, and test mode", async () => {
  const harness = createHarness();
  await harness.run();
  const call = harness.calls.provider[0];
  expect(call.input).toBe("https://api.lemonsqueezy.com/v1/checkouts");
  expect(call.init.method).toBe("POST");
  expect(call.init.headers).toEqual({
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: "Bearer test-api-key",
  });
  expect(requestPayload(harness.calls).data.attributes.test_mode).toBe(true);
});

test("provider network and API failures return controlled 503 errors", async () => {
  const networkFailure = createHarness({ providerError: new Error("secret upstream detail") });
  expect(await networkFailure.run()).toEqual({
    ok: false,
    status: 503,
    body: { error: "checkout_unavailable" },
  });

  const apiFailure = createHarness({
    providerResponse: new Response("raw provider secret", { status: 422 }),
  });
  expect(await apiFailure.run()).toEqual({
    ok: false,
    status: 503,
    body: { error: "checkout_unavailable" },
  });
});

test("malformed provider responses return controlled 503 errors", async () => {
  for (const providerResponse of [
    new Response("not-json", { status: 201 }),
    new Response(JSON.stringify({ data: { attributes: {} } }), { status: 201 }),
    new Response(JSON.stringify({ data: { attributes: { url: "http://unsafe.example" } } }), { status: 201 }),
  ]) {
    const harness = createHarness({ providerResponse });
    expect((await harness.run()).status).toBe(503);
  }
});

test("valid provider response returns only the checkout URL and performs no local mutation", async () => {
  const harness = createHarness();
  await expect(harness.run()).resolves.toEqual({
    ok: true,
    status: 200,
    body: { checkoutUrl: "https://example.lemonsqueezy.com/checkout/abc" },
  });
  expect(harness.calls.memberships).toEqual(["auth0|user-1"]);
  expect(harness.calls.accountAccess).toEqual(["org-server"]);
  expect(harness.calls.provider).toHaveLength(1);
});
