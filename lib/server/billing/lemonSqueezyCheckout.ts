const CHECKOUT_ENDPOINT = "https://api.lemonsqueezy.com/v1/checkouts";
const PLAN_CODE = "standard_v1";

export type LemonSqueezyEnvironment = {
  runtimeStage: string;
  enabled: string | undefined;
  mode: string | undefined;
  storeId: string | undefined;
  variantId: string | undefined;
  apiKey: string | undefined;
  appBaseUrl: string | undefined;
};

type CheckoutConfiguration = {
  storeId: string;
  variantId: string;
  variantNumber: number;
  apiKey: string;
  successUrl: string;
  cancellationUrl: string;
};

type CheckoutFailure = {
  ok: false;
  status: 401 | 403 | 409 | 503;
  body: {
    error:
      | "unauthenticated"
      | "checkout_forbidden"
      | "checkout_conflict"
      | "checkout_unavailable";
    supportRequired?: true;
  };
};

type CheckoutSuccess = {
  ok: true;
  status: 200;
  body: { checkoutUrl: string };
};

export type CheckoutResult = CheckoutFailure | CheckoutSuccess;

export type CheckoutDependencies = {
  findMemberships: (auth0Sub: string) => Promise<Array<{ organizationId: string }>>;
  checkoutEligible: (organizationId: string) => Promise<boolean>;
  fetchProvider: typeof fetch;
};

export type CheckoutEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      reason: "organization_missing" | "subscription_missing" | "wallet_missing" | "unsupported_status";
    };

const CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

/**
 * Purchase eligibility is intentionally separate from AI-consumption access.
 * Existing or exhausted periods may need checkout to purchase or renew, while
 * missing provisioned account records and unknown lifecycle states fail closed.
 */
export function evaluateCheckoutEligibility(params: {
  organizationId: string | undefined;
  subscription: { status: string; currentPeriodEnd: Date } | null | undefined;
  wallet: { balance: number } | null | undefined;
}): CheckoutEligibilityResult {
  if (!params.organizationId) return { ok: false, reason: "organization_missing" };
  if (!params.subscription) return { ok: false, reason: "subscription_missing" };
  if (!params.wallet) return { ok: false, reason: "wallet_missing" };

  const status = params.subscription.status.trim().toLowerCase();
  if (!CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES.has(status)) {
    return { ok: false, reason: "unsupported_status" };
  }

  return { ok: true };
}

type ProviderPayload = {
  data: {
    type: "checkouts";
    attributes: {
      product_options: {
        redirect_url: string;
        enabled_variants: number[];
      };
      checkout_data: {
        custom: {
          organization_id: string;
          user_id: string;
          plan_code: typeof PLAN_CODE;
        };
      };
      test_mode: true;
    };
    relationships: {
      store: { data: { type: "stores"; id: string } };
      variant: { data: { type: "variants"; id: string } };
    };
  };
};

function unavailable(): CheckoutFailure {
  return { ok: false, status: 503, body: { error: "checkout_unavailable" } };
}

function parsePositiveIntegerId(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || !/^[1-9]\d*$/.test(normalized)) return null;

  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric)) return null;

  return { id: normalized, numeric };
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function resolveCheckoutConfiguration(
  environment: LemonSqueezyEnvironment
): { ok: true; configuration: CheckoutConfiguration } | { ok: false } {
  const enabled = environment.enabled?.trim().toLowerCase() ?? "false";
  if (enabled === "false") return { ok: false };
  if (enabled !== "true") return { ok: false };

  if (environment.runtimeStage !== "dev" || environment.mode?.trim().toLowerCase() !== "test") {
    return { ok: false };
  }

  const store = parsePositiveIntegerId(environment.storeId);
  const variant = parsePositiveIntegerId(environment.variantId);
  const apiKey = environment.apiKey?.trim();
  if (!store || !variant || !apiKey) return { ok: false };

  let origin: URL;
  try {
    origin = new URL(environment.appBaseUrl ?? "");
  } catch {
    return { ok: false };
  }

  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== "/" && origin.pathname !== "")
  ) {
    return { ok: false };
  }

  if (origin.protocol === "http:" && !isLocalHostname(origin.hostname)) return { ok: false };
  if (origin.protocol !== "http:" && origin.protocol !== "https:") return { ok: false };

  return {
    ok: true,
    configuration: {
      storeId: store.id,
      variantId: variant.id,
      variantNumber: variant.numeric,
      apiKey,
      successUrl: new URL("/billing/checkout/success", origin.origin).toString(),
      cancellationUrl: new URL("/billing/checkout/cancel", origin.origin).toString(),
    },
  };
}

export function buildCheckoutPayload(args: {
  configuration: CheckoutConfiguration;
  organizationId: string;
  auth0Sub: string;
}): ProviderPayload {
  return {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: args.configuration.successUrl,
          enabled_variants: [args.configuration.variantNumber],
        },
        checkout_data: {
          custom: {
            organization_id: args.organizationId,
            user_id: args.auth0Sub,
            plan_code: PLAN_CODE,
          },
        },
        test_mode: true,
      },
      relationships: {
        store: { data: { type: "stores", id: args.configuration.storeId } },
        variant: { data: { type: "variants", id: args.configuration.variantId } },
      },
    },
  };
}

function parseCheckoutUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;

  const attributes = (data as { attributes?: unknown }).attributes;
  if (!attributes || typeof attributes !== "object") return null;

  const value = (attributes as { url?: unknown }).url;
  if (typeof value !== "string") return null;

  try {
    const checkoutUrl = new URL(value);
    return checkoutUrl.protocol === "https:" ? checkoutUrl.toString() : null;
  } catch {
    return null;
  }
}

export async function createLemonSqueezyCheckout(args: {
  auth0Sub: string | undefined;
  environment: LemonSqueezyEnvironment;
  dependencies: CheckoutDependencies;
}): Promise<CheckoutResult> {
  if (!args.auth0Sub) {
    return { ok: false, status: 401, body: { error: "unauthenticated" } };
  }

  const resolved = resolveCheckoutConfiguration(args.environment);
  if (!resolved.ok) return unavailable();

  let memberships: Array<{ organizationId: string }>;
  try {
    memberships = await args.dependencies.findMemberships(args.auth0Sub);
  } catch {
    return unavailable();
  }

  if (memberships.length === 0) {
    return { ok: false, status: 409, body: { error: "checkout_conflict" } };
  }

  if (memberships.length !== 1) {
    return {
      ok: false,
      status: 409,
      body: { error: "checkout_conflict", supportRequired: true },
    };
  }

  const organizationId = memberships[0].organizationId;
  try {
    if (!(await args.dependencies.checkoutEligible(organizationId))) {
      return { ok: false, status: 403, body: { error: "checkout_forbidden" } };
    }
  } catch {
    return unavailable();
  }

  const payload = buildCheckoutPayload({
    configuration: resolved.configuration,
    organizationId,
    auth0Sub: args.auth0Sub,
  });

  let response: Response;
  try {
    response = await args.dependencies.fetchProvider(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${resolved.configuration.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return unavailable();
  }

  if (!response.ok) return unavailable();

  let providerPayload: unknown;
  try {
    providerPayload = await response.json();
  } catch {
    return unavailable();
  }

  const checkoutUrl = parseCheckoutUrl(providerPayload);
  if (!checkoutUrl) return unavailable();

  return { ok: true, status: 200, body: { checkoutUrl } };
}
