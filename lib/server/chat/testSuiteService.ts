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

import type {
  SessionArtifact,
  TestCase,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  buildTestCaseSignature,
  normalizeTestCase,
} from "@/lib/chat/artifact";

export type TestSuiteDiffSummary = {
  previousVersion: number | null;
  nextVersion: number | null;
  addedCaseIds: string[];
  addedCount: number;
  duplicateSkippedCount: number;
  unchanged: boolean;
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

    if (!title || !block) continue;
    out.push({ title, body: block });
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