// lib/server/chat/coachFlowService.ts
// M10 Pass 8
// Extract coach-mode orchestration from route.ts so the API route
// acts as a controller instead of owning workflow logic.
//
// M12.12 CHANGE:
// - preserve legacy coach parsing compatibility
// - add locked requirement-ingestion persistence path
// - map normalized requirement output into the current artifact contract
// - prefer normalized refined requirement persistence when available
// - fall back to legacy continuity patch only when ingestion normalization is unavailable
//
// M12.12 FIX:
// - keep Risk Areas separate from Test Strategy Hooks
// - do not synthesize hooks from risk areas or coverage targets
// - persist the normalized requirement without reintroducing duplicate semantic sections
//
// M12.18 CHANGE:
// - stamp requirement version through artifact merge path
// - preserve existing suite on requirement refinement, but make lineage mismatch explicit
// - clear stale review/release-health artifacts when the requirement materially changes
// - keep the route thin and keep workflow integrity decisions in service code
//
// M13 AI Abstraction CHECK:
// - this service intentionally receives raw model output only
// - no provider SDK, model selection, usage accounting, or execution behavior belongs here
// - artifact persistence and stale-review invalidation remain outside the AI/provider layer

import type {
  RefinedRequirement,
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  getRefinedRequirementVersion,
  getTestSuiteRequirementVersion,
  mergeArtifact,
} from "@/lib/chat/artifact";
import type { CoachResult } from "@/lib/framework/reviewSchema";

import {
  buildCoachContinuityArtifactPatch,
  coachToTechnicalRequirementText,
  shouldReturnTechnicalRequirement,
} from "@/lib/server/chat/coachFormatting";

import {
  parseCoachResponse,
  parseRefinedRequirementResponse,
} from "@/lib/server/chat/modelResponseParser";
import { normalizeRequirementPatchQuality } from "@/lib/server/chat/requirementQuality";
import {
  constrainRequirementPatchForIntent,
  detectRequirementRefinementIntent,
  type RequirementRefinementIntent,
} from "@/lib/server/chat/requirementRefinementIntent";

const TECHNICAL_SIGNAL_PATTERN =
  /\b(GET|POST|PUT|PATCH|DELETE)\b\s+\/|\/[A-Za-z0-9_{}./-]+|\b\d{3}\b|\b[A-Za-z][A-Za-z0-9_]*(?:Id|ID)\b|\bmod_[a-z0-9_]+\b|\bactionResult\b|\bfailureReason\b|\bactionsPerformed\b|\bPHP\b|\bNetCracker\b|['"][^'"]+['"]|=\s*[\w'"]+|request body|path parameter|database|table|response contract/i;

const GENERIC_ADVICE_PATTERN =
  /clarify requirements|define acceptance criteria|consider edge cases|test error handling|verify error handling|verify data integrity|verify authorization|generic|happy path|negative tests?|edge cases?|missing requirements?/i;

const TOKEN_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "from",
  "has",
  "have",
  "into",
  "must",
  "not",
  "only",
  "that",
  "the",
  "this",
  "with",
]);

const EXCLUDABLE_DOMAIN_TERMS = [
  "payment",
  "email",
  "fulfillment",
  "account",
  "downstream",
  "logging",
  "partial failure",
  "partial-failure",
  "external integration failure",
  "system logs",
  "side effects",
];

const INVENTED_TECH_GUARD_TERMS = [
  "transaction",
  "transactions",
  "rollback",
  "locking",
  "serialization",
  "logging",
  "monitoring",
  "atomic",
  "partial failure",
  "partial-failure",
  "side effects",
];

async function saveRequirementArtifact(args: {
  sessionId: string;
  artifact: SessionArtifact;
}): Promise<{ artifact: SessionArtifact; artifactUpdatedAtIso: string }> {
  const { saveSessionArtifact } = await import(
    "@/lib/server/chat/artifactPersistence"
  );
  return saveSessionArtifact(args);
}

function cleanLegacyRequirementText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function uniqueLegacyItems(values: Array<string | null | undefined>, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const text = cleanLegacyRequirementText(value);
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(text);

    if (out.length >= max) break;
  }

  return out;
}

function sourceTokens(source: string): Set<string> {
  const tokens = source
    .toLowerCase()
    .match(/[a-z0-9_{}./-]{3,}/g) ?? [];

  return new Set(tokens.filter((token) => !TOKEN_STOP_WORDS.has(token)));
}

function sourceTokenOverlapCount(text: string, sourceTokenSet: Set<string>): number {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9_{}./-]{3,}/g) ?? [];

  let count = 0;
  const seen = new Set<string>();

  for (const token of tokens) {
    if (seen.has(token) || TOKEN_STOP_WORDS.has(token)) continue;
    seen.add(token);
    if (sourceTokenSet.has(token)) count += 1;
  }

  return count;
}

function hasTechnicalSignal(text: string): boolean {
  return TECHNICAL_SIGNAL_PATTERN.test(text);
}

function excludedTermsFromSource(source: string): string[] {
  const exclusionLines = source
    .split(/\r?\n/)
    .filter((line) =>
      /do not|don't|exclude|excluded|not in scope|out of scope|never/i.test(line)
    )
    .join(" ")
    .toLowerCase();

  if (!exclusionLines) return [];

  return EXCLUDABLE_DOMAIN_TERMS.filter((term) =>
    exclusionLines.includes(term)
  );
}

function containsExcludedTerm(text: string, excludedTerms: string[]): boolean {
  const normalized = text.toLowerCase();
  return excludedTerms.some((term) => normalized.includes(term));
}

function containsUngroundedInventedTerm(text: string, source: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedSource = source.toLowerCase();

  return INVENTED_TECH_GUARD_TERMS.some(
    (term) =>
      normalizedText.includes(term) && !normalizedSource.includes(term)
  );
}

function containsUngroundedDeterministicWinnerRule(
  text: string,
  source: string
): boolean {
  const winnerRule =
    /only one .*transaction.*accepted.*rejected deterministically/i;

  return winnerRule.test(text) && !winnerRule.test(source);
}

function isGroundedLegacyItem(args: {
  text: string;
  source: string;
  sourceTokenSet: Set<string>;
  excludedTerms: string[];
}): boolean {
  const text = cleanLegacyRequirementText(args.text);
  if (!text) return false;
  if (containsExcludedTerm(text, args.excludedTerms)) return false;
  if (containsUngroundedInventedTerm(text, args.source)) return false;
  if (containsUngroundedDeterministicWinnerRule(text, args.source)) return false;

  const technical = hasTechnicalSignal(text);
  const overlap = sourceTokenOverlapCount(text, args.sourceTokenSet);
  const generic = GENERIC_ADVICE_PATTERN.test(text);

  if (generic && !technical && overlap < 3) return false;
  if (technical && overlap > 0) return true;

  return overlap >= 2 && !generic;
}

function sourceRequirementLines(source: string): string[] {
  return uniqueLegacyItems(
    source
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/^\s*[-*\u2022]\s*/, "")
          .replace(/^\s*\d+[.)]\s*/, "")
          .trim()
      )
      .filter((line) => line.length >= 8 && line.length <= 260)
      .filter((line) => hasTechnicalSignal(line)),
    16
  );
}

export type RequirementRefinementPath =
  | "strict_requirement"
  | "legacy_coach_compatibility"
  | "continuity_fallback"
  | "rejected";

export type RequirementRefinementDiagnostics = {
  requestId: string;
  refinementPath: RequirementRefinementPath;
  refinementIntent: RequirementRefinementIntent;
  strictRequirementParsed: boolean;
  legacyCoachParsed: boolean;
  compatibilityAccepted: boolean;
  compatibilitySignalCount: number;
  qualitySectionCounts: {
    functionalScope: number;
    acceptanceCriteria: number;
    edgeCases: number;
    riskAreas: number;
    coverageTargets: number;
    minimalReproScenarios: number;
    openQuestions: number;
  };
  existingArtifactPresent: boolean;
  refinementMerged: boolean;
  artifactSaved: boolean;
  newFactDetected: boolean;
  correctionDetected: boolean;
  scopeChangeDetected: boolean;
  sanitizedFailureReason?: string;
};

function qualitySectionCounts(
  patch: Partial<RefinedRequirement> | null | undefined
): RequirementRefinementDiagnostics["qualitySectionCounts"] {
  return {
    functionalScope: patch?.functionalScope?.length ?? 0,
    acceptanceCriteria: patch?.acceptanceCriteria?.length ?? 0,
    edgeCases: (patch?.edgeCasesNegativePaths ?? patch?.edgeCases ?? []).length,
    riskAreas: (patch?.riskAreas ?? patch?.riskFocus ?? []).length,
    coverageTargets: patch?.coverageTargets?.length ?? 0,
    minimalReproScenarios: patch?.minimalReproScenarios?.length ?? 0,
    openQuestions:
      (patch?.openQuestionsClarifications ?? patch?.openQuestions ?? []).length,
  };
}

function compatibilitySignalCount(patch: Partial<RefinedRequirement>): number {
  return (
    (patch.objective ? 1 : 0) +
    (patch.context ? 1 : 0) +
    (patch.functionalScope?.length ? 1 : 0) +
    (patch.acceptanceCriteria?.length ? 1 : 0) +
    (patch.riskAreas?.length || patch.riskFocus?.length ? 1 : 0) +
    (patch.coverageTargets?.length ? 1 : 0) +
    (patch.minimalReproScenarios?.length ? 1 : 0) +
    (patch.openQuestionsClarifications?.length ? 1 : 0)
  );
}

export function legacyCoachToRequirementPatchForRegression(args: {
  coach: CoachResult | null;
  sourceMessage: string;
}): Partial<RefinedRequirement> | null {
  if (!args.coach) return null;

  const source = args.sourceMessage.trim();
  if (!source) return null;

  const sourceTokenSet = sourceTokens(source);
  const excludedTerms = excludedTermsFromSource(source);
  const sourceLines = sourceRequirementLines(source);

  const grounded = (values: string[], max: number) =>
    uniqueLegacyItems(
      values.filter((text) =>
        isGroundedLegacyItem({ text, source, sourceTokenSet, excludedTerms })
      ),
      max
    );

  const goals = grounded(args.coach.highSignalApproach.goals ?? [], 8);
  const testIdeas = grounded(args.coach.highSignalApproach.testIdeas ?? [], 12);
  const minimalRepro = grounded(
    args.coach.highSignalApproach.minimalRepro ?? [],
    8
  );
  const assumptions = grounded(args.coach.assumptions ?? [], 6);
  const risks = grounded(
    (args.coach.riskMatrix ?? []).map((risk) => risk.risk),
    8
  );
  const clarifications = grounded(args.coach.optionalClarifications ?? [], 6);

  const functionalScope = uniqueLegacyItems([...goals, ...sourceLines], 12);
  const acceptanceCriteria = uniqueLegacyItems(
    [
      ...sourceLines.filter((line) =>
        /acceptance|criteria|expected|response|200|400|404|500|success|bad request|not found|internal server error|actionResult|failureReason|actionsPerformed/i.test(
          line
        )
      ),
    ],
    12
  );
  const riskAreas = uniqueLegacyItems([...risks], 8);
  const coverageTargets = uniqueLegacyItems([...testIdeas], 8);
  const minimalReproScenarios = uniqueLegacyItems(
    [
      ...minimalRepro,
      ...sourceLines.filter((line) =>
        /delete|cleanup|deleted|retry|restart|success|400|404|500|not found|bad request|internal server error|failureReason|actionResult/i.test(
          line
        )
      ).map(
        (line) =>
          `Given ${line} When the source request or workflow step is exercised Then verify the source-defined outcome.`
      ),
    ],
    8
  );
  const businessRules = uniqueLegacyItems(
    [
      ...sourceLines.filter((line) =>
        /mod_|delete|deleted|deleteNcTfcOrderData|exSystem|PHP|SUCCESS|database|table/i.test(
          line
        )
      ),
    ],
    12
  );

  const objective =
    goals[0] ??
    sourceLines.find((line) => /\b(GET|POST|PUT|PATCH|DELETE)\b/i.test(line)) ??
    null;

  const patch: Partial<RefinedRequirement> = normalizeRequirementPatchQuality({
    ...(objective ? { objective } : {}),
    ...(assumptions.length ? { context: assumptions.join(" ") } : {}),
    functionalScope,
    inScope: functionalScope,
    businessRules,
    acceptanceCriteria,
    riskAreas,
    riskFocus: riskAreas,
    coverageTargets,
    minimalReproScenarios,
    openQuestions: clarifications,
    openQuestionsClarifications: clarifications,
  });

  const hasSourceTechnicalSignal = hasTechnicalSignal(source);
  const hasMeaningfulLegacyContent =
    sourceLines.length > 0 ||
    goals.length > 0 ||
    testIdeas.length > 0 ||
    risks.length > 0;

  if (
    !hasSourceTechnicalSignal ||
    !hasMeaningfulLegacyContent ||
    compatibilitySignalCount(patch) < 5
  ) {
    return null;
  }

  return patch;
}

function normalizedRequirementToArtifactPatch(
  requirement: Awaited<ReturnType<typeof parseRefinedRequirementResponse>>
): Partial<RefinedRequirement> | null {
  if (!requirement) return null;

  return {
    objective: requirement.objective,
    ...(requirement.context ? { context: requirement.context } : {}),
    inScope: requirement.inScope,
    outOfScope: requirement.outOfScope,
    integrations: requirement.integrations,
    functionalScope: requirement.functionalScope,
    businessRules: requirement.businessRules,
    acceptanceCriteria: requirement.acceptanceCriteria,
    edgeCases: requirement.edgeCasesNegativePaths,
    edgeCasesNegativePaths: requirement.edgeCasesNegativePaths,
    nonFunctionalConstraints: requirement.nonFunctionalConstraints,

    // Keep hooks distinct.
    // Do not mirror Risk Areas or Coverage Targets into this field.
    testStrategyHooks: [],

    riskAreas: requirement.testStrategyHooks.riskAreas,
    coverageTargets: requirement.testStrategyHooks.coverageTargets,
    minimalReproScenarios: requirement.minimalReproScenarios,
    openQuestions: requirement.openQuestionsClarifications,
    openQuestionsClarifications: requirement.openQuestionsClarifications,
  };
}

export function buildRequirementRefinementDiagnostics(args: {
  requestId: string;
  refinementPath: RequirementRefinementPath;
  refinementIntent: RequirementRefinementIntent;
  strictRequirementParsed: boolean;
  legacyCoachParsed: boolean;
  compatibilityPatch?: Partial<RefinedRequirement> | null;
  selectedPatch?: Partial<RefinedRequirement> | null;
  existingArtifactPresent: boolean;
  refinementMerged: boolean;
  artifactSaved: boolean;
  newFactDetected?: boolean;
  correctionDetected?: boolean;
  scopeChangeDetected?: boolean;
  sanitizedFailureReason?: string;
}): RequirementRefinementDiagnostics {
  const compatibilityPatch = args.compatibilityPatch ?? null;

  return {
    requestId: args.requestId,
    refinementPath: args.refinementPath,
    refinementIntent: args.refinementIntent,
    strictRequirementParsed: args.strictRequirementParsed,
    legacyCoachParsed: args.legacyCoachParsed,
    compatibilityAccepted: Boolean(compatibilityPatch),
    compatibilitySignalCount: compatibilityPatch
      ? compatibilitySignalCount(compatibilityPatch)
      : 0,
    qualitySectionCounts: qualitySectionCounts(args.selectedPatch),
    existingArtifactPresent: args.existingArtifactPresent,
    refinementMerged: args.refinementMerged,
    artifactSaved: args.artifactSaved,
    newFactDetected: Boolean(args.newFactDetected),
    correctionDetected: Boolean(args.correctionDetected),
    scopeChangeDetected: Boolean(args.scopeChangeDetected),
    ...(args.sanitizedFailureReason
      ? { sanitizedFailureReason: args.sanitizedFailureReason }
      : {}),
  };
}

/**
 * M12.18:
 * Apply requirement-refinement side effects after mergeArtifact(...) has stamped
 * the new requirement version.
 *
 * Workflow decision:
 * - testSuite is preserved so the user does not lose work, but it will become
 *   explicitly stale when its basedOnRequirementVersion no longer matches
 * - reviewResult is cleared when requirement version changes because it is an
 *   authoritative derived assessment and must not survive a changed baseline
 * - releaseHealth is also cleared because it is a computed aggregate that would
 *   otherwise silently reflect outdated review/alignment state
 *
 * We intentionally do not mutate executionIntelligence here.
 */
function applyRequirementRefinementEffects(args: {
  previousArtifact: SessionArtifact | null;
  nextArtifact: SessionArtifact;
}): SessionArtifact {
  const previousRequirementVersion = getRefinedRequirementVersion(
    args.previousArtifact?.refinedRequirement
  );
  const nextRequirementVersion = getRefinedRequirementVersion(
    args.nextArtifact.refinedRequirement
  );

  // No effective requirement change -> preserve downstream artifacts as-is.
  if (
    previousRequirementVersion != null &&
    nextRequirementVersion != null &&
    previousRequirementVersion === nextRequirementVersion
  ) {
    return args.nextArtifact;
  }

  const previousSuite = args.previousArtifact?.testSuite ?? null;
  const nextSuite = args.nextArtifact.testSuite ?? null;
  const currentRequirementVersion = nextRequirementVersion ?? 1;

  let preservedSuite: TestSuiteArtifact | undefined = nextSuite ?? undefined;

  if (previousSuite) {
    const previousSuiteRequirementVersion =
      getTestSuiteRequirementVersion(previousSuite);

    // M12.18:
    // Do not rewrite suite lineage here.
    // Preserving the previous suite metadata ensures it remains visibly stale
    // when the requirement version advances.
    preservedSuite = {
      ...previousSuite,
      ...(typeof previousSuiteRequirementVersion === "number"
        ? { basedOnRequirementVersion: previousSuiteRequirementVersion }
        : {}),
    };
  } else if (nextSuite) {
    // Defensive fallback: if a suite somehow exists only on the merged artifact,
    // keep it and make its current lineage explicit.
    preservedSuite = {
      ...nextSuite,
      basedOnRequirementVersion:
        nextSuite.basedOnRequirementVersion ?? currentRequirementVersion,
    };
  }

  return {
    ...args.nextArtifact,
    ...(preservedSuite ? { testSuite: preservedSuite } : {}),

    // M12.18 integrity rule:
    // A changed requirement invalidates the old review baseline.
    reviewResult: undefined,

    // M12.18 integrity rule:
    // Release health is derived from artifact state and must be recomputed later.
    releaseHealth: undefined,

    ...(args.nextArtifact.featureWorkspace
      ? {
          featureWorkspace: {
            ...args.nextArtifact.featureWorkspace,
            ...(preservedSuite ? { testSuite: preservedSuite } : {}),

            // Keep workspace requirement synchronized to the merged top-level artifact.
            refinedRequirement: args.nextArtifact.refinedRequirement,

            // Clear stale derived workspace artifacts for the same reason as top-level.
            reviewResult: undefined,
            releaseHealth: undefined,
          },
        }
      : {}),
  };
}

export async function runCoachFlow(args: {
  rawReply: string;
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  guidedAnswer: boolean;
  weakInput: boolean;
  explicitRegenerationRequest: boolean;
}): Promise<{
  coachParsed: CoachResult | null;
  replyTextForUser: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  diagnostics: RequirementRefinementDiagnostics;
}> {
  const [coachParsedRaw, normalizedRequirement] = await Promise.all([
    parseCoachResponse(args.rawReply),
    parseRefinedRequirementResponse(args.rawReply),
  ]);

  const coachParsed = coachParsedRaw
    ? {
        ...coachParsedRaw,
        optionalClarifications:
          coachParsedRaw.optionalClarifications?.slice(0, 3) ?? [],
      }
    : null;

  let sessionArtifact = args.sessionArtifact;
  let artifactUpdatedAtIso = args.artifactUpdatedAtIso;
  let refinementPath: RequirementRefinementPath = "rejected";
  let selectedRequirementPatch: Partial<RefinedRequirement> | null = null;
  let selectedCompatibilityPatch: Partial<RefinedRequirement> | null = null;
  let sanitizedFailureReason: string | undefined;
  const refinementIntent = detectRequirementRefinementIntent({
    message: args.message,
    existingArtifact: args.sessionArtifact,
  });

  if (!coachParsed && !normalizedRequirement) {
    return {
      coachParsed: null,
      replyTextForUser:
        "I couldn't format the coach output this time. Please retry.",
      sessionArtifact,
      artifactUpdatedAtIso,
      diagnostics: buildRequirementRefinementDiagnostics({
        requestId: args.sessionId,
        refinementPath: "rejected",
        refinementIntent: refinementIntent.intent,
        strictRequirementParsed: false,
        legacyCoachParsed: false,
        existingArtifactPresent: Boolean(args.sessionArtifact?.refinedRequirement),
        refinementMerged: false,
        artifactSaved: false,
        newFactDetected: refinementIntent.newFactDetected,
        correctionDetected: refinementIntent.correctionDetected,
        scopeChangeDetected: refinementIntent.scopeChangeDetected,
        sanitizedFailureReason: "model_output_unparseable",
      }),
    };
  }

  const sourceHasTechnicalSignal = hasTechnicalSignal(args.message);
  const shouldResetRequirementArtifact =
    args.explicitRegenerationRequest && !sourceHasTechnicalSignal;
  const requirementMergeBase = shouldResetRequirementArtifact
    ? null
    : sessionArtifact;
  let requirementArtifactUpdated = false;

  const normalizedRequirementPatchRaw =
    normalizedRequirementToArtifactPatch(normalizedRequirement);
  const normalizedRequirementPatch = normalizedRequirementPatchRaw
    ? constrainRequirementPatchForIntent({
        patch: normalizedRequirementPatchRaw,
        existingArtifact: requirementMergeBase,
        intent: refinementIntent.intent,
      })
    : null;

  if (normalizedRequirementPatch) {
    refinementPath = "strict_requirement";
    selectedRequirementPatch = normalizedRequirementPatch;
    const mergedArtifact = mergeArtifact(
      requirementMergeBase,
      normalizedRequirementPatch
    );

    // M12.18:
    // Merge updates the requirement artifact itself.
    // This follow-up step enforces downstream integrity rules after the
    // requirement version has been recalculated.
    const nextArtifact = applyRequirementRefinementEffects({
      previousArtifact: requirementMergeBase,
      nextArtifact: mergedArtifact,
    });

    const saved = await saveRequirementArtifact({
      sessionId: args.sessionId,
      artifact: nextArtifact,
    });

    sessionArtifact = saved.artifact;
    artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
    requirementArtifactUpdated = true;
  } else if (coachParsed) {
    const compatibilityPatch = legacyCoachToRequirementPatchForRegression({
      coach: coachParsed,
      sourceMessage: args.message,
    });
    const constrainedCompatibilityPatch = compatibilityPatch
      ? constrainRequirementPatchForIntent({
          patch: compatibilityPatch,
          existingArtifact: requirementMergeBase,
          intent: refinementIntent.intent,
        })
      : null;
    selectedCompatibilityPatch = constrainedCompatibilityPatch;
    const continuityPatchRaw =
      constrainedCompatibilityPatch ??
      (args.explicitRegenerationRequest
        ? null
        : buildCoachContinuityArtifactPatch({
            existingArtifact: requirementMergeBase,
            coach: coachParsed,
            latestUserMessage: args.message,
            guidedAnswer: args.guidedAnswer,
            weakInput: args.weakInput,
          }));
    const continuityPatch =
      continuityPatchRaw
        ? constrainRequirementPatchForIntent({
            patch: continuityPatchRaw,
            existingArtifact: requirementMergeBase,
            intent: refinementIntent.intent,
          })
        : null;

    if (continuityPatch) {
      refinementPath = constrainedCompatibilityPatch
        ? "legacy_coach_compatibility"
        : "continuity_fallback";
      selectedRequirementPatch = continuityPatch;
      const mergedArtifact = mergeArtifact(requirementMergeBase, continuityPatch);

      // M12.18:
      // Legacy continuity patches can still materially change the requirement.
      // Apply the same downstream invalidation rules here.
      const nextArtifact = applyRequirementRefinementEffects({
        previousArtifact: requirementMergeBase,
        nextArtifact: mergedArtifact,
      });

      const saved = await saveRequirementArtifact({
        sessionId: args.sessionId,
        artifact: nextArtifact,
      });

      sessionArtifact = saved.artifact;
      artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
      requirementArtifactUpdated = true;
    } else {
      sanitizedFailureReason = "no_requirement_patch_accepted";
    }
  } else {
    sanitizedFailureReason = "no_legacy_coach_fallback";
  }

  const effectiveArtifactForReply = args.explicitRegenerationRequest
    ? requirementArtifactUpdated
      ? sessionArtifact
      : null
    : sessionArtifact;

  const shouldRenderRefinedRequirement = shouldReturnTechnicalRequirement({
    guidedAnswer: args.guidedAnswer,
    artifact: effectiveArtifactForReply,
  });

  const replyTextForUser = shouldRenderRefinedRequirement
    ? coachToTechnicalRequirementText(coachParsed, effectiveArtifactForReply)
    : "I couldn't build a refined requirement from that input. Please retry.";
  return {
    coachParsed,
    replyTextForUser,
    sessionArtifact,
    artifactUpdatedAtIso,
    diagnostics: buildRequirementRefinementDiagnostics({
      requestId: args.sessionId,
      refinementPath,
      refinementIntent: refinementIntent.intent,
      strictRequirementParsed: Boolean(normalizedRequirement),
      legacyCoachParsed: Boolean(coachParsed),
      compatibilityPatch: selectedCompatibilityPatch,
      selectedPatch: selectedRequirementPatch,
      existingArtifactPresent: Boolean(args.sessionArtifact?.refinedRequirement),
      refinementMerged: Boolean(selectedRequirementPatch),
      artifactSaved: requirementArtifactUpdated,
      newFactDetected: refinementIntent.newFactDetected,
      correctionDetected: refinementIntent.correctionDetected,
      scopeChangeDetected: refinementIntent.scopeChangeDetected,
      sanitizedFailureReason,
    }),
  };
}
