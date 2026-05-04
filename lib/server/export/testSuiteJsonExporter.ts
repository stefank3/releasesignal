// lib/server/export/testSuiteJsonExporter.ts
// M15 Generic Suite Export Layer:
// Deterministic JSON exporter for persisted TestSuiteArtifact.
//
// This exporter is Release Signal-native.
// It does not attempt to match Qase/TestRail/Xray/Zephyr schemas.

import {
  normalizeTestCase,
  type TestSuiteArtifact,
} from "@/lib/chat/artifact";
import type {
  TestSuiteExportCase,
  TestSuiteExportMetadata,
  TestSuiteJsonExport,
} from "@/lib/server/export/exportTypes";

function normalizeOptionalList(values: string[] | undefined): string[] {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function buildExportCase(testCase: ReturnType<typeof normalizeTestCase>): TestSuiteExportCase {
  return {
    caseId: testCase.id,
    title: testCase.title,
    type: testCase.type ?? null,
    priority: testCase.priority ?? null,
    preconditions: normalizeOptionalList(testCase.preconditions),
    steps: normalizeOptionalList(testCase.steps),
    expectedResults: normalizeOptionalList(testCase.expectedResults),
    tags: normalizeOptionalList(testCase.tags),
    notes: testCase.notes ?? null,
    body: testCase.body,
  };
}

export function buildTestSuiteExportMetadata(args: {
  suite: TestSuiteArtifact;
  exportedAt: string;
}): TestSuiteExportMetadata {
  return {
    source: "Release Signal",
    exportedAt: args.exportedAt,
    suiteVersion: args.suite.version,
    caseCount: args.suite.cases.length,
    createdAt: args.suite.createdAt,
    lastUpdatedAt: args.suite.lastUpdatedAt,
    basedOnRequirementVersion: args.suite.basedOnRequirementVersion ?? null,
  };
}

export function buildTestSuiteJsonExport(args: {
  suite: TestSuiteArtifact;
  exportedAt: string;
}): TestSuiteJsonExport {
  const normalizedCases = args.suite.cases.map((testCase) =>
    normalizeTestCase(testCase)
  );

  return {
    metadata: buildTestSuiteExportMetadata({
      suite: {
        ...args.suite,
        cases: normalizedCases,
      },
      exportedAt: args.exportedAt,
    }),
    suite: {
      version: args.suite.version,
      createdAt: args.suite.createdAt,
      lastUpdatedAt: args.suite.lastUpdatedAt,
      basedOnRequirementVersion: args.suite.basedOnRequirementVersion ?? null,
    },
    cases: normalizedCases.map((testCase) => buildExportCase(testCase)),
  };
}

export function exportTestSuiteToJson(args: {
  suite: TestSuiteArtifact;
  exportedAt: string;
}): string {
  return `${JSON.stringify(
    buildTestSuiteJsonExport({
      suite: args.suite,
      exportedAt: args.exportedAt,
    }),
    null,
    2
  )}\n`;
}