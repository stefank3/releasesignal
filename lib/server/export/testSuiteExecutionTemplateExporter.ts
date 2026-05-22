// lib/server/export/testSuiteExecutionTemplateExporter.ts
// V1.1 Closed QA Cycle:
// Deterministic Release Signal execution-template CSV exporter.
//
// This exporter creates a Release Signal-native execution CSV template.
// It does not mutate artifacts.
// It does not call AI.
// It does not claim compatibility with external test-management or automation tools.

import {
  normalizeMultilineText,
  normalizeTestCase,
  type TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { parseExportFieldsFromBody } from "@/lib/server/export/testSuiteBodyFieldParser";

const EXECUTION_TEMPLATE_COLUMNS = [
  "suiteVersion",
  "caseId",
  "title",
  "preconditions",
  "steps",
  "expectedResults",
  "status",
  "actualResult",
  "defectReference",
  "executedBy",
  "executedAt",
  "notes",
] as const;

type ExecutionTemplateColumn = (typeof EXECUTION_TEMPLATE_COLUMNS)[number];

type ExecutionTemplateRow = Record<ExecutionTemplateColumn, string>;

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

function buildTemplateRow(args: {
  suiteVersion: number;
  testCase: ReturnType<typeof normalizeTestCase>;
}): ExecutionTemplateRow {
  const fallback = parseExportFieldsFromBody(args.testCase.body);

  return {
    suiteVersion: String(args.suiteVersion),
    caseId: args.testCase.id,
    title: args.testCase.title,
    preconditions: joinList(
      preferStructuredList(args.testCase.preconditions, fallback.preconditions)
    ),
    steps: joinList(
      preferStructuredList(args.testCase.steps, fallback.steps)
    ),
    expectedResults: joinList(
      preferStructuredList(
        args.testCase.expectedResults,
        fallback.expectedResults
      )
    ),
    status: "",
    actualResult: "",
    defectReference: "",
    executedBy: "",
    executedAt: "",
    notes: "",
  };
}

export function exportTestSuiteExecutionTemplateToCsv(args: {
  suite: TestSuiteArtifact;
}): string {
  const normalizedCases = args.suite.cases.map((testCase) =>
    normalizeTestCase(testCase)
  );

  const header = EXECUTION_TEMPLATE_COLUMNS.join(",");

  const rows = normalizedCases.map((testCase) => {
    const row = buildTemplateRow({
      suiteVersion: args.suite.version,
      testCase,
    });

    return EXECUTION_TEMPLATE_COLUMNS.map((column) =>
      escapeCsvValue(row[column])
    ).join(",");
  });

  return [header, ...rows].join("\n") + "\n";
}
