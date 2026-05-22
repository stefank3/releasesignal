import type { ExecutionCaseStatus } from "@/lib/chat/artifact";

export const EXECUTION_UPLOAD_COLUMNS = [
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

export const EXECUTION_UPLOAD_REQUIRED_COLUMNS = [
  "suiteVersion",
  "caseId",
  "status",
] as const;

export const EXECUTION_UPLOAD_STATUSES = [
  "passed",
  "failed",
  "blocked",
  "skipped",
  "not_run",
] as const;

export type ExecutionUploadColumn = (typeof EXECUTION_UPLOAD_COLUMNS)[number];
export type ExecutionUploadRequiredColumn =
  (typeof EXECUTION_UPLOAD_REQUIRED_COLUMNS)[number];
export type ExecutionUploadStatus = (typeof EXECUTION_UPLOAD_STATUSES)[number];
export type ExecutionUploadExecutableStatus = Exclude<
  ExecutionUploadStatus,
  "not_run"
>;

export type ExecutionUploadValidationWarning = {
  message: string;
};

export type ExecutionUploadValidationError = {
  row?: number;
  message: string;
};

export type ParsedExecutionCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedExecutionCsv = {
  header: string[];
  rows: ParsedExecutionCsvRow[];
};

export type ExecutionUploadNormalizedRow = {
  suiteVersion: number;
  caseId: string;
  status: ExecutionUploadExecutableStatus & ExecutionCaseStatus;
  actualResult: string;
  defectReference: string;
  executedBy: string;
  executedAt: string;
  notes: string;
  title?: string;
};

export type ExecutionUploadValidationResult =
  | {
      ok: true;
      rows: ExecutionUploadNormalizedRow[];
      warnings: ExecutionUploadValidationWarning[];
    }
  | {
      ok: false;
      errors: ExecutionUploadValidationError[];
      warnings: ExecutionUploadValidationWarning[];
    };
