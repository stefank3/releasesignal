// lib/ai/schemas/capability.ts
// M13 bounded capability foundation:
// - define the minimal provider-neutral capability contract layer
// - keep capability execution typed, bounded, and fail-closed
// - keep persisted truth, workflow truth, scoring, and release health system-owned
// - support initial M13 capabilities without introducing a generalized agent platform

import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";

/**
 * M13 bounded capabilities allowed at this stage.
 *
 * Keep this intentionally narrow.
 * New capabilities should be added only when they fit the locked roadmap
 * and do not weaken deterministic ownership boundaries.
 */
export type AICapabilityName =
  | "requirement_clarifier"
  | "review_explanation";

/**
 * Capability execution state.
 *
 * - success: capability produced usable output
 * - rejected: capability was refused by local validation / gating
 * - failed_closed: capability returned ambiguous, invalid, or low-confidence output
 */
export type AICapabilityStatus =
  | "success"
  | "rejected"
  | "failed_closed";

/**
 * Confidence is represented coarsely on purpose.
 * M13 does not need false precision here.
 */
export type AICapabilityConfidence = "high" | "medium" | "low" | "unknown";

/**
 * Minimal telemetry envelope for capability execution.
 *
 * Every capability execution must be traceable.
 * The gateway may enrich this later, but these are the minimum fields the
 * bounded capability layer should always be able to carry.
 */
export type AICapabilityTelemetry = {
  capability: AICapabilityName;
  status: AICapabilityStatus;
  provider: string;
  model: string | null;
  latencyMs: number | null;
  confidence: AICapabilityConfidence;
  parseSucceeded: boolean;
  validationSucceeded: boolean;
  persisted: false;
  failureReason?: string;
};

/**
 * Shared request envelope for bounded AI capability execution.
 *
 * Important boundary:
 * This request describes AI assistance work only.
 * It does not authorize the AI layer to own persisted truth, workflow state,
 * deterministic scoring, or release decisions.
 */
export type AICapabilityRequest<TInput> = {
  capability: AICapabilityName;
  input: TInput;
  sessionId?: string;
  messages: AIChatMessage[];
};

/**
 * Success result for a bounded capability.
 *
 * output is still not system truth by itself.
 * It must be parsed / validated by downstream system logic before any
 * persistence or user-visible authoritative state transition happens.
 */
export type AICapabilitySuccess<TOutput> = {
  ok: true;
  status: "success";
  capability: AICapabilityName;
  output: TOutput;
  rawReply: string;
  confidence: AICapabilityConfidence;
  telemetry: AICapabilityTelemetry;
};

/**
 * Non-success result for bounded capability execution.
 *
 * rejected:
 * - local gating / prerequisites / unsupported capability state
 *
 * failed_closed:
 * - model output was ambiguous
 * - parsing failed
 * - validation failed
 * - confidence was too weak for safe use
 *
 * In both cases the capability layer must not produce persisted truth.
 */
export type AICapabilityFailure = {
  ok: false;
  status: Exclude<AICapabilityStatus, "success">;
  capability: AICapabilityName;
  reason: string;
  rawReply: string | null;
  confidence: AICapabilityConfidence;
  telemetry: AICapabilityTelemetry;
};

export type AICapabilityResult<TOutput> =
  | AICapabilitySuccess<TOutput>
  | AICapabilityFailure;

/**
 * Initial M13 capability input contracts.
 *
 * Keep them intentionally focused and bounded.
 */

export type RequirementClarifierInput = {
  userMessage: string;
  existingRequirementText?: string | null;
  artifactContextText?: string | null;
};

export type ReviewExplanationInput = {
  reviewSummaryText: string;
  reviewScore: number;
  verdict: string;
  riskGaps: string[];
  improvements: string[];
  artifactContextText?: string | null;
};

/**
 * Initial M13 capability output contracts.
 *
 * These outputs are AI assistance artifacts only.
 * They are not authoritative persisted truth until system validation accepts them.
 */

export type RequirementClarifierOutput = {
  clarifiedRequirementText: string;
};

export type ReviewExplanationOutput = {
  explanationText: string;
};

/**
 * Capability-specific request/result aliases.
 */

export type RequirementClarifierRequest =
  AICapabilityRequest<RequirementClarifierInput>;

export type ReviewExplanationRequest =
  AICapabilityRequest<ReviewExplanationInput>;

export type RequirementClarifierResult =
  AICapabilityResult<RequirementClarifierOutput>;

export type ReviewExplanationResult =
  AICapabilityResult<ReviewExplanationOutput>;