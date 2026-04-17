// lib/ai/schemas/aiExecution.ts
// M13 AI Abstraction:
// Provider-neutral request/response contracts for AI execution.
// This file intentionally avoids importing provider SDK types.
// Product/server flows should depend on these normalized contracts,
// not on OpenAI-specific SDK shapes.

export type AIExecutionMode = "coach" | "review";

export type AIResponseFormat = "json_object" | "plain_text";

/**
 * M13 provider-neutral chat message shape.
 *
 * This is intentionally permissive because current prompt construction may
 * still produce OpenAI-shaped messages. Provider adapters are responsible for
 * translating this normalized contract into their SDK-specific format.
 */
export type AIChatMessage = {
  role: string;
  content: unknown;
  name?: string;
};

/**
 * Normalized AI execution request.
 *
 * Product logic owns workflow intent.
 * Provider adapters only execute the model request.
 */
export type AIExecutionRequest = {
  messages: AIChatMessage[];
  executionMode: AIExecutionMode;
  responseFormat: AIResponseFormat;
  temperature: number;
  maxTokens: number;
};

/**
 * Normalized usage metadata.
 *
 * This keeps billing/cost logic independent from provider-specific usage keys
 * such as OpenAI's prompt_tokens/completion_tokens naming.
 */
export type AIUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/**
 * Normalized AI execution response.
 *
 * Provider-specific latency naming is intentionally avoided here.
 * Compatibility naming can remain in older wrapper services until callers are migrated.
 */
export type AIExecutionResponse = {
  rawReply: string;
  usage: AIUsage;
  model: string;
  provider: "openai";
  providerLatencyMs: number;
};