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

const EXECUTION_TEMPLATE_COLUMNS = [
  "suiteVersion",
  "caseId",
  "title",
  "status",
  "actualResult",
  "defectReference",
  "executedBy",
  "executedAt",
  "notes",
] as const;

type ExecutionTemplateColumn = (typeof EXECUTION_TEMPLATE_COLUMNS)[number];

type ExecutionTemplateRow = Record<ExecutionTemplateColumn, string>;

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
  return {
    suiteVersion: String(args.suiteVersion),
    caseId: args.testCase.id,
    title: args.testCase.title,
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
