// lib/ai/providers/openaiProvider.ts
// M13 AI Abstraction:
// OpenAI provider adapter.
// All OpenAI SDK/client-specific execution details belong here,
// not in product flow services or orchestration files.

import type OpenAI from "openai";

import { openai, withOpenAITrace } from "@/lib/openai";
import type {
  AIChatMessage,
  AIExecutionRequest,
  AIExecutionResponse,
} from "@/lib/ai/schemas/aiExecution";

const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * M13 containment:
 * Translate Release Signal's normalized AI message contract into the OpenAI SDK shape.
 *
 * This cast is localized on purpose. The rest of the product should not need to know
 * about OpenAI.Chat.Completions.ChatCompletionMessageParam.
 */
function toOpenAIChatMessages(
  messages: AIChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    ...message,
  })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

/**
 * Execute a normalized AI request through OpenAI.
 *
 * The provider adapter owns:
 * - OpenAI SDK request shape
 * - OpenAI response_format mapping
 * - OpenAI usage field normalization
 * - OpenAI trace/latency extraction
 *
 * It must not own:
 * - workflow state
 * - artifact validity
 * - deterministic scoring
 * - release health semantics
 */
export async function executeOpenAIRequest(
  request: AIExecutionRequest
): Promise<AIExecutionResponse> {
  const model = OPENAI_DEFAULT_MODEL;

  const { result: completion, trace } = await withOpenAITrace(
    () =>
      openai.chat.completions.create({
        model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        response_format:
          request.responseFormat === "json_object"
            ? { type: "json_object" }
            : undefined,
        messages: toOpenAIChatMessages(request.messages),
      }),
    model
  );

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const totalTokens =
    completion.usage?.total_tokens ?? promptTokens + completionTokens;

  return {
    rawReply: completion.choices[0]?.message?.content ?? "No reply returned",
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    model,
    provider: "openai",
    providerLatencyMs: trace.latencyMs,
  };
}