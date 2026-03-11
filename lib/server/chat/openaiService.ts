// lib/server/chat/openaiService.ts
// M10 Pass 7
// Isolate OpenAI execution + usage/cost extraction.

import OpenAI from "openai";

import { openai, withOpenAITrace } from "@/lib/openai";
import { tokensToCredits, estimateCostUsd, maybeConvertUsdToEur } from "@/lib/chat/costs";

export type OpenAIExecutionResult = {
  rawReply: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditsCharged: number;
  costUsd: number | null;
  costEur: number | null;
  model: string;
  openaiLatencyMs: number;
};

export async function executeChatCompletion(args: {
  messagesForModel: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  executionMode: "coach" | "review";
  wantCases: boolean;
}): Promise<OpenAIExecutionResult> {
  const model = "gpt-4.1-mini";

  const { result: completion, trace } = await withOpenAITrace(
    () =>
      openai.chat.completions.create({
        model,
        temperature: args.wantCases ? 0.2 : 0,
        max_tokens: args.executionMode === "review" ? 650 : args.wantCases ? 1400 : 900,
        response_format: args.wantCases ? undefined : { type: "json_object" },
        messages: args.messagesForModel,
      }),
    model
  );

  const rawReply = completion.choices[0]?.message?.content ?? "No reply returned";

  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;

  const creditsCharged = tokensToCredits(totalTokens);

  const costUsd = estimateCostUsd({
    model,
    promptTokens,
    completionTokens,
  });

  const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

  return {
    rawReply,
    promptTokens,
    completionTokens,
    totalTokens,
    creditsCharged,
    costUsd,
    costEur,
    model,
    openaiLatencyMs: trace.latencyMs,
  };
}