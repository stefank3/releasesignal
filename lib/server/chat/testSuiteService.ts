// lib/server/chat/testSuiteService.ts
// M10 extraction:
// Cases-mode parsing, normalization, merge, and rendering logic.
// This keeps persistent suite evolution out of route.ts.

import type {
  SessionArtifact,
  TestCase,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";

/**
 * Normalize titles for lightweight duplicate filtering.
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
 * Parse generated plain-text test cases from the model reply.
 * Expected header:
 *   TC-001 - Title
 * or
 *   TC-001: Title
 */
export function parseGeneratedTestCases(
  text: string
): Array<{ title: string; body: string }> {
  const raw = String(text ?? "").replace(/\r/g, "").trim();
  if (!raw) return [];

  const matches = [...raw.matchAll(/^\s*TC-(\d{1,4})\s*[-–:]\s*(.+)$/gim)];
  if (!matches.length) return [];

  const out: Array<{ title: string; body: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;

    const block = raw.slice(start, end).trim();
    const title = String(match[2] ?? "").trim();

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

  const headers = suite.cases.map((c) => `${c.id} - ${c.title}`);
  const maxCaseNumber = suite.cases.reduce((max, c) => {
    const match = /^TC-(\d{1,4})$/i.exec(String(c.id ?? "").trim());
    const n = match ? Number(match[1]) : 0;
    return Math.max(max, n);
  }, 0);

  return {
    suiteSummary: headers.join("\n"),
    maxCaseNumber,
    existingCount: suite.cases.length,
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
} {
  const parsed = parseGeneratedTestCases(args.generatedText);
  if (!parsed.length) {
    return {
      nextSuite: args.explicitReset ? null : args.existingSuite,
      addedCount: 0,
    };
  }

  const nowIso = new Date().toISOString();

  if (args.explicitReset || !args.existingSuite) {
    const freshCases: TestCase[] = parsed.map((c, idx) => {
      const caseId = `TC-${String(idx + 1).padStart(3, "0")}`;
      return {
        id: caseId,
        title: c.title,
        body: buildNormalizedCaseBody(caseId, c.title, c.body),
      };
    });

    return {
      nextSuite: {
        version: 1,
        cases: freshCases,
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
      },
      addedCount: freshCases.length,
    };
  }

  const existingSuite = args.existingSuite;
  const existingKeys = new Set(existingSuite.cases.map((c) => normalizeCaseTitle(c.title)));

  let nextNumber =
    existingSuite.cases.reduce((max, c) => {
      const match = /^TC-(\d{1,4})$/i.exec(String(c.id ?? "").trim());
      const n = match ? Number(match[1]) : 0;
      return Math.max(max, n);
    }, 0) + 1;

  const appended: TestCase[] = [];

  for (const generated of parsed) {
    const key = normalizeCaseTitle(generated.title);
    if (!key) continue;
    if (existingKeys.has(key)) continue;

    const caseId = `TC-${String(nextNumber).padStart(3, "0")}`;
    nextNumber += 1;
    existingKeys.add(key);

    appended.push({
      id: caseId,
      title: generated.title,
      body: buildNormalizedCaseBody(caseId, generated.title, generated.body),
    });
  }

  if (!appended.length) {
    return {
      nextSuite: existingSuite,
      addedCount: 0,
    };
  }

  return {
    nextSuite: {
      ...existingSuite,
      version: existingSuite.version + 1,
      cases: [...existingSuite.cases, ...appended],
      lastUpdatedAt: nowIso,
    },
    addedCount: appended.length,
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
    existingArtifact && typeof existingArtifact === "object" ? existingArtifact : {};

  return {
    ...(prev.refinedRequirement ? { refinedRequirement: prev.refinedRequirement } : {}),
    testSuite,
  };
}

/**
 * Render the persisted suite for the user.
 */
export function renderTestSuiteForUser(suite: TestSuiteArtifact): string {
  const lines: string[] = [];

  lines.push(`Test Suite v${suite.version}`);
  lines.push(`Total test cases: ${suite.cases.length}`);
  lines.push("");

  for (let i = 0; i < suite.cases.length; i++) {
    lines.push(suite.cases[i].body.trim());
    if (i < suite.cases.length - 1) lines.push("");
  }

  return lines.join("\n").trim();
}