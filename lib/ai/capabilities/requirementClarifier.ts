// lib/ai/capabilities/requirementClarifier.ts
// M13 bounded capability foundation:
// - implement the first bounded capability: requirement clarifier
// - keep it provider-neutral by routing execution through the AI gateway
// - keep output non-authoritative until downstream parsing/validation accepts it
// - keep scope narrow: clarification/explanation support only

import { executeCapability } from "@/lib/ai/gateway/aiGateway";
import type {
  RequirementClarifierInput,
  RequirementClarifierResult,
} from "@/lib/ai/schemas/capability";
import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";

/**
 * Build bounded messages for the requirement clarifier capability.
 *
 * This capability is intentionally narrow:
 * - clarify or restate requirement intent
 * - tighten ambiguity where possible
 * - highlight assumptions in a compact form
 *
 * It must not:
 * - decide workflow state
 * - produce persisted truth on its own
 * - replace deterministic requirement normalization/persistence rules
 */
function buildRequirementClarifierMessages(
  input: RequirementClarifierInput
): AIChatMessage[] {
  const artifactContextBlock = String(input.artifactContextText ?? "").trim();
  const existingRequirementBlock = String(
    input.existingRequirementText ?? ""
  ).trim();
  const userMessage = String(input.userMessage ?? "").trim();

  return [
    {
      role: "system",
      content: [
        "You are a bounded QA requirement clarification capability.",
        "Your job is to clarify, tighten, and restate requirement intent for downstream QA use.",
        "Output plain text only.",
        "Do not return JSON.",
        "Do not return markdown code fences.",
        "Do not make release decisions.",
        "Do not assign scores.",
        "Do not claim persisted truth.",
        "Prefer compact, high-signal clarification over long prose.",
        "When the input is ambiguous, state reasonable assumptions explicitly.",
        "If context is incomplete, fail soft by producing the clearest bounded clarification you can.",
      ].join("\n"),
    },
    ...(artifactContextBlock
      ? [
          {
            role: "system",
            content: [
              "SESSION_ARTIFACT_CONTEXT:",
              artifactContextBlock,
            ].join("\n"),
          } satisfies AIChatMessage,
        ]
      : []),
    ...(existingRequirementBlock
      ? [
          {
            role: "system",
            content: [
              "EXISTING_REQUIREMENT_CONTEXT:",
              existingRequirementBlock,
            ].join("\n"),
          } satisfies AIChatMessage,
        ]
      : []),
    {
      role: "user",
      content: [
        "Clarify this requirement input for QA planning.",
        "Return concise plain text only.",
        "",
        userMessage,
      ].join("\n"),
    },
  ];
}

/**
 * Execute the bounded requirement clarifier capability.
 *
 * Important boundary:
 * The result is still AI assistance output only.
 * It does not become authoritative requirement truth until downstream
 * system parsing/validation decides to accept and persist it.
 */
export async function runRequirementClarifier(
  input: RequirementClarifierInput & { sessionId?: string }
): Promise<RequirementClarifierResult> {
  const userMessage = String(input.userMessage ?? "").trim();

  if (!userMessage) {
    return {
      ok: false,
      status: "rejected",
      capability: "requirement_clarifier",
      reason: "Requirement clarifier requires a non-empty userMessage.",
      rawReply: null,
      confidence: "unknown",
      telemetry: {
        capability: "requirement_clarifier",
        status: "rejected",
        provider: "openai",
        model: null,
        latencyMs: null,
        confidence: "unknown",
        parseSucceeded: false,
        validationSucceeded: false,
        persisted: false,
        failureReason: "Requirement clarifier requires a non-empty userMessage.",
      },
    };
  }

  return executeCapability({
    capability: "requirement_clarifier",
    input: {
      userMessage,
      existingRequirementText: input.existingRequirementText ?? null,
      artifactContextText: input.artifactContextText ?? null,
    },
    sessionId: input.sessionId,
    messages: buildRequirementClarifierMessages({
      userMessage,
      existingRequirementText: input.existingRequirementText ?? null,
      artifactContextText: input.artifactContextText ?? null,
    }),
  });
}