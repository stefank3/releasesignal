import {
  LEMON_SQUEEZY_SUBSCRIPTION_EVENTS,
  type LemonSqueezySubscriptionEventName,
  type LemonSqueezySubscriptionStatus,
  type LemonSqueezyWebhookProtocolResult,
  type NormalizedLemonSqueezyProviderState,
  type VerifiedLemonSqueezySubscriptionEvent,
  type VerifyLemonSqueezyWebhookInput,
} from "./types";
import { sha256Hex, verifyLemonSqueezySignature } from "./crypto";

const EVENT_ALLOWLIST = new Set<string>(LEMON_SQUEEZY_SUBSCRIPTION_EVENTS);
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const ISO_8601_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

const PROVIDER_STATE_BY_STATUS = {
  on_trial: "unsupported_provider_trial",
  active: "current",
  paused: "collection_paused",
  past_due: "payment_at_risk",
  unpaid: "payment_unrecovered",
  cancelled: "ending_at_period_end",
  expired: "ended",
} as const satisfies Record<
  LemonSqueezySubscriptionStatus,
  NormalizedLemonSqueezyProviderState
>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function canonicalNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value === value.trim() ? value : null;
}

function positiveIntegerId(value: unknown): string | null {
  const normalized =
    typeof value === "number" && Number.isSafeInteger(value) ? String(value) : nonEmptyString(value);
  return normalized && POSITIVE_INTEGER_PATTERN.test(normalized) ? normalized : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = ISO_8601_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nullableIsoTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return isoTimestamp(value) ?? undefined;
}

function hasValidExpectedConfiguration(input: VerifyLemonSqueezyWebhookInput) {
  return Boolean(
    positiveIntegerId(input.expected.storeId) &&
      positiveIntegerId(input.expected.variantId) &&
      input.expected.planCode === "standard_v1" &&
      (input.expected.mode === "test" || input.expected.mode === "live")
  );
}

function rawBodyIsEmpty(rawBody: string | Uint8Array) {
  return typeof rawBody === "string" ? rawBody.length === 0 : rawBody.byteLength === 0;
}

function normalizeStatus(value: unknown):
  | {
      providerStatus: LemonSqueezySubscriptionStatus;
      normalizedProviderState: NormalizedLemonSqueezyProviderState;
    }
  | null {
  if (typeof value !== "string" || !Object.hasOwn(PROVIDER_STATE_BY_STATUS, value)) return null;
  const providerStatus = value as LemonSqueezySubscriptionStatus;
  return {
    providerStatus,
    normalizedProviderState: PROVIDER_STATE_BY_STATUS[providerStatus],
  };
}

export function verifyLemonSqueezySubscriptionWebhook(
  input: VerifyLemonSqueezyWebhookInput
): LemonSqueezyWebhookProtocolResult {
  if (!hasValidExpectedConfiguration(input)) {
    return { ok: false, reason: "configuration_error" };
  }
  if (rawBodyIsEmpty(input.rawBody)) return { ok: false, reason: "empty_body" };

  const signature = verifyLemonSqueezySignature({
    rawBody: input.rawBody,
    signature: input.signature,
    secret: input.webhookSecret,
  });
  if (!signature.ok) return signature;

  let payload: unknown;
  try {
    const json =
      typeof input.rawBody === "string"
        ? input.rawBody
        : new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody);
    payload = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (!isRecord(payload)) return { ok: false, reason: "invalid_structure" };
  const meta = payload.meta;
  const headerEventName = nonEmptyString(input.eventNameHeader);
  const bodyEventName = isRecord(meta) ? nonEmptyString(meta.event_name) : null;
  if (!headerEventName || !bodyEventName || headerEventName !== bodyEventName) {
    return { ok: false, reason: "event_mismatch" };
  }
  if (!EVENT_ALLOWLIST.has(headerEventName)) {
    return { ok: false, reason: "ignored_event" };
  }

  const data = payload.data;
  if (!isRecord(data)) return { ok: false, reason: "invalid_structure" };
  if (data.type !== "subscriptions") return { ok: false, reason: "invalid_object_type" };

  const providerSubscriptionId = positiveIntegerId(data.id);
  const attributes = data.attributes;
  if (!providerSubscriptionId || !isRecord(attributes)) {
    return { ok: false, reason: "invalid_structure" };
  }

  const providerCustomerId = positiveIntegerId(attributes.customer_id);
  const storeId = positiveIntegerId(attributes.store_id);
  const variantId = positiveIntegerId(attributes.variant_id);
  if (!providerCustomerId || !storeId || !variantId || typeof attributes.test_mode !== "boolean") {
    return { ok: false, reason: "invalid_structure" };
  }

  if (attributes.test_mode !== (input.expected.mode === "test")) {
    return { ok: false, reason: "mode_mismatch" };
  }
  if (storeId !== input.expected.storeId) return { ok: false, reason: "store_mismatch" };
  if (variantId !== input.expected.variantId) return { ok: false, reason: "variant_mismatch" };

  const status = normalizeStatus(attributes.status);
  if (!status) return { ok: false, reason: "unsupported_status" };

  const createdAt = isoTimestamp(attributes.created_at);
  const updatedAt = isoTimestamp(attributes.updated_at);
  const renewsAt = isoTimestamp(attributes.renews_at);
  const endsAt = nullableIsoTimestamp(attributes.ends_at);
  if (!createdAt || !updatedAt || !renewsAt || endsAt === undefined) {
    return { ok: false, reason: "invalid_structure" };
  }

  const customData = isRecord(meta) ? meta.custom_data : null;
  const organizationId = isRecord(customData)
    ? canonicalNonEmptyString(customData.organization_id)
    : null;
  const userId = isRecord(customData) ? canonicalNonEmptyString(customData.user_id) : null;
  const planCode = isRecord(customData) ? nonEmptyString(customData.plan_code) : null;
  if (!organizationId || !userId || planCode !== input.expected.planCode) {
    return { ok: false, reason: "invalid_metadata" };
  }

  const event: VerifiedLemonSqueezySubscriptionEvent = {
    eventName: headerEventName as LemonSqueezySubscriptionEventName,
    providerObjectType: "subscriptions",
    providerSubscriptionId,
    providerCustomerId,
    testMode: attributes.test_mode,
    storeId,
    variantId,
    providerStatus: status.providerStatus,
    normalizedProviderState: status.normalizedProviderState,
    organizationId,
    userId,
    planCode: input.expected.planCode,
    renewsAt,
    endsAt,
    providerCreatedAt: createdAt,
    providerUpdatedAt: updatedAt,
    payloadSha256: sha256Hex(input.rawBody),
  };

  return { ok: true, event };
}

export type {
  LemonSqueezyWebhookExpectedConfiguration,
  LemonSqueezyWebhookProtocolError,
  LemonSqueezyWebhookProtocolResult,
  NormalizedLemonSqueezyProviderState,
  VerifiedLemonSqueezySubscriptionEvent,
  VerifyLemonSqueezyWebhookInput,
} from "./types";

export { sha256Hex, verifyLemonSqueezySignature } from "./crypto";
