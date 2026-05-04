// lib/server/export/exportTypes.ts
// M15 Generic Suite Export Layer:
// Shared export contracts for deterministic TestSuiteArtifact export.
//
// Architecture rule:
// TestSuiteArtifact -> deterministic export service -> JSON / CSV download.
//
// No AI calls.
// No prompt-based conversion.
// No artifact mutation.
// No tool-specific schema claims.

import type { TestSuiteArtifact } from "@/lib/chat/artifact";

export type TestSuiteExportFormat = "json" | "csv";

export type TestSuiteExportMetadata = {
  source: "Release Signal";
  exportedAt: string;
  suiteVersion: number;
  caseCount: number;
  createdAt: string;
  lastUpdatedAt: string;
  basedOnRequirementVersion: number | null;
};

export type TestSuiteExportCase = {
  caseId: string;
  title: string;

  // M15 FIX:
  // Export type/priority as strings because persisted body text may contain
  // generic labels such as Positive / Negative / Edge and High / Medium.
  // The core TestCase artifact enum remains unchanged.
  type: string | null;
  priority: string | null;

  preconditions: string[];
  steps: string[];
  expectedResults: string[];
  tags: string[];
  notes: string | null;
  body: string;
};

export type TestSuiteJsonExport = {
  metadata: TestSuiteExportMetadata;
  suite: {
    version: number;
    createdAt: string;
    lastUpdatedAt: string;
    basedOnRequirementVersion: number | null;
  };
  cases: TestSuiteExportCase[];
};

export type TestSuiteExportInput = {
  suite: TestSuiteArtifact | null | undefined;
  exportedAt?: string;
};

export type TestSuiteExportResult =
  | {
      ok: true;
      format: TestSuiteExportFormat;
      filename: string;
      contentType: string;
      content: string;
    }
  | {
      ok: false;
      reason: "missing_suite" | "empty_suite" | "unsupported_format";
      message: string;
    };