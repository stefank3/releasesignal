// lib/domain/deterministicReviewService.ts
// M12 Step 7D
//
// Purpose:
// Build a deterministic ReviewResult from structured artifacts only.
//
// HARD RULES:
// - NO AI parsing
// - NO UI logic
// - NO orchestration
// - SAME artifacts -> SAME review result
//
// Input:
// - RefinedRequirement
// - TestSuiteArtifact
//
// Output:
// - ReviewResult
//
// This file intentionally keeps scoring and matching logic explicit and stable.

import type {
  RefinedRequirement,
  TestCase,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { normalizeTestCase, validateTestSuite } from "@/lib/chat/artifact";
import type { ReviewBreakdown, ReviewResult } from "@/lib/framework/reviewSchema";

type RequirementUnit = {
  key: string;
  label: string;
  source:
    | "objective"
    | "inScope"
    | "integrations"
    | "riskFocus"
    | "acceptanceCriteria";
  normalizedText: string;
  tokens: string[];
};

type RequirementCoverage = {
  unit: RequirementUnit;
  matchedCaseIds: string[];
};

type DeterministicReviewDetails = {
  requirementUnits: RequirementUnit[];
  coveredUnits: RequirementCoverage[];
  uncoveredUnits: RequirementUnit[];
  orphanCaseIds: string[];
  duplicateGroupCount: number;
  totalCases: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "via",
  "with",
  "user",
  "users",
  "system",
  "should",
  "must",
  "can",
  "flow",
  "using",
  "used",
  "use",
  "when",
  "where",
  "then",
]);

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    )
  );
}

function buildRequirementUnits(
  requirement: RefinedRequirement | null | undefined
): RequirementUnit[] {
  if (!requirement) return [];

  const units: RequirementUnit[] = [];

  const pushUnit = (
    source: RequirementUnit["source"],
    labelPrefix: string,
    value: string | undefined,
    index?: number
  ) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;

    const tokens = tokenize(raw);
    if (!tokens.length) return;

    const suffix = typeof index === "number" ? `-${index + 1}` : "";
    units.push({
      key: `${source}${suffix}`,
      label: `${labelPrefix}${typeof index === "number" ? ` ${index + 1}` : ""}: ${raw}`,
      source,
      normalizedText: normalizeText(raw),
      tokens,
    });
  };

  pushUnit("objective", "Objective", requirement.objective);

  (requirement.inScope ?? []).forEach((item, index) => {
    pushUnit("inScope", "In-scope item", item, index);
  });

  (requirement.integrations ?? []).forEach((item, index) => {
    pushUnit("integrations", "Integration", item, index);
  });

  (requirement.riskFocus ?? []).forEach((item, index) => {
    pushUnit("riskFocus", "Risk focus", item, index);
  });

  (requirement.acceptanceCriteria ?? []).forEach((item, index) => {
    pushUnit("acceptanceCriteria", "Acceptance criterion", item, index);
  });

  return units;
}

function buildCaseSearchText(testCase: TestCase): string {
  const normalizedCase = normalizeTestCase(testCase);

  return normalizeText(
    [
      normalizedCase.title,
      normalizedCase.body,
      ...(normalizedCase.preconditions ?? []),
      ...(normalizedCase.steps ?? []),
      ...(normalizedCase.expectedResults ?? []),
      ...(normalizedCase.tags ?? []),
      normalizedCase.type ?? "",
      normalizedCase.priority ?? "",
      normalizedCase.notes ?? "",
    ].join(" ")
  );
}

function buildTokenSet(value: string): Set<string> {
  return new Set(tokenize(value));
}

function countExactTokenMatches(tokens: string[], haystackTokens: Set<string>): number {
  let matches = 0;

  for (const token of tokens) {
    if (haystackTokens.has(token)) {
      matches += 1;
    }
  }

  return matches;
}

function getRequiredTokenMatches(unit: RequirementUnit): number {
  const tokenCount = unit.tokens.length;

  // BUG FIX (M12 Step 7D):
  // Previous matching allowed overly broad coverage from only 2 generic tokens.
  // Require stricter evidence so requirement units do not appear covered by coincidence.
  if (tokenCount === 1) return 1;
  if (tokenCount === 2) return 2;
  if (tokenCount === 3) return 3;
  if (tokenCount === 4) return 3;

  switch (unit.source) {
    case "integrations":
      return 2;
    case "riskFocus":
      return 2;
    case "objective":
      return 3;
    case "acceptanceCriteria":
      return 3;
    case "inScope":
      return 2;
    default:
      return Math.min(3, tokenCount);
  }
}

function hasPhraseSignal(unit: RequirementUnit, haystack: string): boolean {
  if (unit.normalizedText.length < 12) {
    return haystack.includes(unit.normalizedText);
  }

  const compactPhrase = unit.normalizedText
    .split(" ")
    .filter((part) => part.length >= 4)
    .slice(0, 4)
    .join(" ");

  if (!compactPhrase) return false;

  return haystack.includes(compactPhrase);
}

function isUnitCoveredByCase(unit: RequirementUnit, testCase: TestCase): boolean {
  const haystack = buildCaseSearchText(testCase);
  const haystackTokens = buildTokenSet(haystack);
  const tokenMatchCount = countExactTokenMatches(unit.tokens, haystackTokens);
  const requiredMatches = getRequiredTokenMatches(unit);

  if (tokenMatchCount < requiredMatches) {
    return false;
  }

  // Tighten long-form requirement matching so broad shared vocabulary alone
  // does not count as real coverage.
  if (unit.tokens.length >= 4) {
    return hasPhraseSignal(unit, haystack) || tokenMatchCount >= Math.min(4, unit.tokens.length);
  }

  return true;
}

function mapRequirementCoverage(
  requirementUnits: RequirementUnit[],
  cases: TestCase[]
): RequirementCoverage[] {
  return requirementUnits.map((unit) => ({
    unit,
    matchedCaseIds: cases
      .filter((testCase) => isUnitCoveredByCase(unit, testCase))
      .map((testCase) => testCase.id),
  }));
}

function findOrphanCaseIds(
  requirementCoverage: RequirementCoverage[],
  cases: TestCase[]
): string[] {
  const coveredCaseIds = new Set(
    requirementCoverage.flatMap((coverage) => coverage.matchedCaseIds)
  );

  return cases
    .filter((testCase) => !coveredCaseIds.has(testCase.id))
    .map((testCase) => testCase.id);
}

function hasScenarioSignal(cases: TestCase[], pattern: RegExp): boolean {
  return cases.some((testCase) =>
    pattern.test(
      [testCase.title, testCase.body, ...(testCase.tags ?? [])].join(" ").toLowerCase()
    )
  );
}

function buildRiskCoverageScore(args: {
  totalUnits: number;
  coveredUnits: number;
  orphanCount: number;
  totalCases: number;
}): number {
  if (args.totalUnits === 0) {
    return args.totalCases > 0 ? 10 : 0;
  }

  const coverageRatio = args.coveredUnits / args.totalUnits;
  const orphanPenalty =
    args.totalCases > 0 ? Math.min(0.2, args.orphanCount / args.totalCases) : 0;

  const adjustedRatio = Math.max(0, coverageRatio - orphanPenalty);

  return Math.round(adjustedRatio * 25);
}

function buildBusinessRelevanceScore(args: {
  totalUnits: number;
  coveredObjectiveOrScopeUnits: number;
}): number {
  if (args.totalUnits === 0) return 0;

  const ratio = args.coveredObjectiveOrScopeUnits / args.totalUnits;
  return Math.round(Math.min(1, ratio) * 25);
}

function buildDesignQualityScore(args: {
  duplicateGroupCount: number;
  totalCases: number;
  orphanCount: number;
}): number {
  if (args.totalCases === 0) return 0;

  let score = 20;

  if (args.duplicateGroupCount > 0) {
    score -= Math.min(8, args.duplicateGroupCount * 3);
  }

  if (args.orphanCount > 0) {
    score -= Math.min(6, args.orphanCount * 2);
  }

  return Math.max(0, score);
}

function buildLevelAndScopeScore(cases: TestCase[]): number {
  if (!cases.length) return 0;

  let score = 0;

  if (hasScenarioSignal(cases, /\b(valid|success|happy)\b/)) score += 5;
  if (hasScenarioSignal(cases, /\b(invalid|error|fail|negative|unauthori[sz]ed)\b/)) {
    score += 5;
  }
  if (hasScenarioSignal(cases, /\b(edge|boundary|limit|max|min|empty|null)\b/)) {
    score += 5;
  }

  return Math.min(15, score);
}

function buildDiagnosticValueScore(args: {
  totalCases: number;
  orphanCount: number;
  duplicateGroupCount: number;
}): number {
  if (args.totalCases === 0) return 0;

  let score = 15;

  if (args.orphanCount > 0) {
    score -= Math.min(6, args.orphanCount * 2);
  }

  if (args.duplicateGroupCount > 0) {
    score -= Math.min(6, args.duplicateGroupCount * 2);
  }

  return Math.max(0, score);
}

// BUG FIX (M12 Step 7D): level/scope scoring must use actual normalized suite cases.
// Keep a single breakdown builder so scoring cannot diverge across helper paths.
function buildBreakdown(
  details: DeterministicReviewDetails,
  cases: TestCase[]
): ReviewBreakdown {
  const coveredObjectiveOrScopeUnits = details.coveredUnits.filter(
    (item) => item.unit.source === "objective" || item.unit.source === "inScope"
  ).length;

  return {
    businessRelevance: buildBusinessRelevanceScore({
      totalUnits: details.requirementUnits.length,
      coveredObjectiveOrScopeUnits,
    }),
    riskCoverage: buildRiskCoverageScore({
      totalUnits: details.requirementUnits.length,
      coveredUnits: details.coveredUnits.length,
      orphanCount: details.orphanCaseIds.length,
      totalCases: details.totalCases,
    }),
    designQuality: buildDesignQualityScore({
      duplicateGroupCount: details.duplicateGroupCount,
      totalCases: details.totalCases,
      orphanCount: details.orphanCaseIds.length,
    }),
    levelAndScope: buildLevelAndScopeScore(cases),
    diagnosticValue: buildDiagnosticValueScore({
      totalCases: details.totalCases,
      orphanCount: details.orphanCaseIds.length,
      duplicateGroupCount: details.duplicateGroupCount,
    }),
  };
}

function buildRiskGaps(details: DeterministicReviewDetails): string[] {
  const gaps: string[] = [];

  for (const uncovered of details.uncoveredUnits) {
    gaps.push(`Uncovered requirement unit: ${uncovered.label}`);
  }

  if (details.requirementUnits.length === 0) {
    gaps.push("No structured requirement units were available for deterministic review");
  }

  if (details.totalCases === 0) {
    gaps.push("No test cases are available in the current test suite");
  }

  return gaps.slice(0, 12);
}

function buildAntiPatterns(details: DeterministicReviewDetails): string[] {
  const antiPatterns: string[] = [];

  if (details.duplicateGroupCount > 0) {
    antiPatterns.push(
      `Duplicate coverage detected across ${details.duplicateGroupCount} test case group(s)`
    );
  }

  if (details.orphanCaseIds.length > 0) {
    antiPatterns.push(
      `Orphan tests detected with no requirement mapping: ${details.orphanCaseIds.join(", ")}`
    );
  }

  if (
    !details.coveredUnits.length &&
    details.totalCases > 0 &&
    details.requirementUnits.length > 0
  ) {
    antiPatterns.push("Existing tests do not map to any structured requirement units");
  }

  return antiPatterns.slice(0, 12);
}

function buildImprovements(details: DeterministicReviewDetails): string[] {
  const improvements: string[] = [];

  if (details.uncoveredUnits.length > 0) {
    improvements.push("Add test cases for each uncovered requirement unit");
  }

  if (details.orphanCaseIds.length > 0) {
    improvements.push("Align orphan test cases to requirement intent or remove them");
  }

  if (details.duplicateGroupCount > 0) {
    improvements.push("Deduplicate overlapping cases to improve suite signal quality");
  }

  if (!improvements.length && details.totalCases > 0 && details.coveredUnits.length > 0) {
    improvements.push("Maintain requirement-to-test traceability as the suite evolves");
  }

  if (!improvements.length && details.totalCases === 0) {
    improvements.push("Generate an initial suite from the refined requirement before review");
  }

  return improvements.slice(0, 12);
}

function buildVerdict(score: number): string {
  if (score >= 85) return "Strong - artifact coverage is aligned";
  if (score >= 70) return "Good - minor coverage gaps remain";
  if (score >= 50) return "Moderate - meaningful gaps require attention";
  if (score >= 30) return "Weak - requirement coverage is incomplete";
  return "Poor - review artifacts are not sufficiently aligned";
}

function buildReviewDetails(args: {
  requirement: RefinedRequirement | null | undefined;
  suite: TestSuiteArtifact | null | undefined;
}): { details: DeterministicReviewDetails; cases: TestCase[] } {
  const requirementUnits = buildRequirementUnits(args.requirement);
  const cases = (args.suite?.cases ?? []).map((testCase) => normalizeTestCase(testCase));

  const requirementCoverage = mapRequirementCoverage(requirementUnits, cases);
  const coveredUnits = requirementCoverage.filter(
    (item) => item.matchedCaseIds.length > 0
  );
  const uncoveredUnits = requirementCoverage
    .filter((item) => item.matchedCaseIds.length === 0)
    .map((item) => item.unit);

  const orphanCaseIds = findOrphanCaseIds(requirementCoverage, cases);
  const validation = validateTestSuite(args.suite ?? null);

  return {
    details: {
      requirementUnits,
      coveredUnits,
      uncoveredUnits,
      orphanCaseIds,
      duplicateGroupCount: validation.duplicateGroups.length,
      totalCases: cases.length,
    },
    cases,
  };
}

export function buildDeterministicReviewResult(args: {
  requirement: RefinedRequirement | null | undefined;
  suite: TestSuiteArtifact | null | undefined;
}): ReviewResult {
  const { details, cases } = buildReviewDetails(args);

  const breakdown = buildBreakdown(details, cases);
  const score =
    breakdown.businessRelevance +
    breakdown.riskCoverage +
    breakdown.designQuality +
    breakdown.levelAndScope +
    breakdown.diagnosticValue;

  return {
    score,
    verdict: buildVerdict(score),
    breakdown,
    riskGaps: buildRiskGaps(details),
    antiPatterns: buildAntiPatterns(details),
    improvements: buildImprovements(details),
  };
}