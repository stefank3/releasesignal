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
//
// M12.17 CHANGE:
// - parse generated cases into safe structured artifact fields
// - preserve backward-compatible body rendering
// - keep body-driven UI labels for Type/Priority unchanged
// - only persist type/priority when they already match the locked artifact enum
//
// M14 CHANGE:
// - add explicit uploaded-suite ingestion helpers
// - support only locked initial file formats: txt, md, csv
// - keep uploaded suite parsing separate from requirement truth
// - return explicit invalid-suite failures instead of silently accepting malformed files

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
import type { UploadedSuiteFormat } from "@/lib/chat/chatTypes";

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

export type UploadedSuiteParseResult =
  | {
      ok: true;
      format: UploadedSuiteFormat;
      parsedCases: ParsedGeneratedCase[];
    }
  | {
      ok: false;
      format: UploadedSuiteFormat;
      reason: "unsupported_format" | "invalid_suite";
      message: string;
    };

export type UploadedSuiteIngestionResult =
  | {
      ok: true;
      format: UploadedSuiteFormat;
      nextSuite: TestSuiteArtifact;
      parsedCount: number;
      message: string;
    }
  | {
      ok: false;
      format: UploadedSuiteFormat;
      reason: "unsupported_format" | "invalid_suite";
      message: string;
    };

type ParsedGeneratedCase = {
  title: string;
  body: string;
  priority?: TestCase["priority"];
  type?: TestCase["type"];
  preconditions?: string[];
  steps?: string[];
  expectedResults?: string[];
  tags?: string[];
  notes?: string;
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
 * WHY:
 * M12.17 stores richer structured arrays without changing the persisted
 * TestSuite contract. These helpers stay local to the service so UI
 * behavior remains body-driven and unchanged.
 */
function cleanupStructuredItem(value: string): string {
  return normalizeWhitespace(String(value ?? "").replace(/^[-*•\d.)\s]+/, ""));
}

function normalizeStructuredItems(items: string[]): string[] {
  return Array.from(
    new Set(items.map((item) => cleanupStructuredItem(item)).filter(Boolean))
  );
}

function splitInlineOrBulletedValue(value: string): string[] {
  const normalized = normalizeMultilineText(value);
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => cleanupStructuredItem(line))
    .filter(Boolean);

  if (lines.length > 1) {
    return normalizeStructuredItems(lines);
  }

  return normalizeStructuredItems(
    normalized
      .split(/,|\s\|\s|\s\/\s/g)
      .map((part) => cleanupStructuredItem(part))
      .filter(Boolean)
  );
}

function extractSectionValue(block: string, labels: string[]): string {
  const normalizedBlock = normalizeMultilineText(block);
  if (!normalizedBlock) return "";

  const escapedLabels = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  const allLabelsPattern = [
    ...new Set([
      "Type",
      "Priority",
      "Preconditions",
      "Test Steps",
      "Steps",
      "Expected Result",
      "Expected Results",
      "Tags",
      "Notes",
      ...labels,
    ]),
  ]
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const sectionPattern = new RegExp(
    `(?:^|\\n)\\s*(?:${escapedLabels.join("|")})\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${allLabelsPattern})\\s*:|$)`,
    "i"
  );

  const match = normalizedBlock.match(sectionPattern);
  return normalizeMultilineText(match?.[1] ?? "");
}

/**
 * WHY:
 * Only persist priority when the generated body already uses the locked
 * artifact enum. Current UI may display "High/Medium/Low" from body text,
 * and that should remain body-only until explicitly redesigned.
 */
function normalizePriority(value: string): TestCase["priority"] | undefined {
  const normalized = normalizeWhitespace(value).toUpperCase();
  if (normalized === "P0") return "P0";
  if (normalized === "P1") return "P1";
  if (normalized === "P2") return "P2";
  return undefined;
}

/**
 * WHY:
 * Only persist type when the generated body already uses the locked
 * artifact enum. Current UI may display "Positive/Negative" from body text,
 * and that should remain body-only until explicitly redesigned.
 */
function normalizeCaseType(value: string): TestCase["type"] | undefined {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (normalized === "ui") return "UI";
  if (normalized === "api") return "API";
  if (normalized === "integration") return "Integration";
  if (normalized === "e2e") return "E2E";
  return undefined;
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
 *
 * M12.17:
 * Extract safe structured fields from the case body while preserving the
 * body text as the backward-compatible rendering surface.
 */
export function parseGeneratedTestCases(text: string): ParsedGeneratedCase[] {
  const raw = normalizePastedSuiteText(text);
  if (!raw) return [];

  const headerRegex = /^\s*TC-\d{1,4}\s*[-–:]\s*.+$/gim;
  const headerMatches = [...raw.matchAll(headerRegex)];
  if (!headerMatches.length) return [];

  const blocks = raw
    .split(/(?=^\s*TC-\d{1,4}\s*[-–:]\s*.+$)/gim)
    .map((block) => block.trim())
    .filter((block) => /^\s*TC-\d{1,4}\s*[-–:]\s*.+$/im.test(block));

  const out: ParsedGeneratedCase[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const headerLine = String(lines[0] ?? "").trim();
    const titleMatch = headerLine.match(/^\s*TC-\d{1,4}\s*[-–:]\s*(.+)$/i);
    const title = String(titleMatch?.[1] ?? "").trim();
    const normalizedBlock = block.trim();

    const typeValue = extractSectionValue(normalizedBlock, ["Type"]);
    const priorityValue = extractSectionValue(normalizedBlock, ["Priority"]);
    const preconditionsValue = extractSectionValue(normalizedBlock, ["Preconditions"]);
    const stepsValue = extractSectionValue(normalizedBlock, ["Test Steps", "Steps"]);
    const expectedValue = extractSectionValue(normalizedBlock, [
      "Expected Results",
      "Expected Result",
    ]);
    const tagsValue = extractSectionValue(normalizedBlock, ["Tags"]);
    const notesValue = extractSectionValue(normalizedBlock, ["Notes"]);

    const hasType = !!typeValue;
    const hasPriority = !!priorityValue;
    const hasPreconditions = !!preconditionsValue;
    const hasSteps = !!stepsValue;
    const hasExpected = !!expectedValue;

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

    out.push({
      title,
      body: normalizedBlock,

      // WHY:
      // Persist only enum-safe values. Non-enum labels such as Positive,
      // Negative, High, etc remain preserved in body for the current UI.
      ...(normalizeCaseType(typeValue)
        ? { type: normalizeCaseType(typeValue) }
        : {}),
      ...(normalizePriority(priorityValue)
        ? { priority: normalizePriority(priorityValue) }
        : {}),

      preconditions: splitInlineOrBulletedValue(preconditionsValue),
      steps: splitInlineOrBulletedValue(stepsValue),
      expectedResults: splitInlineOrBulletedValue(expectedValue),
      ...(tagsValue ? { tags: splitInlineOrBulletedValue(tagsValue) } : {}),
      ...(notesValue ? { notes: notesValue } : {}),
    });
  }

  return out;
}

/**
 * M14:
 * Parse CSV text into rows while respecting quoted commas and quoted newlines.
 * Keep this parser deterministic and narrow.
 *
 * IMPORTANT:
 * Do not normalize cell content while scanning characters.
 * Parse first, normalize later.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const normalized = String(text ?? "").replace(/\r/g, "");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentCell);

      const normalizedRow = currentRow.map((cell) =>
        normalizeWhitespace(String(cell ?? ""))
      );

      const hasMeaningfulCell = normalizedRow.some((cell) => cell.trim().length > 0);
      if (hasMeaningfulCell) {
        rows.push(normalizedRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  const normalizedRow = currentRow.map((cell) =>
    normalizeWhitespace(String(cell ?? ""))
  );

  const hasMeaningfulCell = normalizedRow.some((cell) => cell.trim().length > 0);
  if (hasMeaningfulCell) {
    rows.push(normalizedRow);
  }

  return rows;
}

function normalizeCsvHeader(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCsvColumnIndex(headers: string[], aliases: string[]): number {
  const normalizedAliases = new Set(
    aliases.map((alias) => normalizeCsvHeader(alias))
  );

  return headers.findIndex((header) =>
    normalizedAliases.has(normalizeCsvHeader(header))
  );
}

function getCsvCell(row: string[], index: number): string {
  if (index < 0) return "";

  const raw = String(row[index] ?? "").trim();
  if (!raw) return "";

  return normalizeWhitespace(raw);
}

function parseCsvUploadedSuiteText(text: string): ParsedGeneratedCase[] {
  const normalized = String(text ?? "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const rows = parseCsvRows(normalized);
  if (rows.length < 2) {
    return [];
  }

  const headerRow = rows[0];

  const titleIndex = findCsvColumnIndex(headerRow, [
    "title",
    "test case",
    "testcase",
    "name",
  ]);
  const typeIndex = findCsvColumnIndex(headerRow, ["type"]);
  const priorityIndex = findCsvColumnIndex(headerRow, ["priority"]);
  const preconditionsIndex = findCsvColumnIndex(headerRow, [
    "preconditions",
    "precondition",
  ]);
  const stepsIndex = findCsvColumnIndex(headerRow, [
    "test steps",
    "steps",
    "procedure",
  ]);
  const expectedIndex = findCsvColumnIndex(headerRow, [
    "expected results",
    "expected result",
    "expected",
  ]);
  const tagsIndex = findCsvColumnIndex(headerRow, ["tags", "labels"]);
  const notesIndex = findCsvColumnIndex(headerRow, ["notes", "comments"]);

  // M14:
  // CSV is accepted only when it can map into the locked case structure.
  if (
    titleIndex < 0 ||
    typeIndex < 0 ||
    priorityIndex < 0 ||
    preconditionsIndex < 0 ||
    stepsIndex < 0 ||
    expectedIndex < 0
  ) {
    return [];
  }

  const out: ParsedGeneratedCase[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];

    const title = getCsvCell(row, titleIndex);
    const typeValue = getCsvCell(row, typeIndex);
    const priorityValue = getCsvCell(row, priorityIndex);
    const preconditionsValue = getCsvCell(row, preconditionsIndex);
    const stepsValue = getCsvCell(row, stepsIndex);
    const expectedValue = getCsvCell(row, expectedIndex);
    const tagsValue = getCsvCell(row, tagsIndex);
    const notesValue = getCsvCell(row, notesIndex);

    // M14:
    // Skip only rows that truly fail the locked minimum structure.
    if (
      !title.trim() ||
      !typeValue.trim() ||
      !priorityValue.trim() ||
      !preconditionsValue.trim() ||
      !stepsValue.trim() ||
      !expectedValue.trim()
    ) {
      continue;
    }

    const bodyLines = [
      `TC-000 - ${title}`,
      `Type: ${typeValue}`,
      `Priority: ${priorityValue}`,
      `Preconditions: ${preconditionsValue}`,
      `Test Steps: ${stepsValue}`,
      `Expected Results: ${expectedValue}`,
      ...(tagsValue ? [`Tags: ${tagsValue}`] : []),
      ...(notesValue ? [`Notes: ${notesValue}`] : []),
    ];

    out.push({
      title,
      body: bodyLines.join("\n"),
      ...(normalizeCaseType(typeValue)
        ? { type: normalizeCaseType(typeValue) }
        : {}),
      ...(normalizePriority(priorityValue)
        ? { priority: normalizePriority(priorityValue) }
        : {}),
      preconditions: splitInlineOrBulletedValue(preconditionsValue),
      steps: splitInlineOrBulletedValue(stepsValue),
      expectedResults: splitInlineOrBulletedValue(expectedValue),
      ...(tagsValue ? { tags: splitInlineOrBulletedValue(tagsValue) } : {}),
      ...(notesValue ? { notes: notesValue } : {}),
    });
  }

  return out;
}
/**
 * M14:
 * Format-aware uploaded suite parsing boundary.
 * This keeps upload handling deterministic and narrow without promoting any
 * uploaded content into requirement truth.
 */
export function parseUploadedSuiteContent(args: {
  format: UploadedSuiteFormat;
  content: string;
}): UploadedSuiteParseResult {
  const normalizedContent = String(args.content ?? "").replace(/\r/g, "").trim();
  if (!normalizedContent) {
    return {
      ok: false,
      format: args.format,
      reason: "invalid_suite",
      message: "Uploaded suite content was empty.",
    };
  }

  let parsedCases: ParsedGeneratedCase[] = [];

  if (args.format === "txt" || args.format === "md") {
    parsedCases = parseGeneratedTestCases(normalizedContent);
  } else if (args.format === "csv") {
    parsedCases = parseCsvUploadedSuiteText(normalizedContent);
  } else {
    return {
      ok: false,
      format: args.format,
      reason: "unsupported_format",
      message: `Uploaded suite format '${args.format}' is not supported.`,
    };
  }

  if (!parsedCases.length) {
    return {
      ok: false,
      format: args.format,
      reason: "invalid_suite",
      message:
        args.format === "csv"
          ? "Uploaded CSV could not be mapped into the required test case structure."
          : "Uploaded suite did not contain valid test cases in the locked TC format.",
    };
  }

  return {
    ok: true,
    format: args.format,
    parsedCases,
  };
}

/**
 * M14:
 * Build a fresh suite artifact from uploaded file content.
 * This is intentionally suite-only ingestion. It does not infer or persist
 * any requirement truth from the uploaded file.
 */
export function ingestUploadedSuiteContent(args: {
  format: UploadedSuiteFormat;
  content: string;
}): UploadedSuiteIngestionResult {
  const parsed = parseUploadedSuiteContent(args);
  if (!parsed.ok) {
    return parsed;
  }

  const nowIso = new Date().toISOString();
  const freshCases = parsed.parsedCases.map((parsedCase, idx) => {
    const caseId = `TC-${String(idx + 1).padStart(3, "0")}`;
    return buildStructuredCase(caseId, parsedCase);
  });

  return {
    ok: true,
    format: parsed.format,
    nextSuite: {
      version: 1,
      cases: freshCases,
      createdAt: nowIso,
      lastUpdatedAt: nowIso,
    },
    parsedCount: freshCases.length,
    message: `Parsed ${freshCases.length} test case${
      freshCases.length === 1 ? "" : "s"
    } from uploaded ${parsed.format.toUpperCase()} suite content.`,
  };
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
  parsedCase: ParsedGeneratedCase
): TestCase {
  return normalizeTestCase({
    id: caseId,
    title: parsedCase.title,
    body: buildNormalizedCaseBody(caseId, parsedCase.title, parsedCase.body),

    // M12.17:
    // Persist only safe structured fields. Body remains the compatibility
    // source for visible Type/Priority labels in the current UI.
    ...(parsedCase.priority ? { priority: parsedCase.priority } : {}),
    ...(parsedCase.type ? { type: parsedCase.type } : {}),
    ...(parsedCase.preconditions?.length
      ? { preconditions: parsedCase.preconditions }
      : {}),
    ...(parsedCase.steps?.length ? { steps: parsedCase.steps } : {}),
    ...(parsedCase.expectedResults?.length
      ? { expectedResults: parsedCase.expectedResults }
      : {}),
    ...(parsedCase.tags?.length ? { tags: parsedCase.tags } : {}),
    ...(parsedCase.notes ? { notes: parsedCase.notes } : {}),
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

function sanitizeReplacementCases(parsed: ParsedGeneratedCase[]): {
  cases: TestCase[];
  malformedDroppedCount: number;
  duplicateSkippedCount: number;
} {
  const cases: TestCase[] = [];
  const signatures = new Set<string>();

  let malformedDroppedCount = 0;
  let duplicateSkippedCount = 0;

  for (const candidate of parsed) {
    const tempCase = buildStructuredCase("TC-000", candidate);

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
    return buildStructuredCase(caseId, {
      title: c.title,
      body: c.body,
      priority: c.priority,
      type: c.type,
      preconditions: c.preconditions,
      steps: c.steps,
      expectedResults: c.expectedResults,
      tags: c.tags,
      notes: c.notes,
    });
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
      return buildStructuredCase(caseId, c);
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
    const candidate = buildStructuredCase(caseId, generated);
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