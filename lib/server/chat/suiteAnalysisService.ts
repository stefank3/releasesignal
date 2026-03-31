// lib/server/chat/suiteAnalysisService.ts
// M12 Step 6 — Suite Analysis Engine
//
// Purpose:
// Analyze the current test suite artifact and produce structured,
// deterministic insights about coverage, duplication, and gaps.
//
// Rules:
// - NO UI logic
// - NO string parsing of raw text
// - ONLY artifact-driven analysis
// - deterministic output (no AI randomness)

import type { TestSuiteArtifact, TestCase } from "@/lib/chat/artifact";
import {
  buildTestCaseSignature,
  normalizeTestCase,
  validateTestSuite,
} from "@/lib/chat/artifact";

export type SuiteAnalysis = {
  coverageLevel: "low" | "medium" | "high";
  duplicateRisk: "low" | "medium" | "high";
  missingAreas: string[];
  suggestions: string[];
  warnings: string[];
};

function getNormalizedCases(suite: TestSuiteArtifact): TestCase[] {
  return suite.cases.map((c) => normalizeTestCase(c));
}

function calculateCoverageLevel(caseCount: number): SuiteAnalysis["coverageLevel"] {
  if (caseCount < 5) return "low";
  if (caseCount < 15) return "medium";
  return "high";
}

function calculateDuplicateRisk(
  duplicateGroupsCount: number,
  totalCases: number
): SuiteAnalysis["duplicateRisk"] {
  if (totalCases === 0) return "low";

  const ratio = duplicateGroupsCount / totalCases;

  if (ratio === 0) return "low";
  if (ratio < 0.2) return "medium";
  return "high";
}

function detectMissingAreas(cases: TestCase[]): string[] {
  const titles = cases.map((c) => c.title.toLowerCase());

  const signals = {
    positive: titles.some((t) => /valid|success|happy/.test(t)),
    negative: titles.some((t) => /invalid|error|fail/.test(t)),
    edge: titles.some((t) => /edge|boundary|limit/.test(t)),
  };

  const missing: string[] = [];

  if (!signals.positive) {
    missing.push("Positive (happy path) scenarios are missing");
  }

  if (!signals.negative) {
    missing.push("Negative/error scenarios are missing");
  }

  if (!signals.edge) {
    missing.push("Edge/boundary scenarios are missing");
  }

  return missing;
}

function buildSuggestions(args: {
  coverageLevel: SuiteAnalysis["coverageLevel"];
  duplicateRisk: SuiteAnalysis["duplicateRisk"];
  missingAreas: string[];
}): string[] {
  const suggestions: string[] = [];

  if (args.coverageLevel === "low") {
    suggestions.push("Generate more test cases to improve coverage");
  }

  if (args.duplicateRisk !== "low") {
    suggestions.push("Review and remove duplicate or overlapping test cases");
  }

  if (args.missingAreas.length > 0) {
    suggestions.push("Add cases to cover missing scenario types");
  }

  if (suggestions.length === 0) {
    suggestions.push("Test suite is in a good state");
  }

  return suggestions;
}

function buildWarnings(validation: ReturnType<typeof validateTestSuite>): string[] {
  const warnings: string[] = [];

  if (validation.hasDuplicates) {
    warnings.push("Duplicate test cases detected in suite");
  }

  if (validation.totalCases === 0) {
    warnings.push("Test suite is empty");
  }

  return warnings;
}

export function analyzeTestSuite(
  suite: TestSuiteArtifact | null
): SuiteAnalysis | null {
  if (!suite || !suite.cases?.length) {
    return {
      coverageLevel: "low",
      duplicateRisk: "low",
      missingAreas: ["No test cases available"],
      suggestions: ["Generate initial test cases"],
      warnings: ["Empty test suite"],
    };
  }

  const cases = getNormalizedCases(suite);

  const validation = validateTestSuite(suite);

  const coverageLevel = calculateCoverageLevel(cases.length);

  const duplicateRisk = calculateDuplicateRisk(
    validation.duplicateGroups.length,
    cases.length
  );

  const missingAreas = detectMissingAreas(cases);

  const suggestions = buildSuggestions({
    coverageLevel,
    duplicateRisk,
    missingAreas,
  });

  const warnings = buildWarnings(validation);

  return {
    coverageLevel,
    duplicateRisk,
    missingAreas,
    suggestions,
    warnings,
  };
}