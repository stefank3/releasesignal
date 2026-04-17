// lib/server/chat/openaiService.ts
// M10 Pass 7
// Isolate OpenAI execution + usage/cost extraction.
//
// M13 AI Abstraction CHANGE:
// - remove direct OpenAI SDK/client execution from this orchestration-facing service
// - keep this file as the compatibility wrapper used by existing chat flows
// - route model execution through the provider adapter boundary
// - preserve existing return shape so downstream billing, telemetry, and response logic stay stable

import { executeOpenAIRequest } from "@/lib/ai/providers/openaiProvider";
import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";
import {
  estimateCostUsd,
  maybeConvertUsdToEur,
  tokensToCredits,
} from "@/lib/chat/costs";

export type OpenAIExecutionResult = {
  rawReply: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditsCharged: number;
  costUsd: number | null;
  costEur: number | null;
  model: string;

  /**
   * Compatibility field.
   *
   * M13 normalizes provider latency internally as providerLatencyMs,
   * but existing chat/billing/telemetry callers may still expect openaiLatencyMs.
   * Keep this stable until a later explicit caller migration.
   */
  openaiLatencyMs: number;
};

function resolveModelExecutionOptions(args: {
  executionMode: "coach" | "review";
  wantCases: boolean;
}): {
  temperature: number;
  maxTokens: number;
  responseFormat: "json_object" | "plain_text";
} {
  return {
    temperature: args.wantCases ? 0.2 : 0,
    maxTokens:
      args.executionMode === "review" ? 650 : args.wantCases ? 1400 : 900,
    responseFormat: args.wantCases ? "plain_text" : "json_object",
  };
}

export async function executeChatCompletion(args: {
  /**
   * M13 compatibility:
   * This is now a provider-neutral message contract.
   * Existing OpenAI-shaped messages remain structurally compatible,
   * but this service no longer imports the OpenAI SDK type directly.
   */
  messagesForModel: AIChatMessage[];
  executionMode: "coach" | "review";
  wantCases: boolean;
}): Promise<OpenAIExecutionResult> {
  const executionOptions = resolveModelExecutionOptions({
    executionMode: args.executionMode,
    wantCases: args.wantCases,
  });

  const response = await executeOpenAIRequest({
    messages: args.messagesForModel,
    executionMode: args.executionMode,
    temperature: executionOptions.temperature,
    maxTokens: executionOptions.maxTokens,
    responseFormat: executionOptions.responseFormat,
  });

  const promptTokens = response.usage.promptTokens;
  const completionTokens = response.usage.completionTokens;
  const totalTokens = response.usage.totalTokens;

  const creditsCharged = tokensToCredits(totalTokens);

  const costUsd = estimateCostUsd({
    model: response.model,
    promptTokens,
    completionTokens,
  });

  const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

  return {
    rawReply: response.rawReply,
    promptTokens,
    completionTokens,
    totalTokens,
    creditsCharged,
    costUsd,
    costEur,
    model: response.model,
    openaiLatencyMs: response.providerLatencyMs,
  };
}