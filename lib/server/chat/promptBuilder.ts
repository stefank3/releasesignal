// lib/server/chat/promptBuilder.ts
// M10 extraction:
// Centralize prompt construction for coach / cases / review modes.
// This keeps AI prompt assembly out of the API route.
//
// M13 AI Abstraction CHANGE:
// - align prompt output messages with the provider-neutral AIChatMessage contract
// - keep prompt construction separate from provider execution
//
// M13 PROMPT HARDENING CHANGE:
// - strengthen risk-based QA reasoning in coach/cases flows
// - reduce agreeable / happy-path bias
// - improve ambiguity detection and bounded assumption handling
// - increase negative-path / edge-case pressure without changing output contracts
// - preserve deterministic parsing safety by keeping schemas and response formats stable
//
// V1.3.1 PROMPT HARDENING CHANGE:
// - reinforce technical detail preservation in coach/refinement and cases modes
// - keep output contract and parser expectations unchanged

import {
  QA_SYSTEM_PROMPT,
  CASES_SYSTEM_PROMPT,
} from "@/lib/framework/systemPrompt";
import {
  artifactToContextText,
  getTestSuite,
  type SessionArtifact,
} from "@/lib/chat/artifact";
import { hasMeaningfulRefinedRequirement } from "@/lib/server/chat/coachFormatting";
import { buildExistingSuiteBaselineFromArtifact } from "@/lib/server/chat/testSuiteService";
import type { AIChatMessage } from "@/lib/ai/schemas/aiExecution";

type BuildPromptArgs = {
  message: string;
  weakInput: boolean;
  guidedAnswer: boolean;
  wantCases: boolean;
  executionMode: "coach" | "review";
  explicitRegenerationRequest: boolean;
  sessionArtifact: SessionArtifact | null;
};

/**
 * M13 containment:
 * PromptBuilder may define the roles it currently emits,
 * but the message shape must remain compatible with the provider-neutral AI layer.
 *
 * Provider-specific SDK message types must not be imported here.
 */
type ModelMessage = AIChatMessage & {
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

function buildCasesModeInstruction(args: {
  weakInput: boolean;
  existingCasesCount: number;
  explicitRegenerationRequest: boolean;
  nextAvailableCaseNumber: number;
}): string {
  const continuityActive =
    args.existingCasesCount > 0 && !args.explicitRegenerationRequest;

  return [
    `INPUT_QUALITY: ${args.weakInput ? "weak" : "ok"}`,
    continuityActive ? "SESSION_CONTINUITY: true" : "SESSION_CONTINUITY: false",
    continuityActive
      ? `NEXT_AVAILABLE_TEST_CASE_ID: TC-${String(
          args.nextAvailableCaseNumber
        ).padStart(3, "0")}`
      : "NEXT_AVAILABLE_TEST_CASE_ID: TC-001",
    continuityActive
      ? "Treat the persisted session test suite as the baseline suite."
      : "Generate a fresh test suite for the user's feature.",
    continuityActive
      ? "Generate ONLY missing tests requested by the user or implied by missing coverage."
      : "Generate the initial structured test suite for the user's feature.",
    "Follow the OUTPUT CONTRACT exactly.",
    "Avoid both exact duplicates and semantic duplicates.",
    "Do NOT repeat, rephrase, or renumber existing tests when continuity is active.",
    "Infer the test design intent before writing cases: API/contract, unit/module, file import/export, UI workflow, regression/change, or mixed.",
    "Adapt each case body to the detected intent while preserving the locked TC format.",
    "For API/contract cases, preserve methods, endpoints, headers, content types, query parameters, request/response assertions, status codes, schema checks, follow-up verification, and cleanup when present.",
    "For unit/module cases, focus on function/module names, inputs, outputs, branches, validation, boundaries, return types, and mocks/stubs; do not add endpoints, HTTP methods, databases, downstream systems, retries, or logs unless explicit.",
    "For file import/export cases, preserve file type, columns/fields, row examples, validation expectations, import/export results, row/file-level errors, and cleanup or rollback expectations.",
    "For UI workflow cases, preserve screen/page, role, UI elements, user actions, expected UI state, validation messages, navigation, and permission/visibility assertions.",
    "Prioritize business-critical paths, negative paths, edge cases, retries, partial failures, invalid inputs, and integration failure behavior.",
    "Do NOT default to a happy-path-heavy suite.",
    "If the requirement is ambiguous, use bounded non-critical assumptions only for setup; missing technical decisions needed for correctness must be noted as gaps in the case body.",
    "Missing details must not become invented systems, endpoints, fields, schemas, payloads, domains, or workflows.",
    "Pressure-test idempotency, state transitions, downstream side effects, and recovery behavior where relevant.",
    "Valid happy-path flows must be Positive core workflow cases, not Edge cases.",
    "Do NOT force API-style case structure onto unit, file, or UI inputs.",
    "Prefer fewer high-signal cases over filler cases.",
    "Each generated test must add meaningful coverage, not cosmetic variation.",
  ].join("\n");
}

function buildReviewModeInstruction(): string {
  return [
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
    "- Do not inflate quality for suite size alone.",
    "- Prefer concrete, requirement-linked observations over generic praise.",
  ].join("\n");
}

function buildCoachModeInstruction(args: {
  weakInput: boolean;
  guidedAnswer: boolean;
  explicitRegenerationRequest: boolean;
}): string {
  return [
    "MODE: COACH (REFINED REQUIREMENT)",
    "Return ONLY valid JSON. No markdown. No prose outside JSON.",
    `INPUT_QUALITY: ${args.weakInput ? "weak" : "ok"}`,
    args.explicitRegenerationRequest
      ? "SESSION_CONTINUITY_RESET: true"
      : "SESSION_CONTINUITY: true",
    args.explicitRegenerationRequest
      ? "Treat this Strategy request as a fresh analysis and ignore prior refined requirement context for this response."
      : "Treat the user's new message as a refinement to the current session requirement unless they explicitly asked to regenerate.",
    args.explicitRegenerationRequest
      ? "Do a clean re-analysis from the current user message."
      : "Update and extend the evolving requirement when new scope, constraints, or risks are introduced.",
    "Primary rule: Do NOT start by asking questions.",
    "If input is weak or ambiguous: proceed with bounded non-critical assumptions, but preserve missing technical decisions as unresolved context or risk.",
    "Encode assumptions and constraints inside the requirement context instead of returning advisory sections.",
    "Do NOT be overly agreeable or optimistic about unclear requirements.",
    "Identify ambiguity, missing decision points, hidden dependencies, and testability risks inside the structured requirement fields.",
    "Strengthen negative paths, failure handling, state integrity, retries, duplicates, and integration risks where relevant.",
    "Infer the likely test design intent before writing JSON: API/contract, unit/module, file import/export, UI workflow, regression/change, or mixed.",
    "Use the inferred intent only to preserve the right details in existing fields; do not add new fields.",
    "Preserve executable technical detail from the source input: API methods/paths/status codes/schemas, UI screens/fields/actions/states, file formats/columns/mappings, unit/module names/inputs/outputs/branches, and regression change scope when present.",
    "Do NOT collapse concrete technical input into generic QA wording such as CRUD coverage, error handling, data integrity, or authorization unless the source itself is generic.",
    "Do NOT invent unrelated domains, endpoints, roles, schemas, screens, functions, modules, business examples, payloads, workflows, downstream systems, retries, or logs.",
    "For unit/module input, do not add API, database, downstream-system, retry, or logging concerns unless explicitly present.",
    "Classify valid happy-path operations as core scope or acceptance criteria; reserve riskFocus for invalid, missing, malformed, unauthorized, boundary, duplicate, failed dependency, and state-conflict behavior.",
    "Prefer precise, testable requirement language over broad product prose.",
    "Do not invent extra workflow state, release decisions, or scoring logic.",
    ...(args.guidedAnswer
      ? [
          "GUIDED_CLARIFICATION_ANSWER: true",
          "Rule: The user has provided clarification answers. Incorporate them into the requirement fields directly.",
        ]
      : []),
    "Schema:",
    "{",
    '  "objective": string,',
    '  "context": string,',
    '  "inScope": string[],',
    '  "outOfScope": string[],',
    '  "integrations": string[],',
    '  "acceptanceCriteria": string[],',
    '  "riskFocus": string[]',
    "}",
    "Rules:",
    "- objective: one concise statement.",
    "- context: include assumptions, constraints, ambiguity notes, and relevant background.",
    "- inScope: explicit required capability only.",
    "- outOfScope: exclusions and deferred areas.",
    "- integrations: external systems, roles, or dependencies.",
    "- acceptanceCriteria: concrete verifiable expected behavior.",
    "- riskFocus: highest-priority failure areas that downstream tests must emphasize.",
    "- Keep all fields concise, deterministic, and free of duplicates.",
  ].join("\n");
}

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
    wantCases && !explicitRegenerationRequest
      ? getTestSuite(sessionArtifact)
      : null;

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
    ? buildCasesModeInstruction({
        weakInput,
        existingCasesCount,
        explicitRegenerationRequest,
        nextAvailableCaseNumber,
      })
    : executionMode === "review"
      ? buildReviewModeInstruction()
      : buildCoachModeInstruction({
          weakInput,
          guidedAnswer,
          explicitRegenerationRequest,
        });

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
