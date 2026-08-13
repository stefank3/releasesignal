export const LEMON_SQUEEZY_SUBSCRIPTION_EVENTS = [
  "subscription_created",
  "subscription_updated",
] as const;

export type LemonSqueezySubscriptionEventName =
  (typeof LEMON_SQUEEZY_SUBSCRIPTION_EVENTS)[number];

export const LEMON_SQUEEZY_SUBSCRIPTION_STATUSES = [
  "on_trial",
  "active",
  "paused",
  "past_due",
  "unpaid",
  "cancelled",
  "expired",
] as const;

export type LemonSqueezySubscriptionStatus =
  (typeof LEMON_SQUEEZY_SUBSCRIPTION_STATUSES)[number];

export type NormalizedLemonSqueezyProviderState =
  | "unsupported_provider_trial"
  | "current"
  | "collection_paused"
  | "payment_at_risk"
  | "payment_unrecovered"
  | "ending_at_period_end"
  | "ended";

export type LemonSqueezyWebhookExpectedConfiguration = {
  mode: "test" | "live";
  storeId: string;
  variantId: string;
  planCode: "standard_v1";
};

export type VerifiedLemonSqueezySubscriptionEvent = {
  eventName: LemonSqueezySubscriptionEventName;
  providerObjectType: "subscriptions";
  providerSubscriptionId: string;
  providerCustomerId: string;
  testMode: boolean;
  storeId: string;
  variantId: string;
  providerStatus: LemonSqueezySubscriptionStatus;
  normalizedProviderState: NormalizedLemonSqueezyProviderState;
  organizationId: string;
  userId: string;
  planCode: "standard_v1";
  renewsAt: string;
  endsAt: string | null;
  providerCreatedAt: string;
  providerUpdatedAt: string;
  payloadSha256: string;
};

export type LemonSqueezyWebhookProtocolError =
  | "configuration_error"
  | "signature_missing"
  | "signature_malformed"
  | "signature_invalid"
  | "empty_body"
  | "invalid_json"
  | "event_mismatch"
  | "ignored_event"
  | "invalid_object_type"
  | "invalid_structure"
  | "unsupported_status"
  | "mode_mismatch"
  | "store_mismatch"
  | "variant_mismatch"
  | "invalid_metadata";

export type LemonSqueezyWebhookProtocolResult =
  | { ok: true; event: VerifiedLemonSqueezySubscriptionEvent }
  | { ok: false; reason: LemonSqueezyWebhookProtocolError };

export type VerifyLemonSqueezyWebhookInput = {
  /**
   * The exact untouched webhook request bytes must be supplied.
   * Do not reconstruct this value with JSON.stringify() after parsing.
   * Prefer Uint8Array at the future ingress boundary.
   */
  rawBody: string | Uint8Array;
  signature: string | null | undefined;
  eventNameHeader: string | null | undefined;
  webhookSecret: string | null | undefined;
  expected: LemonSqueezyWebhookExpectedConfiguration;
};
