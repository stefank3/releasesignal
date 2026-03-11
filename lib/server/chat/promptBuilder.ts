// lib/server/chat/promptBuilder.ts
// M10 extraction:
// Centralize prompt construction for coach / cases / review modes.
// This keeps AI prompt assembly out of the API route.

import { QA_SYSTEM_PROMPT, CASES_SYSTEM_PROMPT } from "@/lib/framework/systemPrompt";
import { artifactToContextText, getTestSuite, type SessionArtifact } from "@/lib/chat/artifact";
import { hasMeaningfulRefinedRequirement } from "@/lib/server/chat/coachFormatting";
import { buildExistingSuiteBaselineFromArtifact } from "@/lib/server/chat/testSuiteService";

type BuildPromptArgs = {
  message: string;
  weakInput: boolean;
  guidedAnswer: boolean;
  wantCases: boolean;
  executionMode: "coach" | "review";
  explicitRegenerationRequest: boolean;
  sessionArtifact: SessionArtifact | null;
};

type ModelMessage = {
  role: "system" | "user";
  content: string;
};

export type BuildPromptResult = {
  systemPrompt: string;
  modeInstruction: string;
  messagesForModel: ModelMessage[];
  existingCasesCount: number;
  nextAvailableCaseNumber: number;
};

export function buildPromptPayload(args: BuildPromptArgs): BuildPromptResult {
  const {
    message,
    weakInput,
    guidedAnswer,
    wantCases,
    executionMode,
    explicitRegenerationRequest,
    sessionArtifact,
  } = args;

  let existingCasesSuiteSummary: string | null = null;
  let nextAvailableCaseNumber = 1;
  let existingCasesCount = 0;

  const existingTestSuite =
    wantCases && !explicitRegenerationRequest ? getTestSuite(sessionArtifact) : null;

  if (wantCases && existingTestSuite) {
    const baseline = buildExistingSuiteBaselineFromArtifact(existingTestSuite);
    existingCasesSuiteSummary = baseline.suiteSummary;
    existingCasesCount = baseline.existingCount;
    nextAvailableCaseNumber = Math.max(1, baseline.maxCaseNumber + 1);
  }

  const systemPrompt = wantCases ? CASES_SYSTEM_PROMPT : QA_SYSTEM_PROMPT;

  const effectiveArtifactForCoach =
    executionMode === "coach" && !wantCases && explicitRegenerationRequest
      ? null
      : sessionArtifact;

  const modeInstruction = wantCases
    ? [
        `INPUT_QUALITY: ${weakInput ? "weak" : "ok"}`,
        existingCasesCount > 0 && !explicitRegenerationRequest
          ? "SESSION_CONTINUITY: true"
          : "SESSION_CONTINUITY: false",
        existingCasesCount > 0 && !explicitRegenerationRequest
          ? `NEXT_AVAILABLE_TEST_CASE_ID: TC-${String(nextAvailableCaseNumber).padStart(3, "0")}`
          : "NEXT_AVAILABLE_TEST_CASE_ID: TC-001",
        existingCasesCount > 0 && !explicitRegenerationRequest
          ? "Treat the persisted session test suite as the baseline suite."
          : "Generate a fresh test suite for the user's feature.",
        existingCasesCount > 0 && !explicitRegenerationRequest
          ? "Generate ONLY missing tests requested by the user or implied by missing coverage."
          : "Generate the initial structured test suite for the user's feature.",
        "Avoid both exact duplicates and semantic duplicates.",
        "Do NOT repeat, rephrase, or renumber existing tests when continuity is active.",
        "Follow the OUTPUT CONTRACT exactly.",
      ].join("\n")
    : executionMode === "review"
      ? [
          "MODE: REVIEW & SCORING",
          "Return ONLY valid JSON. No markdown. No prose outside JSON.",
          "Schema:",
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
          "Rules:",
          "- Ensure breakdown is consistent with score.",
          "- riskGaps and improvements must be actionable and specific.",
          "- Keep each list <= 6 items.",
        ].join("\n")
      : [
          "MODE: COACH (TESTS-FIRST, LOW-FRICTION)",
          "Return ONLY valid JSON. No markdown. No prose outside JSON.",
          `INPUT_QUALITY: ${weakInput ? "weak" : "ok"}`,
          explicitRegenerationRequest
            ? "SESSION_CONTINUITY_RESET: true"
            : "SESSION_CONTINUITY: true",
          explicitRegenerationRequest
            ? "Treat this Strategy request as a fresh analysis and ignore prior refined requirement context for this response."
            : "Treat the user's new message as a refinement to the current session requirement unless they explicitly asked to regenerate.",
          explicitRegenerationRequest
            ? "Do a clean re-analysis from the current user message."
            : "Update and extend the evolving requirement when new scope, constraints, or risks are introduced.",
          "Primary rule: Do NOT start by asking questions.",
          "If input is weak: make reasonable assumptions and proceed.",
          "Always provide: assumptions + riskMatrix + highSignalApproach + testIdeas.",
          "Clarifications are OPTIONAL and MUST be last (max 3).",
          "If you include clarifications, they must be phrased as an opt-in for deeper tests.",
          ...(guidedAnswer
            ? [
                "GUIDED_CLARIFICATION_ANSWER: true",
                "Rule: The user has provided clarification answers. You MUST NOT include optionalClarifications. Proceed with full output.",
              ]
            : []),
          "Schema:",
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
          '  "optionalClarifications": string[]',
          "}",
          "Rules:",
          "- assumptions: 3-6 items.",
          "- riskMatrix: 3-6 items, concrete failure modes.",
          "- goals: 3-6 items.",
          "- testIdeas: 6-12 items max, specific and verifiable.",
          "- optionalClarifications: 0-3 items ONLY, and ONLY for more detailed tests.",
        ].join("\n");

  const hasArtifact = hasMeaningfulRefinedRequirement(
    wantCases ? sessionArtifact : effectiveArtifactForCoach
  );

  const includeArtifactContext =
    (wantCases && hasArtifact) ||
    (!wantCases &&
      executionMode === "coach" &&
      hasArtifact &&
      !explicitRegenerationRequest);

  const artifactForContext: SessionArtifact | null = wantCases
    ? sessionArtifact
    : effectiveArtifactForCoach;

  const artifactContext =
    includeArtifactContext && artifactForContext
      ? artifactToContextText(artifactForContext)
      : null;

  const messagesForModel: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: modeInstruction },
    ...(artifactContext
      ? [{ role: "system" as const, content: artifactContext }]
      : []),
    ...(wantCases && existingCasesSuiteSummary && !explicitRegenerationRequest
      ? [
          {
            role: "system" as const,
            content: [
              "EXISTING_TEST_SUITE_BASELINE:",
              "The following test cases already exist in this session artifact.",
              "Use them to continue numbering and avoid duplicates.",
              "",
              existingCasesSuiteSummary,
            ].join("\n"),
          },
        ]
      : []),
    { role: "user", content: message },
  ];

    return {
    systemPrompt,
    modeInstruction,
    messagesForModel,
    existingCasesCount,
    nextAvailableCaseNumber,
  };
}
