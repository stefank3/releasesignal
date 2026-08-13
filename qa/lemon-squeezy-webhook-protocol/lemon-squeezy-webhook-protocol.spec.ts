import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  sha256Hex,
  verifyLemonSqueezySubscriptionWebhook,
  type LemonSqueezyWebhookExpectedConfiguration,
  type VerifyLemonSqueezyWebhookInput,
} from "../../lib/server/billing/lemonSqueezyWebhook/protocol";

const SECRET = "qa-webhook-secret";
const EXPECTED = {
  mode: "test",
  storeId: "12345",
  variantId: "67890",
  planCode: "standard_v1",
} as const satisfies LemonSqueezyWebhookExpectedConfiguration;

type PayloadOptions = {
  eventName?: string;
  dataType?: string;
  dataId?: unknown;
  attributes?: Record<string, unknown>;
  customData?: Record<string, unknown> | null;
  omitMeta?: boolean;
  omitEventName?: boolean;
};

function payload(options: PayloadOptions = {}) {
  const attributes = {
    customer_id: 24680,
    store_id: 12345,
    variant_id: 67890,
    status: "active",
    test_mode: true,
    renews_at: "2026-09-01T12:00:00.000Z",
    ends_at: null,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-12T11:00:00.000Z",
    ...options.attributes,
  };
  const customData =
    options.customData === undefined
      ? { organization_id: "org_qa", user_id: "user_qa", plan_code: "standard_v1" }
      : options.customData;
  const meta = options.omitMeta
    ? undefined
    : {
        ...(options.omitEventName ? {} : { event_name: options.eventName ?? "subscription_created" }),
        custom_data: customData,
      };

  return {
    ...(meta === undefined ? {} : { meta }),
    data: {
      type: options.dataType ?? "subscriptions",
      id: options.dataId === undefined ? "13579" : options.dataId,
      attributes,
    },
  };
}

function sign(rawBody: string | Uint8Array, secret = SECRET) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function verify(
  rawBody: string | Uint8Array,
  overrides: Partial<Omit<VerifyLemonSqueezyWebhookInput, "rawBody">> = {}
) {
  return verifyLemonSqueezySubscriptionWebhook({
    rawBody,
    signature: sign(rawBody),
    eventNameHeader: "subscription_created",
    webhookSecret: SECRET,
    expected: EXPECTED,
    ...overrides,
  });
}

function expectFailure(
  result: ReturnType<typeof verifyLemonSqueezySubscriptionWebhook>,
  reason: string
) {
  expect(result).toEqual({ ok: false, reason });
}

test("accepts a valid HMAC-SHA256 signature over the untouched raw body", () => {
  const rawBody = JSON.stringify(payload());
  expect(verify(rawBody).ok).toBe(true);
});

test("classifies missing and empty signatures", () => {
  const rawBody = JSON.stringify(payload());
  for (const signature of [null, undefined, ""]) {
    expectFailure(verify(rawBody, { signature }), "signature_missing");
  }
});

test("rejects non-hex and wrong-length signatures without throwing", () => {
  const rawBody = JSON.stringify(payload());
  for (const signature of ["z".repeat(64), "a".repeat(63), "a".repeat(66)]) {
    expect(() => verify(rawBody, { signature })).not.toThrow();
    expectFailure(verify(rawBody, { signature }), "signature_malformed");
  }
});

test("rejects a valid-length incorrect signature", () => {
  const rawBody = JSON.stringify(payload());
  expectFailure(verify(rawBody, { signature: "0".repeat(64) }), "signature_invalid");
});

test("rejects a body changed after signing", () => {
  const rawBody = JSON.stringify(payload());
  const changedBody = rawBody.replace("org_qa", "org_qb");
  expectFailure(verify(changedBody, { signature: sign(rawBody) }), "signature_invalid");
});

test("rejects a whitespace byte change after signing", () => {
  const rawBody = JSON.stringify(payload());
  expectFailure(verify(`${rawBody}\n`, { signature: sign(rawBody) }), "signature_invalid");
});

test("requires a non-empty webhook secret", () => {
  const rawBody = JSON.stringify(payload());
  for (const webhookSecret of [null, undefined, "", "   "]) {
    expectFailure(verify(rawBody, { webhookSecret }), "configuration_error");
  }
});

test("rejects an empty body", () => {
  expectFailure(verify("", { signature: sign("") }), "empty_body");
});

test("does not parse and reserialize before signature verification", () => {
  const rawBody = JSON.stringify(payload(), null, 2);
  const reserialized = JSON.stringify(JSON.parse(rawBody));
  expect(verify(rawBody).ok).toBe(true);
  expectFailure(verify(reserialized, { signature: sign(rawBody) }), "signature_invalid");
});

test("accepts Uint8Array input without changing its bytes", () => {
  const rawBody = new TextEncoder().encode(JSON.stringify(payload()));
  expect(verify(rawBody).ok).toBe(true);
});

test("produces verified artifacts for both accepted event names", () => {
  for (const eventName of ["subscription_created", "subscription_updated"] as const) {
    const rawBody = JSON.stringify(payload({ eventName }));
    const result = verify(rawBody, { eventNameHeader: eventName });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event).toMatchObject({
        eventName,
        providerObjectType: "subscriptions",
        providerSubscriptionId: "13579",
        providerCustomerId: "24680",
        testMode: true,
        storeId: "12345",
        variantId: "67890",
        organizationId: "org_qa",
        userId: "user_qa",
        planCode: "standard_v1",
        renewsAt: "2026-09-01T12:00:00.000Z",
        endsAt: null,
        providerCreatedAt: "2026-08-01T10:00:00.000Z",
        providerUpdatedAt: "2026-08-12T11:00:00.000Z",
      });
      expect(Object.keys(result.event).sort()).toEqual(
        [
          "endsAt",
          "eventName",
          "normalizedProviderState",
          "organizationId",
          "payloadSha256",
          "planCode",
          "providerCreatedAt",
          "providerCustomerId",
          "providerObjectType",
          "providerStatus",
          "providerSubscriptionId",
          "providerUpdatedAt",
          "renewsAt",
          "storeId",
          "testMode",
          "userId",
          "variantId",
        ].sort()
      );
    }
  }
});

test("rejects invalid JSON after successful signature verification", () => {
  const rawBody = "{not-json";
  expectFailure(verify(rawBody), "invalid_json");
});

test("requires both event-name sources and exact equality", () => {
  const cases = [
    { body: payload({ omitMeta: true }), header: "subscription_created" },
    { body: payload({ omitEventName: true }), header: "subscription_created" },
    { body: payload(), header: null },
    { body: payload(), header: undefined },
    { body: payload(), header: "subscription_updated" },
    { body: payload(), header: "Subscription_Created" },
  ];
  for (const item of cases) {
    const rawBody = JSON.stringify(item.body);
    expectFailure(verify(rawBody, { eventNameHeader: item.header }), "event_mismatch");
  }
});

test("classifies a correctly signed non-allowlisted event as ignored", () => {
  const rawBody = JSON.stringify({ meta: { event_name: "order_created" } });
  expectFailure(verify(rawBody, { eventNameHeader: "order_created" }), "ignored_event");
});

test("requires the subscriptions object type", () => {
  const rawBody = JSON.stringify(payload({ dataType: "orders" }));
  expectFailure(verify(rawBody), "invalid_object_type");
});

test("requires a positive provider subscription ID", () => {
  for (const dataId of [null, "", "0", "event_123", -1]) {
    const rawBody = JSON.stringify(payload({ dataId }));
    expectFailure(verify(rawBody), "invalid_structure");
  }
});

test("rejects malformed required provider attributes and timestamps", () => {
  const malformedAttributes = [
    { customer_id: null },
    { store_id: "not-an-id" },
    { variant_id: 0 },
    { test_mode: "true" },
    { created_at: "not-a-date" },
    { updated_at: null },
    { renews_at: "" },
    { ends_at: "invalid-date" },
  ];
  for (const attributes of malformedAttributes) {
    const rawBody = JSON.stringify(payload({ attributes }));
    expectFailure(verify(rawBody), "invalid_structure");
  }
});

test("accepts only timezone-qualified ISO timestamps and normalizes them to UTC", () => {
  const cases = [
    { input: "2026-08-01T10:00:00Z", expected: "2026-08-01T10:00:00.000Z" },
    { input: "2026-08-01T10:00:00.123Z", expected: "2026-08-01T10:00:00.123Z" },
    { input: "2026-08-01T10:00:00+02:00", expected: "2026-08-01T08:00:00.000Z" },
  ];
  for (const item of cases) {
    const rawBody = JSON.stringify(payload({ attributes: { created_at: item.input } }));
    const result = verify(rawBody);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.providerCreatedAt).toBe(item.expected);
  }
});

test("rejects timezone-less, informal, and malformed timestamps", () => {
  const invalidTimestamps = [
    "2026",
    "2026-08-01",
    "Dec 25 2026",
    "08/01/2026",
    "2026-08-01T10:00:00",
    "2026-02-30T10:00:00Z",
    "2026-08-01T10:00:00+24:00",
    "not-a-date",
  ];
  for (const created_at of invalidTimestamps) {
    const rawBody = JSON.stringify(payload({ attributes: { created_at } }));
    expectFailure(verify(rawBody), "invalid_structure");
  }
});

test("validates server-owned mode, store, and variant configuration", () => {
  const rawBody = JSON.stringify(payload());
  expect(verify(rawBody).ok).toBe(true);
  expectFailure(
    verify(rawBody, { expected: { ...EXPECTED, mode: "live" } }),
    "mode_mismatch"
  );
  expectFailure(
    verify(rawBody, { expected: { ...EXPECTED, storeId: "54321" } }),
    "store_mismatch"
  );
  expectFailure(
    verify(rawBody, { expected: { ...EXPECTED, variantId: "9876" } }),
    "variant_mismatch"
  );
});

test("accepts a correctly configured live-mode event", () => {
  const rawBody = JSON.stringify(payload({ attributes: { test_mode: false } }));
  expect(verify(rawBody, { expected: { ...EXPECTED, mode: "live" } }).ok).toBe(true);
});

test("fails closed for invalid server-owned expected configuration", () => {
  const rawBody = JSON.stringify(payload());
  for (const expected of [
    { ...EXPECTED, storeId: "" },
    { ...EXPECTED, variantId: "0" },
  ]) {
    expectFailure(verify(rawBody, { expected }), "configuration_error");
  }
});

test("requires valid standard_v1 organization, user, and plan metadata", () => {
  const invalidMetadata = [
    { organization_id: "org_qa", user_id: "user_qa" },
    { organization_id: "org_qa", user_id: "user_qa", plan_code: "premium_v1" },
    { user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa", plan_code: "standard_v1" },
    { organization_id: " ", user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa", user_id: " ", plan_code: "standard_v1" },
    { organization_id: 123, user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa", user_id: 456, plan_code: "standard_v1" },
  ];
  for (const customData of invalidMetadata) {
    const rawBody = JSON.stringify(payload({ customData }));
    expectFailure(verify(rawBody), "invalid_metadata");
  }
});

test("rejects padded organization and user correlation metadata", () => {
  const invalidMetadata = [
    { organization_id: " org_qa", user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa ", user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: " org_qa ", user_id: "user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa", user_id: " user_qa", plan_code: "standard_v1" },
    { organization_id: "org_qa", user_id: "user_qa ", plan_code: "standard_v1" },
    { organization_id: "org_qa", user_id: " user_qa ", plan_code: "standard_v1" },
  ];
  for (const customData of invalidMetadata) {
    const rawBody = JSON.stringify(payload({ customData }));
    expectFailure(verify(rawBody), "invalid_metadata");
  }
});

test("normalizes every recognized provider status as a provider fact", () => {
  const mappings = {
    on_trial: "unsupported_provider_trial",
    active: "current",
    paused: "collection_paused",
    past_due: "payment_at_risk",
    unpaid: "payment_unrecovered",
    cancelled: "ending_at_period_end",
    expired: "ended",
  } as const;
  for (const [providerStatus, normalizedProviderState] of Object.entries(mappings)) {
    const rawBody = JSON.stringify(payload({ attributes: { status: providerStatus } }));
    const result = verify(rawBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event).toMatchObject({ providerStatus, normalizedProviderState });
      expect(normalizedProviderState).not.toMatch(/entitlement|access|credit/i);
    }
  }
});

test("fails closed for an unknown provider status", () => {
  const rawBody = JSON.stringify(payload({ attributes: { status: "unknown" } }));
  expectFailure(verify(rawBody), "unsupported_status");
});

test("fails closed for prototype-chain provider status keys", () => {
  for (const status of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
    const rawBody = JSON.stringify(payload({ attributes: { status } }));
    expectFailure(verify(rawBody), "unsupported_status");
  }
});

test("fingerprints exact raw bytes deterministically with SHA-256", () => {
  const first = JSON.stringify(payload());
  const second = `${first} `;
  expect(sha256Hex(first)).toBe(sha256Hex(first));
  expect(sha256Hex(first)).not.toBe(sha256Hex(second));
  expect(sha256Hex(first)).toMatch(/^[a-f0-9]{64}$/);
  const result = verify(first);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.event.payloadSha256).toBe(sha256Hex(first));
});

test("protocol implementation has no persistence, network, auth, or browser-state boundary", () => {
  const implementationDir = path.resolve(
    __dirname,
    "../../lib/server/billing/lemonSqueezyWebhook"
  );
  const source = ["types.ts", "crypto.ts", "protocol.ts"]
    .map((file) => readFileSync(path.join(implementationDir, file), "utf8"))
    .join("\n");
  const forbidden = [
    /from\s+["']@\/lib\/prisma["']/i,
    /\bPrismaClient\b/,
    /\bCreditWallet\b/,
    /\bCreditLedger\b/,
    /\bensureOrgForUser\b/,
    /\baccountAccess\b/,
    /\bfetch\s*\(/,
    /from\s+["']next\/headers["']/,
    /\bcookies\s*\(/,
    /\bAuth0\b/i,
    /\bprocess\.env\b/,
    /\bprisma\s*\./i,
    /\b(?:subscription|creditWallet|creditLedger)\s*\.\s*(?:create|update|upsert|delete|deleteMany|updateMany)\s*\(/i,
  ];
  for (const pattern of forbidden) expect(source).not.toMatch(pattern);
});
