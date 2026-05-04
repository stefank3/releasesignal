// lib/server/export/testSuiteExportService.ts
// M15 Generic Suite Export Layer:
// Service boundary for deterministic TestSuiteArtifact export.
//
// This file owns export orchestration only.
// Format-specific mapping stays in dedicated exporter modules.
//
// Architecture rule:
// TestSuiteArtifact -> deterministic export service -> JSON / CSV download.
//
// No AI calls.
// No prompt conversion.
// No artifact mutation.
// No external-tool schema claims.

import { getTestSuite, type TestSuiteArtifact } from "@/lib/chat/artifact";
import {
  exportTestSuiteToJson,
} from "@/lib/server/export/testSuiteJsonExporter";
import {
  exportTestSuiteToCsv,
} from "@/lib/server/export/testSuiteCsvExporter";
import type {
  TestSuiteExportFormat,
  TestSuiteExportInput,
  TestSuiteExportResult,
} from "@/lib/server/export/exportTypes";

function normalizeExportFormat(value: string | null | undefined): TestSuiteExportFormat | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "json") return "json";
  if (normalized === "csv") return "csv";

  return null;
}

function buildExportFilename(args: {
  format: TestSuiteExportFormat;
  suite: TestSuiteArtifact;
  exportedAt: string;
}): string {
  const safeTimestamp = args.exportedAt.replace(/[:.]/g, "-");
  return `release-signal-suite-v${args.suite.version}-${safeTimestamp}.${args.format}`;
}

function validateExportSuite(
  input: TestSuiteExportInput
):
  | { ok: true; suite: TestSuiteArtifact }
  | {
      ok: false;
      reason: "missing_suite" | "empty_suite";
      message: string;
    } {
  if (!input.suite) {
    return {
      ok: false,
      reason: "missing_suite",
      message: "No test suite artifact is available for export.",
    };
  }

  // M15:
  // Reuse the existing artifact validator only after null has been eliminated.
  // SessionArtifact.testSuite supports undefined, but not null.
  const suite = getTestSuite({
    testSuite: input.suite,
  });

  if (!suite) {
    return {
      ok: false,
      reason: "missing_suite",
      message: "No test suite artifact is available for export.",
    };
  }

  if (!suite.cases.length) {
    return {
      ok: false,
      reason: "empty_suite",
      message: "Cannot export an empty test suite.",
    };
  }

  return {
    ok: true,
    suite,
  };
}
export function exportTestSuiteArtifact(args: {
  suite: TestSuiteExportInput["suite"];
  format: string | null | undefined;
  exportedAt?: string;
}): TestSuiteExportResult {
  const format = normalizeExportFormat(args.format);

  if (!format) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: "Unsupported export format. Use json or csv.",
    };
  }

  const exportedAt = args.exportedAt ?? new Date().toISOString();

  const validation = validateExportSuite({
    suite: args.suite,
    exportedAt,
  });

  if (!validation.ok) {
    return validation;
  }

  const content =
    format === "json"
      ? exportTestSuiteToJson({
          suite: validation.suite,
          exportedAt,
        })
      : exportTestSuiteToCsv({
          suite: validation.suite,
        });

  return {
    ok: true,
    format,
    filename: buildExportFilename({
      format,
      suite: validation.suite,
      exportedAt,
    }),
    contentType:
      format === "json"
        ? "application/json; charset=utf-8"
        : "text/csv; charset=utf-8",
    content,
  };
}