// lib/ai/gateway/aiGateway.ts
// M13 bounded capability foundation:
// - add a minimal AI gateway for bounded capability execution
// - keep provider execution behind the provider adapter boundary
// - return typed success / fail-closed capability results
// - keep persisted truth, workflow truth, deterministic scoring, and release health outside this layer
// - keep implementation intentionally narrow; this is not a generalized agent runtime

import { executeOpenAIRequest } from "@/lib/ai/providers/openaiProvider";
import type {
  AIExecutionMode,
  AIResponseFormat,
} from "@/lib/ai/schemas/aiExecution";
import type {
  AICapabilityConfidence,
  AICapabilityFailure,
  AICapabilityName,
  AICapabilityRequest,
  AICapabilityResult,
  AICapabilitySuccess,
  AICapabilityTelemetry,
  RequirementClarifierOutput,
  ReviewExplanationOutput,
} from "@/lib/ai/schemas/capability";

/**
 * Capability output map.
 *
 * This keeps the gateway typed without introducing a generic autonomous framework.
 */
export type CapabilityOutputMap = {
  requirement_clarifier: RequirementClarifierOutput;
  review_explanation: ReviewExplanationOutput;
};

type CapabilitySpec = {
  executionMode: AIExecutionMode;
  responseFormat: AIResponseFormat;
  temperature: number;
  maxTokens: number;
};

const CAPABILITY_SPECS: Record<AICapabilityName, CapabilitySpec> = {
  requirement_clarifier: {
    executionMode: "coach",
    responseFormat: "plain_text",
    temperature: 0,
    maxTokens: 900,
  },
  review_explanation: {
    executionMode: "review",
    responseFormat: "plain_text",
    temperature: 0,
    maxTokens: 700,
  },
};

/**
 * Build a default telemetry envelope for bounded capability execution.
 *
 * persisted is always false here by design.
 * The gateway executes AI assistance only; persistence decisions belong elsewhere.
 */
function buildCapabilityTelemetry(args: {
  capability: AICapabilityName;
  status: "success" | "rejected" | "failed_closed";
  provider: string;
  model: string | null;
  latencyMs: number | null;
  confidence: AICapabilityConfidence;
  parseSucceeded: boolean;
  validationSucceeded: boolean;
  failureReason?: string;
}): AICapabilityTelemetry {
  return {
    capability: args.capability,
    status: args.status,
    provider: args.provider,
    model: args.model,
    latencyMs: args.latencyMs,
    confidence: args.confidence,
    parseSucceeded: args.parseSucceeded,
    validationSucceeded: args.validationSucceeded,
    persisted: false,
    ...(args.failureReason ? { failureReason: args.failureReason } : {}),
  };
}

/**
 * Minimal confidence heuristic for M13.
 *
 * Keep this deliberately coarse.
 * We are not pretending to have calibrated probabilistic confidence yet.
 */
function inferConfidence(args: {
  rawReply: string;
  validationSucceeded: boolean;
}): AICapabilityConfidence {
  if (!args.validationSucceeded) return "low";

  const trimmed = String(args.rawReply ?? "").trim();
  if (!trimmed) return "unknown";
  if (trimmed.length < 40) return "medium";
  return "high";
}

/**
 * Capability-specific output parsing.
 *
 * This remains intentionally simple in M13:
 * - requirement clarifier returns bounded explanation text
 * - review explanation returns bounded explanation text
 *
 * Future capability-specific parsers can move into lib/ai/parsers/
 * when capability count justifies it.
 */
function parseCapabilityOutput<K extends AICapabilityName>(args: {
  capability: K;
  rawReply: string;
}): CapabilityOutputMap[K] | null {
  const trimmed = String(args.rawReply ?? "").trim();
  if (!trimmed) return null;

  switch (args.capability) {
    case "requirement_clarifier":
      return {
        clarifiedRequirementText: trimmed,
      } as CapabilityOutputMap[K];

    case "review_explanation":
      return {
        explanationText: trimmed,
      } as CapabilityOutputMap[K];

    default:
      return null;
  }
}

/**
 * Capability-specific local validation.
 *
 * Important:
 * This is bounded validation only.
 * It does not turn AI output into persisted truth.
 */
function validateRequirementClarifierOutput(
  output: RequirementClarifierOutput | null
): { ok: true } | { ok: false; reason: string } {
  if (!output) {
    return {
      ok: false,
      reason: "Capability output was empty or could not be parsed.",
    };
  }

  const text = output.clarifiedRequirementText.trim();
  if (!text) {
    return {
      ok: false,
      reason: "Requirement clarifier returned empty text.",
    };
  }

  return { ok: true };
}

function validateReviewExplanationOutput(
  output: ReviewExplanationOutput | null
): { ok: true } | { ok: false; reason: string } {
  if (!output) {
    return {
      ok: false,
      reason: "Capability output was empty or could not be parsed.",
    };
  }

  const text = output.explanationText.trim();
  if (!text) {
    return {
      ok: false,
      reason: "Review explanation returned empty text.",
    };
  }

  return { ok: true };
}

function validateCapabilityOutput<K extends AICapabilityName>(args: {
  capability: K;
  output: CapabilityOutputMap[K] | null;
}): { ok: true } | { ok: false; reason: string } {
  switch (args.capability) {
    case "requirement_clarifier":
      return validateRequirementClarifierOutput(
        args.output as RequirementClarifierOutput | null
      );

    case "review_explanation":
      return validateReviewExplanationOutput(
        args.output as ReviewExplanationOutput | null
      );

    default:
      return {
        ok: false,
        reason: "Unsupported capability validation path.",
      };
  }
}

function buildRejectedResult<K extends AICapabilityName>(args: {
  capability: K;
  reason: string;
}): AICapabilityFailure {
  return {
    ok: false,
    status: "rejected",
    capability: args.capability,
    reason: args.reason,
    rawReply: null,
    confidence: "unknown",
    telemetry: buildCapabilityTelemetry({
      capability: args.capability,
      status: "rejected",
      provider: "openai",
      model: null,
      latencyMs: null,
      confidence: "unknown",
      parseSucceeded: false,
      validationSucceeded: false,
      failureReason: args.reason,
    }),
  };
}

function buildFailedClosedResult<K extends AICapabilityName>(args: {
  capability: K;
  rawReply: string | null;
  model: string | null;
  latencyMs: number | null;
  reason: string;
  parseSucceeded: boolean;
  validationSucceeded: boolean;
}): AICapabilityFailure {
  const confidence = inferConfidence({
    rawReply: args.rawReply ?? "",
    validationSucceeded: args.validationSucceeded,
  });

  return {
    ok: false,
    status: "failed_closed",
    capability: args.capability,
    reason: args.reason,
    rawReply: args.rawReply,
    confidence,
    telemetry: buildCapabilityTelemetry({
      capability: args.capability,
      status: "failed_closed",
      provider: "openai",
      model: args.model,
      latencyMs: args.latencyMs,
      confidence,
      parseSucceeded: args.parseSucceeded,
      validationSucceeded: args.validationSucceeded,
      failureReason: args.reason,
    }),
  };
}

function buildSuccessResult<K extends AICapabilityName>(args: {
  capability: K;
  rawReply: string;
  model: string;
  latencyMs: number;
  output: CapabilityOutputMap[K];
}): AICapabilitySuccess<CapabilityOutputMap[K]> {
  const confidence = inferConfidence({
    rawReply: args.rawReply,
    validationSucceeded: true,
  });

  return {
    ok: true,
    status: "success",
    capability: args.capability,
    output: args.output,
    rawReply: args.rawReply,
    confidence,
    telemetry: buildCapabilityTelemetry({
      capability: args.capability,
      status: "success",
      provider: "openai",
      model: args.model,
      latencyMs: args.latencyMs,
      confidence,
      parseSucceeded: true,
      validationSucceeded: true,
    }),
  };
}

/**
 * Execute a bounded capability request through the AI provider boundary.
 *
 * Hard boundaries:
 * - this gateway does not persist artifacts
 * - this gateway does not own workflow truth
 * - this gateway does not own deterministic scoring
 * - this gateway does not own release decisions
 *
 * It is a typed AI assistance dispatcher only.
 */
export async function executeCapability<K extends AICapabilityName>(
  request: AICapabilityRequest<unknown> & { capability: K }
): Promise<AICapabilityResult<CapabilityOutputMap[K]>> {
  const spec = CAPABILITY_SPECS[request.capability];

  if (!spec) {
    return buildRejectedResult({
      capability: request.capability,
      reason: `Unsupported capability: ${request.capability}`,
    }) as AICapabilityResult<CapabilityOutputMap[K]>;
  }

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    return buildRejectedResult({
      capability: request.capability,
      reason: "Capability execution requires at least one AI message.",
    }) as AICapabilityResult<CapabilityOutputMap[K]>;
  }

  const response = await executeOpenAIRequest({
    messages: request.messages,
    executionMode: spec.executionMode,
    temperature: spec.temperature,
    maxTokens: spec.maxTokens,
    responseFormat: spec.responseFormat,
  });

  const parsedOutput = parseCapabilityOutput({
    capability: request.capability,
    rawReply: response.rawReply,
  });

  if (!parsedOutput) {
    return buildFailedClosedResult({
      capability: request.capability,
      rawReply: response.rawReply,
      model: response.model,
      latencyMs: response.providerLatencyMs,
      reason: "Capability output could not be parsed.",
      parseSucceeded: false,
      validationSucceeded: false,
    }) as AICapabilityResult<CapabilityOutputMap[K]>;
  }

  const validation = validateCapabilityOutput({
    capability: request.capability,
    output: parsedOutput,
  });

  if (!validation.ok) {
    return buildFailedClosedResult({
      capability: request.capability,
      rawReply: response.rawReply,
      model: response.model,
      latencyMs: response.providerLatencyMs,
      reason: validation.reason,
      parseSucceeded: true,
      validationSucceeded: false,
    }) as AICapabilityResult<CapabilityOutputMap[K]>;
  }

  return buildSuccessResult({
    capability: request.capability,
    rawReply: response.rawReply,
    model: response.model,
    latencyMs: response.providerLatencyMs,
    output: parsedOutput,
  });
}