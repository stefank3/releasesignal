// lib/server/chat/testSuiteService.ts
// M10 extraction:
// Cases-mode parsing, normalization, merge, and rendering logic.
// This keeps persistent suite evolution out of route.ts.
//
// M12 Step 5 CHANGE:
// - use shared artifact normalization helpers
// - enforce deterministic duplicate-aware merge behavior
// - normalize cases before persist/render
// - keep merge logic artifact-based and predictable
// - add suite diff summary groundwork for change awareness
//
// BUG FIX (M12.8):
// - harden pasted suite parsing for review-mode standalone ingestion
// - normalize collapsed headers before parsing
// - split deterministically on TC headers instead of relying only on matchAll slices
//
// M12.9 Phase 2 CHANGE:
// - add deterministic Next Batch service helpers
// - validate requirement + existing suite prerequisites explicitly
// - keep next-batch flow append-only
// - return explicit no-op message when no new cases survive dedupe
// - avoid route/UI-owned next-batch baseline logic
//
// M12.9 Phase 2 FIX:
// - add strict regenerate-suite replacement helper
// - reject malformed/incomplete regenerated cases before persistence
// - keep regenerate distinct from append-only next-batch behavior
// - drop malformed regenerated cases instead of failing the entire replacement
// - dedupe regenerated replacement cases deterministically
// - renumber cleaned replacement suite from TC-001

import type {
  SessionArtifact,
  TestCase,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  buildTestCaseSignature,
  normalizeMultilineText,
  normalizeTestCase,
  normalizeWhitespace,
} from "@/lib/chat/artifact";

export type TestSuiteDiffSummary = {
  previousVersion: number | null;
  nextVersion: number | null;
  addedCaseIds: string[];
  addedCount: number;
  duplicateSkippedCount: number;
  unchanged: boolean;
};

export type NextBatchPrerequisiteResult =
  | {
      ok: true;
      requirementText: string;
      existingSuite: TestSuiteArtifact;
    }
  | {
      ok: false;
      reason: "missing_requirement" | "missing_suite";
      message: string;
    };

export type NextBatchBaseline = {
  requirementText: string;
  suiteSummary: string;
  existingCount: number;
  maxCaseNumber: number;
};

export type NextBatchMergeResult =
  | {
      ok: true;
      kind: "appended";
      nextSuite: TestSuiteArtifact;
      addedCount: number;
      diffSummary: TestSuiteDiffSummary;
      message: string;
    }
  | {
      ok: true;
      kind: "no_changes";
      nextSuite: TestSuiteArtifact;
      addedCount: 0;
      diffSummary: TestSuiteDiffSummary;
      message: "No additional coverage gaps identified";
    }
  | {
      ok: false;
      kind: "invalid_prerequisites" | "generation_failed";
      message: string;
    };

export type RegenerateSuiteResult =
  | {
      ok: true;
      kind: "replaced";
      nextSuite: TestSuiteArtifact;
      replacedCount: number;
      diffSummary: TestSuiteDiffSummary;
      message: string;
    }
  | {
      ok: false;
      kind: "invalid_prerequisites" | "generation_failed";
      message: string;
    };

/**
 * Normalize titles for lightweight duplicate filtering.
 * Kept for compatibility with older callers, but Step 5 merge safety
 * now relies on shared artifact signature logic.
 */
export function normalizeCaseTitle(title: string): string {
  return String(title ?? "")
    .toLowerCase()
    .replace(/^tc-\d{1,4}\s*[-–:]\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize pasted suite text so collapsed headers still become parseable.
 */
function normalizePastedSuiteText(text: string): string {
  return String(text ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(
      /([^\n])(\s+)(TC-\d{1,4}\s*[-–:])/gi,
      (_, before: string, _ws: string, header: string) => `${before}\n${header}`
    )
    .trim();
}

/**
 * Parse generated plain-text test cases from the model reply or pasted suite.
 * Expected header:
 *   TC-001 - Title
 * or
 *   TC-001: Title
 *
 * Structural minimum for accepted cases:
 * - Type
 * - Priority
 * - Preconditions
 * - Test Steps or Steps
 * - Expected Result / Expected Results
 */
export function parseGeneratedTestCases(
  text: string
): Array<{ title: string; body: string }> {
  const raw = normalizePastedSuiteText(text);
  if (!raw) return [];

  const headerRegex = /^\s*TC-\d{1,4}\s*[-–:]\s*.+$/gim;
  const headerMatches = [...raw.matchAll(headerRegex)];
  if (!headerMatches.length) return [];

  const blocks = raw
    .split(/(?=^\s*TC-\d{1,4}\s*[-–:]\s*.+$)/gim)
    .map((block) => block.trim())
    .filter((block) => /^\s*TC-\d{1,4}\s*[-–:]\s*.+$/im.test(block));

  const out: Array<{ title: string; body: string }> = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const headerLine = String(lines[0] ?? "").trim();
    const titleMatch = headerLine.match(/^\s*TC-\d{1,4}\s*[-–:]\s*(.+)$/i);
    const title = String(titleMatch?.[1] ?? "").trim();
    const normalizedBlock = block.trim();

    const hasType = /(^|\n)\s*Type\s*:/i.test(normalizedBlock);
    const hasPriority = /(^|\n)\s*Priority\s*:/i.test(normalizedBlock);
    const hasPreconditions = /(^|\n)\s*Preconditions\s*:/i.test(normalizedBlock);
    const hasSteps =
      /(^|\n)\s*Test Steps\s*:/i.test(normalizedBlock) ||
      /(^|\n)\s*Steps\s*:/i.test(normalizedBlock);
    const hasExpected =
      /(^|\n)\s*Expected Result(s)?\s*:/i.test(normalizedBlock);

    if (
      !title ||
      !normalizedBlock ||
      !hasType ||
      !hasPriority ||
      !hasPreconditions ||
      !hasSteps ||
      !hasExpected
    ) {
      continue;
    }

    out.push({ title, body: normalizedBlock });
  }

  return out;
}

/**
 * Rebuild case body with deterministic numbering.
 */
export function buildNormalizedCaseBody(
  caseId: string,
  title: string,
  rawBody: string
): string {
  const cleaned = String(rawBody ?? "").replace(/\r/g, "").trim();
  const lines = cleaned.split("\n");
  const normalizedHeader = `${caseId} - ${title}`;

  if (lines.length === 0) return normalizedHeader;

  if (/^\s*TC-\d{1,4}\s*[-–:]\s*/i.test(lines[0] ?? "")) {
    lines[0] = normalizedHeader;
    return lines.join("\n").trim();
  }

  return `${normalizedHeader}\n${cleaned}`.trim();
}

function buildStructuredCase(
  caseId: string,
  title: string,
  rawBody: string
): TestCase {
  return normalizeTestCase({
    id: caseId,
    title,
    body: buildNormalizedCaseBody(caseId, title, rawBody),
  });
}

function getMaxCaseNumber(cases: TestCase[]): number {
  return cases.reduce((max, c) => {
    const match = /^TC-(\d{1,4})$/i.exec(String(c.id ?? "").trim());
    const n = match ? Number(match[1]) : 0;
    return Math.max(max, n);
  }, 0);
}

function buildExistingSignatureSet(cases: TestCase[]): Set<string> {
  return new Set(
    cases
      .map((c) => buildTestCaseSignature(normalizeTestCase(c)))
      .filter(Boolean)
  );
}

function buildEmptyDiffSummary(): TestSuiteDiffSummary {
  return {
    previousVersion: null,
    nextVersion: null,
    addedCaseIds: [],
    addedCount: 0,
    duplicateSkippedCount: 0,
    unchanged: false,
  };
}

function normalizeRequirementText(text: string | null | undefined): string {
  return String(text ?? "").replace(/\r/g, "").trim();
}

function isMalformedReplacementCase(testCase: TestCase): boolean {
  const normalized = normalizeTestCase(testCase);
  const body = normalizeMultilineText(normalized.body);
  const title = normalizeWhitespace(normalized.title);

  const hasType = /(^|\n)\s*Type\s*:/i.test(body);
  const hasPriority = /(^|\n)\s*Priority\s*:/i.test(body);
  const hasPreconditions = /(^|\n)\s*Preconditions\s*:/i.test(body);
  const hasSteps =
    /(^|\n)\s*Test Steps\s*:/i.test(body) ||
    /(^|\n)\s*Steps\s*:/i.test(body);
  const hasExpected = /(^|\n)\s*Expected Result(s)?\s*:/i.test(body);

  const suspiciousShortTitle = title.length < 12;
  const suspiciousTruncatedEnding =
    /(when|if|with|without|and|or|observe)$/i.test(title);

  return (
    !title ||
    !body ||
    !hasType ||
    !hasPriority ||
    !hasPreconditions ||
    !hasSteps ||
    !hasExpected ||
    suspiciousShortTitle ||
    suspiciousTruncatedEnding
  );
}

function sanitizeReplacementCases(parsed: Array<{ title: string; body: string }>): {
  cases: TestCase[];
  malformedDroppedCount: number;
  duplicateSkippedCount: number;
} {
  const cases: TestCase[] = [];
  const signatures = new Set<string>();

  let malformedDroppedCount = 0;
  let duplicateSkippedCount = 0;

  for (const candidate of parsed) {
    const tempCase = buildStructuredCase("TC-000", candidate.title, candidate.body);

    if (isMalformedReplacementCase(tempCase)) {
      malformedDroppedCount += 1;
      continue;
    }

    const signature = buildTestCaseSignature(tempCase);
    if (!signature) {
      malformedDroppedCount += 1;
      continue;
    }

    if (signatures.has(signature)) {
      duplicateSkippedCount += 1;
      continue;
    }

    signatures.add(signature);
    cases.push(tempCase);
  }

  const renumberedCases = cases.map((c, idx) => {
    const caseId = `TC-${String(idx + 1).padStart(3, "0")}`;
    return buildStructuredCase(caseId, c.title, c.body);
  });

  return {
    cases: renumberedCases,
    malformedDroppedCount,
    duplicateSkippedCount,
  };
}

/**
 * Build baseline summary directly from persisted artifact suite.
 */
export function buildExistingSuiteBaselineFromArtifact(
  suite: TestSuiteArtifact | null
): {
  suiteSummary: string | null;
  maxCaseNumber: number;
  existingCount: number;
} {
  if (!suite?.cases?.length) {
    return {
      suiteSummary: null,
      maxCaseNumber: 0,
      existingCount: 0,
    };
  }

  const normalizedCases = suite.cases.map((c) => normalizeTestCase(c));
  const headers = normalizedCases.map((c) => `${c.id} - ${c.title}`);

  return {
    suiteSummary: headers.join("\n"),
    maxCaseNumber: getMaxCaseNumber(normalizedCases),
    existingCount: normalizedCases.length,
  };
}

/**
 * Validate artifact prerequisites for Next Batch generation.
 * Requirement + suite must both exist.
 */
export function validateNextBatchPrerequisites(args: {
  requirementText: string | null | undefined;
  existingSuite: TestSuiteArtifact | null;
}): NextBatchPrerequisiteResult {
  const requirementText = normalizeRequirementText(args.requirementText);

  if (!requirementText) {
    return {
      ok: false,
      reason: "missing_requirement",
      message: "Generate Next Batch requires a refined requirement artifact.",
    };
  }

  if (!args.existingSuite?.cases?.length) {
    return {
      ok: false,
      reason: "missing_suite",
      message: "Generate Next Batch requires an existing test suite artifact.",
    };
  }

  return {
    ok: true,
    requirementText,
    existingSuite: {
      ...args.existingSuite,
      cases: args.existingSuite.cases.map((c) => normalizeTestCase(c)),
    },
  };
}

/**
 * Build deterministic baseline payload for Next Batch prompting.
 * This keeps route logic thin and artifact-driven.
 */
export function buildNextBatchBaseline(args: {
  requirementText: string;
  existingSuite: TestSuiteArtifact;
}): NextBatchBaseline {
  const normalizedRequirementText = normalizeRequirementText(args.requirementText);
  const suiteBaseline = buildExistingSuiteBaselineFromArtifact(args.existingSuite);

  return {
    requirementText: normalizedRequirementText,
    suiteSummary: suiteBaseline.suiteSummary ?? "",
    existingCount: suiteBaseline.existingCount,
    maxCaseNumber: suiteBaseline.maxCaseNumber,
  };
}

/**
 * Merge generated cases into persisted suite workspace.
 */
export function mergeGeneratedCasesIntoSuite(args: {
  existingSuite: TestSuiteArtifact | null;
  generatedText: string;
  explicitReset: boolean;
}): {
  nextSuite: TestSuiteArtifact | null;
  addedCount: number;
  diffSummary: TestSuiteDiffSummary;
} {
  const parsed = parseGeneratedTestCases(args.generatedText);
  if (!parsed.length) {
    const previousVersion = args.existingSuite?.version ?? null;
    const nextVersion = args.explicitReset
      ? null
      : args.existingSuite?.version ?? null;

    return {
      nextSuite: args.explicitReset ? null : args.existingSuite,
      addedCount: 0,
      diffSummary: {
        ...buildEmptyDiffSummary(),
        previousVersion,
        nextVersion,
        unchanged: !!args.existingSuite && !args.explicitReset,
      },
    };
  }

  const nowIso = new Date().toISOString();

  if (args.explicitReset || !args.existingSuite) {
    const freshCases: TestCase[] = parsed.map((c, idx) => {
      const caseId = `TC-${String(idx + 1).padStart(3, "0")}`;
      return buildStructuredCase(caseId, c.title, c.body);
    });

    return {
      nextSuite: {
        version: 1,
        cases: freshCases,
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
      },
      addedCount: freshCases.length,
      diffSummary: {
        previousVersion: args.existingSuite?.version ?? null,
        nextVersion: 1,
        addedCaseIds: freshCases.map((c) => c.id),
        addedCount: freshCases.length,
        duplicateSkippedCount: 0,
        unchanged: false,
      },
    };
  }

  const existingSuite = args.existingSuite;
  const normalizedExistingCases = existingSuite.cases.map((c) =>
    normalizeTestCase(c)
  );
  const existingSignatures = buildExistingSignatureSet(normalizedExistingCases);

  let nextNumber = getMaxCaseNumber(normalizedExistingCases) + 1;

  const appended: TestCase[] = [];
  let duplicateSkippedCount = 0;

  for (const generated of parsed) {
    const caseId = `TC-${String(nextNumber).padStart(3, "0")}`;
    const candidate = buildStructuredCase(caseId, generated.title, generated.body);
    const signature = buildTestCaseSignature(candidate);

    if (!signature) continue;

    if (existingSignatures.has(signature)) {
      duplicateSkippedCount += 1;
      continue;
    }

    nextNumber += 1;
    existingSignatures.add(signature);
    appended.push(candidate);
  }

  if (!appended.length) {
    return {
      nextSuite: {
        ...existingSuite,
        cases: normalizedExistingCases,
      },
      addedCount: 0,
      diffSummary: {
        previousVersion: existingSuite.version,
        nextVersion: existingSuite.version,
        addedCaseIds: [],
        addedCount: 0,
        duplicateSkippedCount,
        unchanged: true,
      },
    };
  }

  return {
    nextSuite: {
      ...existingSuite,
      version: existingSuite.version + 1,
      cases: [...normalizedExistingCases, ...appended],
      lastUpdatedAt: nowIso,
    },
    addedCount: appended.length,
    diffSummary: {
      previousVersion: existingSuite.version,
      nextVersion: existingSuite.version + 1,
      addedCaseIds: appended.map((c) => c.id),
      addedCount: appended.length,
      duplicateSkippedCount,
      unchanged: false,
    },
  };
}

/**
 * Append-only merge path for Generate Next Batch.
 * Unlike generic merge, this action never resets and always returns an
 * explicit no-op message when nothing new survives parsing/dedupe.
 */
export function mergeNextBatchIntoSuite(args: {
  requirementText: string | null | undefined;
  existingSuite: TestSuiteArtifact | null;
  generatedText: string;
}): NextBatchMergeResult {
  const prerequisite = validateNextBatchPrerequisites({
    requirementText: args.requirementText,
    existingSuite: args.existingSuite,
  });

  if (!prerequisite.ok) {
    return {
      ok: false,
      kind: "invalid_prerequisites",
      message: prerequisite.message,
    };
  }

  const parsed = parseGeneratedTestCases(args.generatedText);
  if (!parsed.length) {
    return {
      ok: true,
      kind: "no_changes",
      nextSuite: prerequisite.existingSuite,
      addedCount: 0,
      diffSummary: {
        previousVersion: prerequisite.existingSuite.version,
        nextVersion: prerequisite.existingSuite.version,
        addedCaseIds: [],
        addedCount: 0,
        duplicateSkippedCount: 0,
        unchanged: true,
      },
      message: "No additional coverage gaps identified",
    };
  }

  const merged = mergeGeneratedCasesIntoSuite({
    existingSuite: prerequisite.existingSuite,
    generatedText: args.generatedText,
    explicitReset: false,
  });

  if (!merged.nextSuite) {
    return {
      ok: false,
      kind: "generation_failed",
      message: "Next batch generation failed to produce a valid test suite.",
    };
  }

  if (merged.addedCount === 0) {
    return {
      ok: true,
      kind: "no_changes",
      nextSuite: merged.nextSuite,
      addedCount: 0,
      diffSummary: merged.diffSummary,
      message: "No additional coverage gaps identified",
    };
  }

  return {
    ok: true,
    kind: "appended",
    nextSuite: merged.nextSuite,
    addedCount: merged.addedCount,
    diffSummary: merged.diffSummary,
    message: `Added ${merged.addedCount} new test case${
      merged.addedCount === 1 ? "" : "s"
    } to the existing suite.`,
  };
}

/**
 * Strict replacement path for Improve / Regenerate Suite.
 * This action replaces the suite with a cleaned regenerated version:
 * - malformed regenerated cases are dropped
 * - exact duplicate regenerated cases are dropped
 * - remaining valid cases are renumbered cleanly from TC-001
 */
export function regenerateSuiteFromGeneratedText(args: {
  requirementText: string | null | undefined;
  existingSuite: TestSuiteArtifact | null;
  generatedText: string;
}): RegenerateSuiteResult {
  const prerequisite = validateNextBatchPrerequisites({
    requirementText: args.requirementText,
    existingSuite: args.existingSuite,
  });

  if (!prerequisite.ok) {
    return {
      ok: false,
      kind: "invalid_prerequisites",
      message: prerequisite.message,
    };
  }

  const parsed = parseGeneratedTestCases(args.generatedText);
  if (!parsed.length) {
    return {
      ok: false,
      kind: "generation_failed",
      message:
        "Regenerate suite failed to produce a structurally valid replacement suite.",
    };
  }

  const cleaned = sanitizeReplacementCases(parsed);
  if (!cleaned.cases.length) {
    return {
      ok: false,
      kind: "generation_failed",
      message:
        "Regenerate suite produced only malformed or duplicate replacement cases.",
    };
  }

  const nowIso = new Date().toISOString();

  const nextSuite: TestSuiteArtifact = {
    version: prerequisite.existingSuite.version + 1,
    cases: cleaned.cases,
    createdAt: prerequisite.existingSuite.createdAt,
    lastUpdatedAt: nowIso,
  };

  const removalNotes: string[] = [];
  if (cleaned.malformedDroppedCount > 0) {
    removalNotes.push(
      `${cleaned.malformedDroppedCount} malformed case${
        cleaned.malformedDroppedCount === 1 ? "" : "s"
      } removed`
    );
  }
  if (cleaned.duplicateSkippedCount > 0) {
    removalNotes.push(
      `${cleaned.duplicateSkippedCount} duplicate case${
        cleaned.duplicateSkippedCount === 1 ? "" : "s"
      } removed`
    );
  }

  return {
    ok: true,
    kind: "replaced",
    nextSuite,
    replacedCount: cleaned.cases.length,
    diffSummary: {
      previousVersion: prerequisite.existingSuite.version,
      nextVersion: prerequisite.existingSuite.version + 1,
      addedCaseIds: cleaned.cases.map((c) => c.id),
      addedCount: cleaned.cases.length,
      duplicateSkippedCount: cleaned.duplicateSkippedCount,
      unchanged: false,
    },
    message: removalNotes.length
      ? `Regenerated suite with ${cleaned.cases.length} clean test case${
          cleaned.cases.length === 1 ? "" : "s"
        } (${removalNotes.join(", ")}).`
      : `Regenerated suite with ${cleaned.cases.length} clean test case${
          cleaned.cases.length === 1 ? "" : "s"
        }.`,
  };
}

/**
 * Preserve refinedRequirement while writing updated testSuite.
 */
export function withUpdatedTestSuiteArtifact(
  existingArtifact: SessionArtifact | null,
  testSuite: TestSuiteArtifact
): SessionArtifact {
  const prev: SessionArtifact =
    existingArtifact && typeof existingArtifact === "object"
      ? existingArtifact
      : {};

  return {
    ...(prev.refinedRequirement
      ? { refinedRequirement: prev.refinedRequirement }
      : {}),
    ...(prev.reviewResult ? { reviewResult: prev.reviewResult } : {}),
    ...(prev.featureWorkspace ? { featureWorkspace: prev.featureWorkspace } : {}),
    testSuite: {
      ...testSuite,
      cases: testSuite.cases.map((c) => normalizeTestCase(c)),
    },
  };
}

/**
 * Render the persisted suite for the user.
 */
export function renderTestSuiteForUser(suite: TestSuiteArtifact): string {
  const normalizedCases = suite.cases.map((c) => normalizeTestCase(c));
  const lines: string[] = [];

  lines.push(`Test Suite v${suite.version}`);
  lines.push(`Total test cases: ${normalizedCases.length}`);
  lines.push("");

  for (let i = 0; i < normalizedCases.length; i++) {
    lines.push(normalizedCases[i].body.trim());
    if (i < normalizedCases.length - 1) lines.push("");
  }

  return lines.join("\n").trim();
}