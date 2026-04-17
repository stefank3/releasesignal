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
//
// BUG FIX (M12.8):
// - align requirement unit extraction to locked review contract
// - derive review units ONLY from:
//   * acceptanceCriteria
//   * functionalScope
//   * businessRules
//   * edgeCases
// - remove objective / integration / risk-focus driven coverage mapping
//
// M12.19 CHANGE:
// - harden compound requirement decomposition into deterministic sub-obligations
// - distinguish none / partial / strong coverage instead of binary-only matching
// - reduce false orphan signals by treating partial requirement alignment as mapped
// - calibrate business relevance and risk coverage from explicit coverage strength
// - remove the blunt small-suite score cap in favor of explainable rule outputs
//
// M12.19 CALIBRATION PASS:
// - reduce partial-credit inflation
// - cap top-band category scores when unresolved requirement units remain
// - gate final score bands using unresolved obligation counts, not suite size
//
// M12.19 CONSISTENCY PASS:
// - align verdict wording with unresolved requirement burden
// - prevent "Strong" language while many partial/uncovered units remain
// - keep review score, verdict, and risk gaps telling the same Design Quality story

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
    | "acceptanceCriteria"
    | "functionalScope"
    | "businessRules"
    | "edgeCases";
  normalizedText: string;
  tokens: string[];
};

type CoverageStrength = "none" | "partial" | "strong";

type RequirementCoverage = {
  unit: RequirementUnit;
  matchedCaseIds: string[];
  strength: CoverageStrength;
  strongestCaseMatchCount: number;
};

type DeterministicReviewDetails = {
  requirementUnits: RequirementUnit[];
  coveredUnits: RequirementCoverage[];
  partiallyCoveredUnits: RequirementCoverage[];
  uncoveredUnits: RequirementUnit[];
  orphanCaseIds: string[];
  duplicateGroupCount: number;
  totalCases: number;
  coveragePoints: number;
  maximumCoveragePoints: number;
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

function splitCompoundRequirementText(value: string): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  // M12.19 WHY:
  // Split only on explicit structural separators.
  // This is deterministic and explainable, unlike fuzzy semantic splitting.
  const normalized = raw
    .replace(/\s*;\s*/g, " | ")
    .replace(/\s*,\s*/g, " | ")
    .replace(/\s+\band\b\s+/gi, " | ")
    .replace(/\s+\bor\b\s+/gi, " | ")
    .replace(/\s+\bwhile\b\s+/gi, " | ")
    .replace(/\s+\bbefore\b\s+/gi, " | ")
    .replace(/\s+\bafter\b\s+/gi, " | ")
    .replace(/\s+\bif\b\s+/gi, " | ")
    .replace(/\s+\bwhen\b\s+/gi, " | ");

  const parts = normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  // WHY:
  // Avoid exploding short phrases into meaningless fragments.
  // If splitting produces only tiny pieces, keep the original intact.
  const usefulParts = parts.filter((part) => tokenize(part).length >= 2);

  return usefulParts.length >= 2 ? usefulParts : [raw];
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

    const fragments = splitCompoundRequirementText(raw);

    for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex++) {
      const fragment = fragments[fragmentIndex];
      const tokens = tokenize(fragment);
      if (!tokens.length) continue;

      const baseSuffix = typeof index === "number" ? `-${index + 1}` : "";
      const fragmentSuffix =
        fragments.length > 1 ? `-part-${fragmentIndex + 1}` : "";

      units.push({
        key: `${source}${baseSuffix}${fragmentSuffix}`,
        // M12.19 WHY:
        // Keep labels traceable back to the original source item while showing
        // that a compound line has been decomposed into explicit sub-obligations.
        label:
          `${labelPrefix}${typeof index === "number" ? ` ${index + 1}` : ""}` +
          `${fragments.length > 1 ? ` (part ${fragmentIndex + 1})` : ""}: ${fragment}`,
        source,
        normalizedText: normalizeText(fragment),
        tokens,
      });
    }
  };

  (requirement.acceptanceCriteria ?? []).forEach((item, index) => {
    pushUnit("acceptanceCriteria", "Acceptance criterion", item, index);
  });

  (requirement.functionalScope ?? []).forEach((item, index) => {
    pushUnit("functionalScope", "Functional scope item", item, index);
  });

  (requirement.businessRules ?? []).forEach((item, index) => {
    pushUnit("businessRules", "Business rule", item, index);
  });

  (requirement.edgeCases ?? []).forEach((item, index) => {
    pushUnit("edgeCases", "Edge case", item, index);
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

function countExactTokenMatches(
  tokens: string[],
  haystackTokens: Set<string>
): number {
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

  if (tokenCount === 1) return 1;
  if (tokenCount === 2) return 2;
  if (tokenCount === 3) return 2;
  if (tokenCount === 4) return 2;

  switch (unit.source) {
    case "functionalScope":
      return 2;
    case "businessRules":
      return 2;
    case "edgeCases":
      return 2;
    case "acceptanceCriteria":
      return 3;
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
    .slice(0, 5)
    .join(" ");

  if (!compactPhrase) return false;

  return haystack.includes(compactPhrase);
}

function getCoverageStrength(args: {
  unit: RequirementUnit;
  testCase: TestCase;
}): CoverageStrength {
  const haystack = buildCaseSearchText(args.testCase);
  const haystackTokens = buildTokenSet(haystack);
  const tokenMatchCount = countExactTokenMatches(args.unit.tokens, haystackTokens);
  const requiredMatches = getRequiredTokenMatches(args.unit);

  if (tokenMatchCount === 0) {
    return "none";
  }

  if (tokenMatchCount < requiredMatches) {
    return "partial";
  }

  if (args.unit.tokens.length >= 4) {
    // M12.19 WHY:
    // Long requirement units need either a phrase signal or sufficiently deep
    // token overlap to count as strong coverage. Otherwise they stay partial.
    if (
      hasPhraseSignal(args.unit, haystack) ||
      tokenMatchCount >= Math.min(3, args.unit.tokens.length)
    ) {
      return "strong";
    }

    return "partial";
  }

  return "strong";
}

function mapRequirementCoverage(
  requirementUnits: RequirementUnit[],
  cases: TestCase[]
): RequirementCoverage[] {
  return requirementUnits.map((unit) => {
    let strongestMatchCount = 0;
    let strength: CoverageStrength = "none";
    const matchedCaseIds: string[] = [];

    for (const testCase of cases) {
      const caseStrength = getCoverageStrength({
        unit,
        testCase,
      });

      if (caseStrength === "none") {
        continue;
      }

      const haystack = buildCaseSearchText(testCase);
      const haystackTokens = buildTokenSet(haystack);
      const tokenMatchCount = countExactTokenMatches(unit.tokens, haystackTokens);

      strongestMatchCount = Math.max(strongestMatchCount, tokenMatchCount);
      matchedCaseIds.push(testCase.id);

      if (caseStrength === "strong") {
        strength = "strong";
      } else if (strength === "none") {
        strength = "partial";
      }
    }

    return {
      unit,
      matchedCaseIds,
      strength,
      strongestCaseMatchCount: strongestMatchCount,
    };
  });
}

function findOrphanCaseIds(
  requirementCoverage: RequirementCoverage[],
  cases: TestCase[]
): string[] {
  const mappedCaseIds = new Set(
    requirementCoverage.flatMap((coverage) => coverage.matchedCaseIds)
  );

  return cases
    .filter((testCase) => !mappedCaseIds.has(testCase.id))
    .map((testCase) => testCase.id);
}

function hasScenarioSignal(cases: TestCase[], pattern: RegExp): boolean {
  return cases.some((testCase) =>
    pattern.test(
      [testCase.title, testCase.body, ...(testCase.tags ?? [])]
        .join(" ")
        .toLowerCase()
    )
  );
}

function buildCoveragePoints(requirementCoverage: RequirementCoverage[]): {
  earned: number;
  maximum: number;
} {
  let earned = 0;
  let maximum = 0;

  for (const coverage of requirementCoverage) {
    // M12.19 WHY:
    // Strong coverage should dominate the ratio.
    // Partial coverage earns only a small fraction so unresolved obligations
    // remain visible in score behavior instead of being flattened upward.
    maximum += 4;

    if (coverage.strength === "strong") {
      earned += 4;
      continue;
    }

    if (coverage.strength === "partial") {
      earned += 1;
    }
  }

  return { earned, maximum };
}

function getCoverageCategoryCap(args: {
  baseCap: number;
  totalUnits: number;
  uncoveredUnits: number;
  partialUnits: number;
}): number {
  if (args.totalUnits === 0) return args.baseCap;

  // M12.19 WHY:
  // Top-band category scores should be blocked while explicit unresolved
  // requirement obligations remain. This is deterministic and explainable.
  if (args.uncoveredUnits >= 3) {
    return Math.min(args.baseCap, 16);
  }

  if (args.uncoveredUnits > 0) {
    return Math.min(args.baseCap, 19);
  }

  if (args.partialUnits >= Math.max(5, Math.ceil(args.totalUnits * 0.3))) {
    return Math.min(args.baseCap, 20);
  }

  if (args.partialUnits >= 2) {
    return Math.min(args.baseCap, 22);
  }

  if (args.partialUnits === 1) {
    return Math.min(args.baseCap, 24);
  }

  return args.baseCap;
}

function buildRiskCoverageScore(args: {
  coveragePoints: number;
  maximumCoveragePoints: number;
  orphanCount: number;
  totalCases: number;
  totalUnits: number;
  uncoveredUnits: number;
  partialUnits: number;
}): number {
  if (args.maximumCoveragePoints === 0) {
    return args.totalCases > 0 ? 10 : 0;
  }

  const coverageRatio = args.coveragePoints / args.maximumCoveragePoints;
  const orphanPenalty =
    args.totalCases > 0
      ? Math.min(0.1, args.orphanCount / Math.max(1, args.totalCases * 1.25))
      : 0;

  const adjustedRatio = Math.max(0, coverageRatio - orphanPenalty);
  const rawScore = Math.round(adjustedRatio * 25);

  return Math.min(
    rawScore,
    getCoverageCategoryCap({
      baseCap: 25,
      totalUnits: args.totalUnits,
      uncoveredUnits: args.uncoveredUnits,
      partialUnits: args.partialUnits,
    })
  );
}

function buildBusinessRelevanceScore(args: {
  coveragePoints: number;
  maximumCoveragePoints: number;
  totalUnits: number;
  uncoveredUnits: number;
  partialUnits: number;
}): number {
  if (args.maximumCoveragePoints === 0) return 0;

  const ratio = args.coveragePoints / args.maximumCoveragePoints;
  const rawScore = Math.round(Math.min(1, ratio) * 25);

  return Math.min(
    rawScore,
    getCoverageCategoryCap({
      baseCap: 25,
      totalUnits: args.totalUnits,
      uncoveredUnits: args.uncoveredUnits,
      partialUnits: args.partialUnits,
    })
  );
}

function buildDesignQualityScore(args: {
  duplicateGroupCount: number;
  totalCases: number;
  orphanCount: number;
  uncoveredUnits: number;
}): number {
  if (args.totalCases === 0) return 0;

  let score = 20;

  if (args.duplicateGroupCount > 0) {
    score -= Math.min(8, args.duplicateGroupCount * 3);
  }

  if (args.orphanCount > 0) {
    score -= Math.min(4, args.orphanCount);
  }

  // M12.19 WHY:
  // This remains a structural category, but large uncovered obligation counts
  // should still slightly reduce "design quality" because the suite structure is
  // not proving useful enough to cover the requirement set.
  if (args.uncoveredUnits > 0) {
    score -= Math.min(3, args.uncoveredUnits);
  }

  return Math.max(0, score);
}

function buildLevelAndScopeScore(args: {
  cases: TestCase[];
  uncoveredUnits: number;
  partialUnits: number;
}): number {
  if (!args.cases.length) return 0;

  let score = 0;

  const hasPositive = hasScenarioSignal(args.cases, /\b(valid|success|happy)\b/);
  const hasNegative = hasScenarioSignal(
    args.cases,
    /\b(invalid|error|fail|negative|unauthori[sz]ed|forbidden|denied)\b/
  );
  const hasEdge = hasScenarioSignal(
    args.cases,
    /\b(edge|boundary|limit|max|min|empty|null|blank|expired|duplicate)\b/
  );
  const hasSecurity = hasScenarioSignal(
    args.cases,
    /\b(security|auth|authentication|authorization|unauthori[sz]ed|permission|role)\b/
  );

  if (hasPositive) score += 3;
  if (hasNegative) score += 4;
  if (hasEdge) score += 4;
  if (hasSecurity) score += 2;

  if (args.cases.length >= 15) score += 2;

  // M12.19 WHY:
  // Breadth signals should not reach the top of the band when many obligations
  // are still unresolved. This prevents keyword-rich suites from flattering
  // the total score while requirement coverage is still partial.
  const cappedScore = Math.min(
    score,
    args.uncoveredUnits > 0 ? 11 : args.partialUnits >= 3 ? 13 : 15
  );

  return Math.min(15, cappedScore);
}

function buildDiagnosticValueScore(args: {
  totalCases: number;
  orphanCount: number;
  duplicateGroupCount: number;
  uncoveredUnits: number;
  partialUnits: number;
}): number {
  if (args.totalCases === 0) return 0;

  let score = 15;

  if (args.orphanCount > 0) {
    score -= Math.min(4, args.orphanCount);
  }

  if (args.duplicateGroupCount > 0) {
    score -= Math.min(6, args.duplicateGroupCount * 2);
  }

  // M12.19 WHY:
  // If many units remain partial/uncovered, the suite is not yet delivering
  // fully diagnostic signal, even if it is cleanly structured.
  if (args.uncoveredUnits > 0) {
    score -= Math.min(3, args.uncoveredUnits);
  } else if (args.partialUnits >= 3) {
    score -= 2;
  } else if (args.partialUnits > 0) {
    score -= 1;
  }

  return Math.max(0, score);
}

function buildBreakdown(
  details: DeterministicReviewDetails,
  cases: TestCase[]
): ReviewBreakdown {
  const totalUnits = details.requirementUnits.length;
  const uncoveredUnits = details.uncoveredUnits.length;
  const partialUnits = details.partiallyCoveredUnits.length;

  return {
    businessRelevance: buildBusinessRelevanceScore({
      coveragePoints: details.coveragePoints,
      maximumCoveragePoints: details.maximumCoveragePoints,
      totalUnits,
      uncoveredUnits,
      partialUnits,
    }),
    riskCoverage: buildRiskCoverageScore({
      coveragePoints: details.coveragePoints,
      maximumCoveragePoints: details.maximumCoveragePoints,
      orphanCount: details.orphanCaseIds.length,
      totalCases: details.totalCases,
      totalUnits,
      uncoveredUnits,
      partialUnits,
    }),
    designQuality: buildDesignQualityScore({
      duplicateGroupCount: details.duplicateGroupCount,
      totalCases: details.totalCases,
      orphanCount: details.orphanCaseIds.length,
      uncoveredUnits,
    }),
    levelAndScope: buildLevelAndScopeScore({
      cases,
      uncoveredUnits,
      partialUnits,
    }),
    diagnosticValue: buildDiagnosticValueScore({
      totalCases: details.totalCases,
      orphanCount: details.orphanCaseIds.length,
      duplicateGroupCount: details.duplicateGroupCount,
      uncoveredUnits,
      partialUnits,
    }),
  };
}

function buildRiskGaps(details: DeterministicReviewDetails): string[] {
  const gaps: string[] = [];

  for (const uncovered of details.uncoveredUnits) {
    gaps.push(`Uncovered requirement unit: ${uncovered.label}`);
  }

  for (const partial of details.partiallyCoveredUnits) {
    gaps.push(`Partially covered requirement unit: ${partial.unit.label}`);
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
    !details.partiallyCoveredUnits.length &&
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

  if (details.partiallyCoveredUnits.length > 0) {
    improvements.push(
      "Strengthen partially covered requirement units with more specific or complementary cases"
    );
  }

  if (details.orphanCaseIds.length > 0) {
    improvements.push("Align orphan test cases to requirement intent or remove them");
  }

  if (details.duplicateGroupCount > 0) {
    improvements.push("Deduplicate overlapping cases to improve suite signal quality");
  }

  if (
    !improvements.length &&
    details.totalCases > 0 &&
    (details.coveredUnits.length > 0 || details.partiallyCoveredUnits.length > 0)
  ) {
    improvements.push("Maintain requirement-to-test traceability as the suite evolves");
  }

  if (!improvements.length && details.totalCases === 0) {
    improvements.push("Generate an initial suite from the refined requirement before review");
  }

  return improvements.slice(0, 12);
}

function getUnresolvedRequirementBurden(details: DeterministicReviewDetails): {
  totalUnits: number;
  uncoveredUnits: number;
  partialUnits: number;
  unresolvedUnits: number;
  unresolvedRatio: number;
} {
  const totalUnits = details.requirementUnits.length;
  const uncoveredUnits = details.uncoveredUnits.length;
  const partialUnits = details.partiallyCoveredUnits.length;
  const unresolvedUnits = uncoveredUnits + partialUnits;

  return {
    totalUnits,
    uncoveredUnits,
    partialUnits,
    unresolvedUnits,
    unresolvedRatio: totalUnits > 0 ? unresolvedUnits / totalUnits : 0,
  };
}

function getFinalScoreCap(details: DeterministicReviewDetails): number {
  const burden = getUnresolvedRequirementBurden(details);

  if (burden.totalUnits === 0) return 0;

  // M12.19 WHY:
  // Final-score gating should reflect unresolved obligation burden, not suite size.
  // This prevents "excellent" results while the review still lists many partials.
  if (burden.uncoveredUnits >= 3) return 74;
  if (burden.uncoveredUnits > 0) return 82;

  // M12.19 CONSISTENCY WHY:
  // Many partial units are still open requirement obligations.
  // They should not produce a "Strong" or high-80s result simply because
  // structural categories are clean.
  if (
    burden.partialUnits >= Math.max(8, Math.ceil(burden.totalUnits * 0.4))
  ) {
    return 82;
  }

  if (
    burden.partialUnits >= Math.max(6, Math.ceil(burden.totalUnits * 0.3))
  ) {
    return 84;
  }

  if (burden.partialUnits >= 4) return 87;
  if (burden.partialUnits >= 2) return 91;
  if (burden.partialUnits === 1) return 94;

  return 100;
}

function buildVerdict(
  score: number,
  details: DeterministicReviewDetails
): string {
  const burden = getUnresolvedRequirementBurden(details);

  if (burden.totalUnits === 0) {
    return "Poor - no structured requirement units are available for review";
  }

  if (details.totalCases === 0) {
    return "Poor - no test suite is available for requirement coverage review";
  }

  // M12.19 CONSISTENCY WHY:
  // Verdict language must follow the same unresolved-obligation evidence shown
  // in Top Risk Gaps. This prevents a score/verdict from claiming alignment
  // while the review lists many partial or uncovered units.
  if (burden.uncoveredUnits >= 3) {
    return "Weak - multiple requirement obligations are not covered";
  }

  if (burden.uncoveredUnits > 0) {
    return "Moderate - uncovered requirement obligations remain";
  }

  if (
    burden.partialUnits >= Math.max(8, Math.ceil(burden.totalUnits * 0.4))
  ) {
    return "Moderate - many requirement obligations remain only partially covered";
  }

  if (
    burden.partialUnits >= Math.max(6, Math.ceil(burden.totalUnits * 0.3))
  ) {
    return "Good - coverage is useful but several obligations remain partial";
  }

  if (burden.partialUnits >= 4) {
    return "Good - coverage is progressing but partial obligations remain";
  }

  if (burden.partialUnits > 0) {
    return "Strong - coverage is mostly aligned with minor partial gaps";
  }

  if (score >= 93) {
    return "Excellent - requirement coverage is strongly aligned";
  }

  if (score >= 85) {
    return "Strong - requirement coverage is aligned";
  }

  if (score >= 70) {
    return "Good - requirement coverage is usable with remaining gaps";
  }

  if (score >= 50) {
    return "Moderate - meaningful coverage gaps require attention";
  }

  if (score >= 30) {
    return "Weak - requirement coverage is incomplete";
  }

  return "Poor - review artifacts are not sufficiently aligned";
}

function buildReviewDetails(args: {
  requirement: RefinedRequirement | null | undefined;
  suite: TestSuiteArtifact | null | undefined;
}): { details: DeterministicReviewDetails; cases: TestCase[] } {
  const requirementUnits = buildRequirementUnits(args.requirement);
  const cases = (args.suite?.cases ?? []).map((testCase) =>
    normalizeTestCase(testCase)
  );

  const normalizedSuite: TestSuiteArtifact | null = args.suite
    ? {
        ...args.suite,
        cases,
      }
    : null;

  const requirementCoverage = mapRequirementCoverage(requirementUnits, cases);
  const coveredUnits = requirementCoverage.filter(
    (item) => item.strength === "strong"
  );
  const partiallyCoveredUnits = requirementCoverage.filter(
    (item) => item.strength === "partial"
  );
  const uncoveredUnits = requirementCoverage
    .filter((item) => item.strength === "none")
    .map((item) => item.unit);

  const orphanCaseIds = findOrphanCaseIds(requirementCoverage, cases);
  const validation = validateTestSuite(normalizedSuite);
  const coveragePoints = buildCoveragePoints(requirementCoverage);

  return {
    details: {
      requirementUnits,
      coveredUnits,
      partiallyCoveredUnits,
      uncoveredUnits,
      orphanCaseIds,
      duplicateGroupCount: validation.duplicateGroups.length,
      totalCases: cases.length,
      coveragePoints: coveragePoints.earned,
      maximumCoveragePoints: coveragePoints.maximum,
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

  const rawScore =
    details.requirementUnits.length === 0
      ? 0
      : breakdown.businessRelevance +
        breakdown.riskCoverage +
        breakdown.designQuality +
        breakdown.levelAndScope +
        breakdown.diagnosticValue;

  const score = Math.min(rawScore, getFinalScoreCap(details));

  return {
    score,
    verdict: buildVerdict(score, details),
    breakdown,
    riskGaps: buildRiskGaps(details),
    antiPatterns: buildAntiPatterns(details),
    improvements: buildImprovements(details),
  };
}