// lib/chat/model.ts

export const CHAT_MODEL = "gpt-4.1-mini" as const;

export type ChatModel = typeof CHAT_MODEL;

export type ModelCallParams = {
  model: ChatModel;
  temperature: number;
  maxTokens: number;
  responseFormat: { type: "json_object" } | undefined;
};

export function getModelCallParams(args: { wantCases: boolean; executionMode: "coach" | "review" }): ModelCallParams {
  const { wantCases, executionMode } = args;

  return {
    model: CHAT_MODEL,
    temperature: wantCases ? 0.2 : 0,
    maxTokens: executionMode === "review" ? 650 : wantCases ? 1400 : 900,
    responseFormat: wantCases ? undefined : { type: "json_object" },
  };
}