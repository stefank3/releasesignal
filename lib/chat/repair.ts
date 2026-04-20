// lib/chat/repair.ts
// M13 AI Abstraction CHANGE:
// - remove direct OpenAI client usage from JSON repair
// - route repair execution through the provider adapter boundary
// - keep repair behavior unchanged: one pass, JSON response, temperature 0
// - keep repair limited to coach/review; cases mode remains plain text and is never repaired

import { executeOpenAIRequest } from "@/lib/ai/providers/openaiProvider";
import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";
import type { ExecutionMode } from "./chatTypes";

/**
 * One-pass JSON repair: used ONLY for coach/review.
 * cases mode is plain text (never repaired).
 */
export async function repairJsonOnce(args: {
  mode: ExecutionMode;
  raw: string;
}): Promise<string> {
  const schemaInstruction =
    args.mode === "review"
      ? [
          "You must output ONLY valid JSON matching this schema (no markdown, no prose):",
          "{",
          '  "score": number (0-100),',
          '  "verdict": string,',
          '  "breakdown": {',
          '    "businessRelevance": number (0-25),',
          '    "riskCoverage": number (0-25),',
          '    "designQuality": number (0-20),',
          '    "levelAndScope": number (0-15),',
          '    "diagnosticValue": number (0-15)',
          "  },",
          '  "riskGaps": string[],',
          '  "antiPatterns": string[],',
          '  "improvements": string[]',
          "}",
        ].join("\n")
      : [
          "You must output ONLY valid JSON matching this schema (no markdown, no prose):",
          "{",
          '  "assumptions": string[],',
          '  "riskMatrix": [',
          '    { "risk": string, "likelihood": "Low"|"Med"|"High", "impact": "Low"|"Med"|"High", "mitigation": string }',
          "  ],",
          '  "highSignalApproach": {',
          '    "goals": string[],',
          '    "testIdeas": string[],',
          '    "minimalRepro"?: string[]',
          "  },",
          '  "optionalClarifications": string[] (max 3)',
          "}",
          "Rules:",
          "- Provide immediate value; do NOT ask lots of questions.",
          "- optionalClarifications must be <= 3 and placed last.",
        ].join("\n");

  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "You are a strict JSON reformatter. Output ONLY a raw JSON object. No markdown. No code fences.",
    },
    { role: "system", content: schemaInstruction },
    { role: "user", content: `Fix this into valid JSON only:\n\n${args.raw}` },
  ];

  const repaired = await executeOpenAIRequest({
    messages,
    executionMode: args.mode === "review" ? "review" : "coach",
    temperature: 0,
    maxTokens: 900,
    responseFormat: "json_object",
  });

  return repaired.rawReply || args.raw;
}