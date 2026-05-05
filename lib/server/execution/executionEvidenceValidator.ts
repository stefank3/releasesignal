// lib/server/execution/executionEvidenceValidator.ts
// M16 Execution Evidence Layer:
// Deterministic validation for structured execution-result input.
//
// Architecture rule:
// structured execution input
// -> deterministic validation / normalization
// -> ExecutionIntelligenceArtifact
//
// No AI calls.
// No prompt parsing.
// No artifact mutation.
// No release-readiness calculation.

import type {
  ExecutionCaseStatus,
  ExecutionSource,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  normalizeExecutionCaseStatus,
  normalizeExecutionSource,
  normalizeWhitespace,
} from "@/lib/chat/artifact";

export type ExecutionEvidenceInputCase = {
  caseId?: unknown;
  title?: unknown;
  status?: unknown;
  observedAt?: unknown;
  source?: unknown;
  externalCaseRef?: unknown;
  externalCaseName?: unknown;
  durationMs?: unknown;
  errorMessage?: unknown;
  rawOutcome?: unknown;
  notes?: unknown;
};

export type ExecutionEvidenceInput = {
  sessionId?: unknown;
  suiteVersion?: unknown;
  runId?: unknown;
  runLabel?: unknown;
  source?: unknown;
  observedAt?: unknown;
  results?: unknown;
  caseResults?: unknown;
};

export type ExecutionEvidenceValidationWarning = {
  code:
    | "unknown_status"
    | "unknown_case_id"
    | "title_matched_case_id"
    | "generated_observed_at"
    | "unknown_source";
  message: string;
  caseId?: string;
};

export type ExecutionEvidenceValidationError = {
  code:
    | "missing_session_id"
    | "missing_suite"
    | "missing_suite_version"
    | "suite_version_mismatch"
    | "missing_run_identity"
    | "empty_results"
    | "invalid_result"
    | "missing_case_reference"
    | "missing_status"
    | "duplicate_case_result"
    | "invalid_observed_at";
  message: string;
  caseId?: string;
};

export type ValidatedExecutionCaseResult = {
  caseId: string;
  status: ExecutionCaseStatus;
  observedAt: string;
  source: ExecutionSource;
  externalCaseRef?: string;
  externalCaseName?: string;
  durationMs?: number;
  errorMessage?: string;
  rawOutcome?: string;
};

export type ValidatedExecutionEvidence = {
  sessionId: string;
  suiteVersion: number;
  runId?: string;
  runLabel?: string;
  source: ExecutionSource;
  observedAt: string;
  caseResults: ValidatedExecutionCaseResult[];
  warnings: ExecutionEvidenceValidationWarning[];
};

export type ExecutionEvidenceValidationResult =
  | {
      ok: true;
      evidence: ValidatedExecutionEvidence;
    }
  | {
      ok: false;
      errors: ExecutionEvidenceValidationError[];
      warnings: ExecutionEvidenceValidationWarning[];
    };

function optionalString(value: unknown): string {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function normalizeCaseId(value: unknown): string {
  return optionalString(value).toUpperCase();
}

function parseSuiteVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function normalizeIsoOrNull(value: unknown): string | null {
  const raw = optionalString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function normalizeDurationMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return undefined;
}

function getInputCases(input: ExecutionEvidenceInput): ExecutionEvidenceInputCase[] {
  const rawResults = Array.isArray(input.results)
    ? input.results
    : Array.isArray(input.caseResults)
      ? input.caseResults
      : [];

  return rawResults.filter(
    (item): item is ExecutionEvidenceInputCase =>
      !!item && typeof item === "object"
  );
}

function buildTitleToCaseIdMap(suite: TestSuiteArtifact): Map<string, string> {
  const map = new Map<string, string>();

  for (const testCase of suite.cases ?? []) {
    const title = normalizeWhitespace(testCase.title).toLowerCase();
    const caseId = normalizeCaseId(testCase.id);

    if (title && caseId && !map.has(title)) {
      map.set(title, caseId);
    }
  }

  return map;
}

export function validateExecutionEvidenceInput(args: {
  input: ExecutionEvidenceInput;
  suite: TestSuiteArtifact | null | undefined;
  nowIso?: string;
}): ExecutionEvidenceValidationResult {
  const errors: ExecutionEvidenceValidationError[] = [];
  const warnings: ExecutionEvidenceValidationWarning[] = [];

  const nowIso = args.nowIso ?? new Date().toISOString();
  const suite = args.suite ?? null;

  const sessionId = optionalString(args.input.sessionId);
  if (!sessionId) {
    errors.push({
      code: "missing_session_id",
      message: "Execution evidence requires a sessionId.",
    });
  }

  if (!suite?.cases?.length) {
    errors.push({
      code: "missing_suite",
      message: "Execution evidence requires an existing test suite artifact.",
    });
  }

  const suiteVersion = parseSuiteVersion(args.input.suiteVersion);
  if (suiteVersion == null) {
    errors.push({
      code: "missing_suite_version",
      message: "Execution evidence requires a suiteVersion.",
    });
  }

  if (
    suite?.version != null &&
    suiteVersion != null &&
    suite.version !== suiteVersion
  ) {
    errors.push({
      code: "suite_version_mismatch",
      message: `Execution evidence targets suite v${suiteVersion}, but the current suite is v${suite.version}.`,
    });
  }

  const runId = optionalString(args.input.runId);
  const runLabel = optionalString(args.input.runLabel);

  if (!runId && !runLabel) {
    errors.push({
      code: "missing_run_identity",
      message: "Execution evidence requires either runId or runLabel.",
    });
  }

  const source = normalizeExecutionSource(optionalString(args.input.source));
  if (source === "unknown") {
    warnings.push({
      code: "unknown_source",
      message: "Execution source was not recognized and was normalized to unknown.",
    });
  }

  const observedAt = normalizeIsoOrNull(args.input.observedAt) ?? nowIso;
  if (!optionalString(args.input.observedAt)) {
    warnings.push({
      code: "generated_observed_at",
      message: "Execution observedAt was missing and was generated server-side.",
    });
  } else if (!normalizeIsoOrNull(args.input.observedAt)) {
    errors.push({
      code: "invalid_observed_at",
      message: "Execution observedAt must be a valid ISO datetime.",
    });
  }

  const inputCases = getInputCases(args.input);
  if (!inputCases.length) {
    errors.push({
      code: "empty_results",
      message: "Execution evidence requires at least one result.",
    });
  }

  const knownCaseIds = new Set(
    (suite?.cases ?? []).map((testCase) => normalizeCaseId(testCase.id))
  );
  const titleToCaseId = suite ? buildTitleToCaseIdMap(suite) : new Map<string, string>();

  const seenCaseIds = new Set<string>();
  const caseResults: ValidatedExecutionCaseResult[] = [];

  for (const [index, rawCase] of inputCases.entries()) {
    const explicitCaseId = normalizeCaseId(rawCase.caseId);
    const title = optionalString(rawCase.title || rawCase.externalCaseName);
    const titleMatchCaseId = title
      ? titleToCaseId.get(title.toLowerCase()) ?? ""
      : "";

    const caseId = explicitCaseId || titleMatchCaseId;

    if (!caseId) {
      errors.push({
        code: "missing_case_reference",
        message: `Execution result #${index + 1} requires caseId or a title that matches the current suite.`,
      });
      continue;
    }

    if (!explicitCaseId && titleMatchCaseId) {
      warnings.push({
        code: "title_matched_case_id",
        caseId,
        message: `Execution result #${index + 1} was linked by title to ${caseId}.`,
      });
    }

    if (seenCaseIds.has(caseId)) {
      errors.push({
        code: "duplicate_case_result",
        caseId,
        message: `Duplicate execution result found for ${caseId}.`,
      });
      continue;
    }

    seenCaseIds.add(caseId);

    if (knownCaseIds.size > 0 && !knownCaseIds.has(caseId)) {
      warnings.push({
        code: "unknown_case_id",
        caseId,
        message: `${caseId} was not found in the current test suite artifact.`,
      });
    }

    const rawStatus = optionalString(rawCase.status);
    if (!rawStatus) {
      errors.push({
        code: "missing_status",
        caseId,
        message: `${caseId} requires an execution status.`,
      });
      continue;
    }

    const status = normalizeExecutionCaseStatus(rawStatus);
    if (status === "unknown" && rawStatus.toLowerCase() !== "unknown") {
      warnings.push({
        code: "unknown_status",
        caseId,
        message: `${caseId} status "${rawStatus}" was normalized to unknown.`,
      });
    }

    const caseObservedAt =
      normalizeIsoOrNull(rawCase.observedAt) ?? observedAt;

    if (rawCase.observedAt && !normalizeIsoOrNull(rawCase.observedAt)) {
      errors.push({
        code: "invalid_observed_at",
        caseId,
        message: `${caseId} observedAt must be a valid ISO datetime.`,
      });
      continue;
    }

    const caseSource = rawCase.source
      ? normalizeExecutionSource(optionalString(rawCase.source))
      : source;

    const rawOutcome =
      optionalString(rawCase.rawOutcome) || optionalString(rawCase.notes);

    caseResults.push({
      caseId,
      status,
      observedAt: caseObservedAt,
      source: caseSource,
      ...(optionalString(rawCase.externalCaseRef)
        ? { externalCaseRef: optionalString(rawCase.externalCaseRef) }
        : {}),
      ...(optionalString(rawCase.externalCaseName)
        ? { externalCaseName: optionalString(rawCase.externalCaseName) }
        : title
          ? { externalCaseName: title }
          : {}),
      ...(normalizeDurationMs(rawCase.durationMs) != null
        ? { durationMs: normalizeDurationMs(rawCase.durationMs) }
        : {}),
      ...(optionalString(rawCase.errorMessage)
        ? { errorMessage: optionalString(rawCase.errorMessage) }
        : {}),
      ...(rawOutcome ? { rawOutcome } : {}),
    });
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    evidence: {
      sessionId,
      suiteVersion: suiteVersion ?? suite?.version ?? 0,
      ...(runId ? { runId } : {}),
      ...(runLabel ? { runLabel } : {}),
      source,
      observedAt,
      caseResults,
      warnings,
    },
  };
}