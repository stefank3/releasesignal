// lib/chat/repair.ts
import { openai } from "@/lib/openai";
import type { ExecutionMode } from "./chatTypes";

/**
 * One-pass JSON repair: used ONLY for coach/review.
 * cases mode is plain text (never repaired).
 */
export async function repairJsonOnce(args: { mode: ExecutionMode; raw: string }): Promise<string> {
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

  const repaired = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a strict JSON reformatter. Output ONLY a raw JSON object. No markdown. No code fences." },
      { role: "system", content: schemaInstruction },
      { role: "user", content: `Fix this into valid JSON only:\n\n${args.raw}` },
    ],
  });

  return repaired.choices[0]?.message?.content ?? args.raw;
}