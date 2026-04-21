// lib/ai/capabilities/reviewExplanation.ts
// M13 bounded capability foundation:
// - implement the second bounded capability: review explanation
// - keep it provider-neutral by routing execution through the AI gateway
// - keep it strictly explanatory and non-authoritative
// - keep scope narrow: explain deterministic review output only
//
// Hard boundary:
// This capability must never influence score, verdict, or persisted review truth.
// It explains an existing deterministic review result; it does not create or modify one.

import { executeCapability } from "@/lib/ai/gateway/aiGateway";
import type {
  ReviewExplanationInput,
  ReviewExplanationResult,
} from "@/lib/ai/schemas/capability";
import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";

/**
 * Build bounded messages for the review explanation capability.
 *
 * This capability is intentionally narrow:
 * - explain an existing deterministic review result
 * - make the review easier to understand
 * - preserve alignment to the actual review artifact
 *
 * It must not:
 * - change the score
 * - reinterpret the review into a different verdict
 * - invent missing authority
 * - claim persisted truth ownership
 */
function buildReviewExplanationMessages(
  input: ReviewExplanationInput
): AIChatMessage[] {
  const artifactContextBlock = String(input.artifactContextText ?? "").trim();
  const reviewSummaryText = String(input.reviewSummaryText ?? "").trim();
  const verdict = String(input.verdict ?? "").trim();
  const riskGaps = Array.isArray(input.riskGaps) ? input.riskGaps : [];
  const improvements = Array.isArray(input.improvements) ? input.improvements : [];

  return [
    {
      role: "system",
      content: [
        "You are a bounded QA review explanation capability.",
        "Your job is to explain an existing deterministic review result clearly and faithfully.",
        "Output plain text only.",
        "Do not return JSON.",
        "Do not return markdown code fences.",
        "Do not assign or revise scores.",
        "Do not change the verdict.",
        "Do not invent new authoritative findings beyond the supplied review result.",
        "Explain the review in compact, high-signal QA language.",
        "Keep the explanation grounded in the supplied score, verdict, risk gaps, and improvements.",
      ].join("\n"),
    },
    ...(artifactContextBlock
      ? [
          {
            role: "system",
            content: ["SESSION_ARTIFACT_CONTEXT:", artifactContextBlock].join("\n"),
          } satisfies AIChatMessage,
        ]
      : []),
    {
      role: "system",
      content: [
        "DETERMINISTIC_REVIEW_RESULT:",
        `Score: ${input.reviewScore}`,
        `Verdict: ${verdict}`,
        "",
        "Summary:",
        reviewSummaryText || "(none provided)",
        "",
        "Risk Gaps:",
        riskGaps.length ? riskGaps.map((item) => `- ${item}`).join("\n") : "- None",
        "",
        "Improvements:",
        improvements.length
          ? improvements.map((item) => `- ${item}`).join("\n")
          : "- None",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Explain this review result in clear QA language.",
        "Keep it concise and faithful to the supplied review result.",
        "Do not change the score or verdict.",
      ].join("\n"),
    },
  ];
}

/**
 * Execute the bounded review explanation capability.
 *
 * Important boundary:
 * The result is explanatory AI assistance only.
 * It must not become authoritative review truth, and it must not
 * modify deterministic review artifacts.
 */
export async function runReviewExplanation(
  input: ReviewExplanationInput & { sessionId?: string }
): Promise<ReviewExplanationResult> {
  const verdict = String(input.verdict ?? "").trim();
  const reviewSummaryText = String(input.reviewSummaryText ?? "").trim();

  if (!Number.isFinite(input.reviewScore)) {
    return {
      ok: false,
      status: "rejected",
      capability: "review_explanation",
      reason: "Review explanation requires a finite reviewScore.",
      rawReply: null,
      confidence: "unknown",
      telemetry: {
        capability: "review_explanation",
        status: "rejected",
        provider: "openai",
        model: null,
        latencyMs: null,
        confidence: "unknown",
        parseSucceeded: false,
        validationSucceeded: false,
        persisted: false,
        failureReason: "Review explanation requires a finite reviewScore.",
      },
    };
  }

  if (!verdict) {
    return {
      ok: false,
      status: "rejected",
      capability: "review_explanation",
      reason: "Review explanation requires a non-empty verdict.",
      rawReply: null,
      confidence: "unknown",
      telemetry: {
        capability: "review_explanation",
        status: "rejected",
        provider: "openai",
        model: null,
        latencyMs: null,
        confidence: "unknown",
        parseSucceeded: false,
        validationSucceeded: false,
        persisted: false,
        failureReason: "Review explanation requires a non-empty verdict.",
      },
    };
  }

  if (!reviewSummaryText && (!input.riskGaps?.length || !input.improvements?.length)) {
    return {
      ok: false,
      status: "rejected",
      capability: "review_explanation",
      reason:
        "Review explanation requires reviewSummaryText or enough review detail to explain.",
      rawReply: null,
      confidence: "unknown",
      telemetry: {
        capability: "review_explanation",
        status: "rejected",
        provider: "openai",
        model: null,
        latencyMs: null,
        confidence: "unknown",
        parseSucceeded: false,
        validationSucceeded: false,
        persisted: false,
        failureReason:
          "Review explanation requires reviewSummaryText or enough review detail to explain.",
      },
    };
  }

  return executeCapability({
    capability: "review_explanation",
    input: {
      reviewSummaryText,
      reviewScore: input.reviewScore,
      verdict,
      riskGaps: Array.isArray(input.riskGaps) ? input.riskGaps : [],
      improvements: Array.isArray(input.improvements) ? input.improvements : [],
      artifactContextText: input.artifactContextText ?? null,
    },
    sessionId: input.sessionId,
    messages: buildReviewExplanationMessages({
      reviewSummaryText,
      reviewScore: input.reviewScore,
      verdict,
      riskGaps: Array.isArray(input.riskGaps) ? input.riskGaps : [],
      improvements: Array.isArray(input.improvements) ? input.improvements : [],
      artifactContextText: input.artifactContextText ?? null,
    }),
  });
}