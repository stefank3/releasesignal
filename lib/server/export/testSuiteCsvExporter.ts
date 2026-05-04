// lib/server/export/testSuiteCsvExporter.ts
// M15 Generic Suite Export Layer:
// Deterministic CSV exporter for persisted TestSuiteArtifact.
//
// CSV is intentionally generic and portable.
// It flattens richer structured fields into readable multiline-safe strings.
// It does not claim native compatibility with any test-management tool.

import {
  normalizeMultilineText,
  normalizeTestCase,
  type TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { parseExportFieldsFromBody } from "@/lib/server/export/testSuiteBodyFieldParser";

const CSV_COLUMNS = [
  "caseId",
  "title",
  "type",
  "priority",
  "preconditions",
  "steps",
  "expectedResults",
  "tags",
  "notes",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

type CsvRow = Record<CsvColumn, string>;

function joinList(values: string[] | undefined): string {
  if (!Array.isArray(values) || values.length === 0) return "";

  return values
    .map((value, index) => `${index + 1}. ${normalizeMultilineText(value)}`)
    .filter((value) => value.trim().length > 3)
    .join("\n");
}

function preferStructuredList(
  structured: string[] | undefined,
  fallback: string[]
): string[] {
  if (Array.isArray(structured) && structured.length > 0) {
    return structured;
  }

  return fallback;
}

function escapeCsvValue(value: string): string {
  const normalized = normalizeMultilineText(value);

  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsvRow(rawCase: ReturnType<typeof normalizeTestCase>): CsvRow {
  const fallback = parseExportFieldsFromBody(rawCase.body);

  return {
    caseId: rawCase.id,
    title: rawCase.title,
    type: rawCase.type ?? fallback.type ?? "",
    priority: rawCase.priority ?? fallback.priority ?? "",
    preconditions: joinList(
      preferStructuredList(rawCase.preconditions, fallback.preconditions)
    ),
    steps: joinList(preferStructuredList(rawCase.steps, fallback.steps)),
    expectedResults: joinList(
      preferStructuredList(rawCase.expectedResults, fallback.expectedResults)
    ),
    tags: Array.isArray(rawCase.tags) ? rawCase.tags.join(", ") : "",
    notes: rawCase.notes ?? "",
  };
}

export function exportTestSuiteToCsv(args: {
  suite: TestSuiteArtifact;
}): string {
  const normalizedCases = args.suite.cases.map((testCase) =>
    normalizeTestCase(testCase)
  );

  const header = CSV_COLUMNS.join(",");

  const rows = normalizedCases.map((testCase) => {
    const row = buildCsvRow(testCase);

    return CSV_COLUMNS.map((column) => escapeCsvValue(row[column])).join(",");
  });

  return [header, ...rows].join("\n") + "\n";
}