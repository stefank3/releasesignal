// lib/ai/index.ts
// M13 bounded capability foundation:
// Central export surface for the minimal AI layer.
// Keep this intentionally small and explicit.
// Do not turn this into a wildcard barrel that hides architecture drift.

export type {
  AIChatMessage,
  AIExecutionMode,
  AIExecutionRequest,
  AIExecutionResponse,
  AIResponseFormat,
  AIUsage,
} from "@/lib/ai/schemas/aiExecution";

export type {
  AICapabilityConfidence,
  AICapabilityFailure,
  AICapabilityName,
  AICapabilityRequest,
  AICapabilityResult,
  AICapabilityStatus,
  AICapabilitySuccess,
  AICapabilityTelemetry,
  RequirementClarifierInput,
  RequirementClarifierOutput,
  RequirementClarifierRequest,
  RequirementClarifierResult,
  ReviewExplanationInput,
  ReviewExplanationOutput,
  ReviewExplanationRequest,
  ReviewExplanationResult,
} from "@/lib/ai/schemas/capability";

export { executeOpenAIRequest } from "@/lib/ai/providers/openaiProvider";

export { executeCapability } from "@/lib/ai/gateway/aiGateway";

export { runRequirementClarifier } from "@/lib/ai/capabilities/requirementClarifier";
export { runReviewExplanation } from "@/lib/ai/capabilities/reviewExplanation";