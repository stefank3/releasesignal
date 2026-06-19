import type { RefinedRequirement, SessionArtifact } from "@/lib/chat/artifact";
import { normalizeRequirementPatchQuality } from "@/lib/server/chat/requirementQuality";

export type RequirementRefinementIntent =
  | "quality_only"
  | "clarification_update"
  | "correction"
  | "scope_change";

export type RequirementRefinementIntentResult = {
  intent: RequirementRefinementIntent;
  newFactDetected: boolean;
  correctionDetected: boolean;
  scopeChangeDetected: boolean;
};

const QUALITY_ONLY_PATTERN =
  /\b(refine|improve|make (it|this) (better|clearer)|clean (it|this) up|restructure|rewrite|deduplicate|polish|improve quality|better version|broaden this requirement)\b/i;
const CORRECTION_PATTERN =
  /(^|\b)(correction:|actually|instead of|replace|should be\b.+\bnot\b|use\b.+\b(rather than|instead of)\b|change\b.+\bto\b|not\b.+\bbut\b)/i;
const SCOPE_CHANGE_PATTERN =
  /\b(out of scope|remove from scope|add to scope|exclude|do not include|no longer required|keep unchanged|must not|should remain unchanged)\b|\bremove\s+\S(?:.{0,80})?\s+from scope\b|\badd\s+\S(?:.{0,80})?\s+to scope\b/i;
const FACT_SIGNAL_PATTERN =
  /\b(is|are|includes?|returns?|uses?|stores?|stored|persists?|persisted|succeeds?|fails?|deletes?|updates?|sets?|maps?|has|owns|requires?)\b/i;
const TECHNICAL_FACT_PATTERN =
  /\b(GET|POST|PUT|PATCH|DELETE)\b\s+\/|\/[A-Za-z0-9_{}./-]+|\b\d{3}\b|\b[A-Za-z][A-Za-z0-9_]*(?:Id|ID)\b|\b[A-Z0-9_]{4,}\b|\bmod_[a-z0-9_]+\b|\bactionResult\b|\bfailureReason\b|\bactionsPerformed\b|\bTransaction Number\b|\bGUID\b|\bOrderID\b|\bPaymob\b|\bNetCracker\b|['"][^'"]+['"]|=\s*[\w'"]+/;

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
  "when",
  "then",
  "what",
  "which",
  "confirm",
  "requirement",
  "technical",
  "refine",
  "improve",
  "transaction",
]);

function normalizeText(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .match(/[a-z0-9_{}./'-]{3,}/g)
      ?.filter((token) => !TOKEN_STOP_WORDS.has(token)) ?? []
  );
}

function requirementText(requirement: RefinedRequirement | null | undefined): string {
  if (!requirement) return "";

  return [
    requirement.objective,
    requirement.context,
    ...(requirement.inScope ?? []),
    ...(requirement.outOfScope ?? []),
    ...(requirement.integrations ?? []),
    ...(requirement.functionalScope ?? []),
    ...(requirement.businessRules ?? []),
    ...(requirement.acceptanceCriteria ?? []),
    ...(requirement.edgeCasesNegativePaths ?? requirement.edgeCases ?? []),
    ...(requirement.nonFunctionalConstraints ?? []),
    ...(requirement.riskAreas ?? requirement.riskFocus ?? []),
    ...(requirement.coverageTargets ?? []),
    ...(requirement.minimalReproScenarios ?? []),
    ...(requirement.openQuestionsClarifications ?? requirement.openQuestions ?? []),
  ]
    .filter(Boolean)
    .join("\n");
}

function overlapCount(a: string, b: string): number {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  let count = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) count += 1;
  }

  return count;
}

function hasConcreteFact(value: string): boolean {
  return TECHNICAL_FACT_PATTERN.test(value) && FACT_SIGNAL_PATTERN.test(value);
}

function isRepeatedExistingContent(args: {
  message: string;
  existingRequirement: RefinedRequirement | null | undefined;
}): boolean {
  const existing = requirementText(args.existingRequirement);
  if (!existing || !hasConcreteFact(args.message)) return false;

  const messageTokens = tokens(args.message);
  if (messageTokens.size < 4) return false;

  const overlap = overlapCount(args.message, existing);
  return overlap >= Math.min(8, Math.max(4, Math.floor(messageTokens.size * 0.6)));
}

export function detectRequirementRefinementIntent(args: {
  message: string;
  existingArtifact: SessionArtifact | null;
}): RequirementRefinementIntentResult {
  const message = args.message.trim();
  const existingRequirement = args.existingArtifact?.refinedRequirement ?? null;
  const existingArtifactPresent = Boolean(existingRequirement);
  const correctionDetected = CORRECTION_PATTERN.test(message);
  const scopeChangeDetected = SCOPE_CHANGE_PATTERN.test(message);
  const repeatedExistingContent = isRepeatedExistingContent({
    message,
    existingRequirement,
  });
  const qualityRequest = QUALITY_ONLY_PATTERN.test(message);
  const concreteFactDetected = hasConcreteFact(message);
  const newFactDetected =
    concreteFactDetected && !qualityRequest && !repeatedExistingContent;

  if (correctionDetected) {
    return {
      intent: "correction",
      newFactDetected: true,
      correctionDetected,
      scopeChangeDetected,
    };
  }

  if (scopeChangeDetected) {
    return {
      intent: "scope_change",
      newFactDetected: true,
      correctionDetected,
      scopeChangeDetected,
    };
  }

  if (newFactDetected) {
    return {
      intent: "clarification_update",
      newFactDetected,
      correctionDetected,
      scopeChangeDetected,
    };
  }

  return {
    intent: existingArtifactPresent ? "quality_only" : "clarification_update",
    newFactDetected: false,
    correctionDetected,
    scopeChangeDetected,
  };
}

export function constrainRequirementPatchForIntent(args: {
  patch: Partial<RefinedRequirement>;
  existingArtifact: SessionArtifact | null;
  intent: RequirementRefinementIntent;
}): Partial<RefinedRequirement> | null {
  if (args.intent !== "quality_only") return args.patch;

  const existing = args.existingArtifact?.refinedRequirement ?? null;
  if (!existing) return args.patch;

  const existingPatch: Partial<RefinedRequirement> = {
    objective: existing.objective,
    context: existing.context,
    inScope: existing.inScope ?? [],
    outOfScope: existing.outOfScope ?? [],
    integrations: existing.integrations ?? [],
    functionalScope: existing.functionalScope ?? [],
    businessRules: existing.businessRules ?? [],
    acceptanceCriteria: existing.acceptanceCriteria ?? [],
    edgeCases: existing.edgeCases ?? existing.edgeCasesNegativePaths ?? [],
    edgeCasesNegativePaths: existing.edgeCasesNegativePaths ?? existing.edgeCases ?? [],
    nonFunctionalConstraints: existing.nonFunctionalConstraints ?? [],
    testStrategyHooks: existing.testStrategyHooks ?? [],
    riskAreas: existing.riskAreas ?? [],
    riskFocus: existing.riskFocus ?? [],
    coverageTargets: existing.coverageTargets ?? [],
    minimalReproScenarios: existing.minimalReproScenarios ?? [],
    openQuestions: existing.openQuestions ?? existing.openQuestionsClarifications ?? [],
    openQuestionsClarifications:
      existing.openQuestionsClarifications ?? existing.openQuestions ?? [],
  };

  return Object.keys(normalizeRequirementPatchQuality(existingPatch)).length
    ? existingPatch
    : null;
}
