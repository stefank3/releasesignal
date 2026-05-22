import {
  normalizeTestCase,
  type TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { parseExecutionCsv } from "@/lib/server/execution-upload/executionCsvParser";
import {
  EXECUTION_UPLOAD_COLUMNS,
  EXECUTION_UPLOAD_REQUIRED_COLUMNS,
  EXECUTION_UPLOAD_STATUSES,
  type ExecutionUploadExecutableStatus,
  type ExecutionUploadNormalizedRow,
  type ExecutionUploadValidationError,
  type ExecutionUploadValidationResult,
  type ExecutionUploadValidationWarning,
} from "@/lib/server/execution-upload/executionUploadTypes";

const EXECUTABLE_STATUSES = new Set<ExecutionUploadExecutableStatus>([
  "passed",
  "failed",
  "blocked",
  "skipped",
]);

function parseSuiteVersion(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}

function buildCaseIndex(suite: TestSuiteArtifact): Map<string, string> {
  const cases = new Map<string, string>();

  for (const testCase of suite.cases) {
    const normalized = normalizeTestCase(testCase);
    cases.set(normalized.id, normalized.title);
  }

  return cases;
}

function validateHeader(header: string[]): {
  errors: ExecutionUploadValidationError[];
  warnings: ExecutionUploadValidationWarning[];
} {
  const errors: ExecutionUploadValidationError[] = [];
  const warnings: ExecutionUploadValidationWarning[] = [];
  const headerSet = new Set(header);
  const expectedSet = new Set<string>(EXECUTION_UPLOAD_COLUMNS);

  for (const column of EXECUTION_UPLOAD_REQUIRED_COLUMNS) {
    if (!headerSet.has(column)) {
      errors.push({ message: `Missing required column ${column}` });
    }
  }

  for (const column of header) {
    if (column && !expectedSet.has(column)) {
      warnings.push({ message: `Unexpected column ${column} will be ignored` });
    }
  }

  return { errors, warnings };
}

export function validateExecutionCsvUpload(args: {
  csvText: string;
  suite: TestSuiteArtifact;
}): ExecutionUploadValidationResult {
  const parsed = parseExecutionCsv(args.csvText);

  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors,
      warnings: [],
    };
  }

  const headerValidation = validateHeader(parsed.csv.header);
  const errors: ExecutionUploadValidationError[] = [
    ...headerValidation.errors,
  ];
  const warnings = [...headerValidation.warnings];

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
    };
  }

  if (parsed.csv.rows.length === 0) {
    return {
      ok: false,
      errors: [{ message: "empty execution CSV file" }],
      warnings,
    };
  }

  const caseIndex = buildCaseIndex(args.suite);
  const seenCaseIds = new Set<string>();
  const normalizedRows: ExecutionUploadNormalizedRow[] = [];
  const allowedStatuses = new Set<string>(EXECUTION_UPLOAD_STATUSES);

  for (const row of parsed.csv.rows) {
    const suiteVersionValue = row.values.suiteVersion ?? "";
    const suiteVersion = parseSuiteVersion(suiteVersionValue);
    const caseId = (row.values.caseId ?? "").trim();
    const status = (row.values.status ?? "").trim();

    if (suiteVersion !== args.suite.version) {
      errors.push({
        row: row.rowNumber,
        message: `Expected suiteVersion ${args.suite.version}, got ${
          suiteVersionValue || "blank"
        }`,
      });
    }

    if (!caseId) {
      errors.push({
        row: row.rowNumber,
        message: "missing caseId",
      });
    } else if (!caseIndex.has(caseId)) {
      errors.push({
        row: row.rowNumber,
        message: `unknown caseId ${caseId}`,
      });
    } else if (seenCaseIds.has(caseId)) {
      errors.push({
        row: row.rowNumber,
        message: `duplicate caseId ${caseId}`,
      });
    }

    if (!allowedStatuses.has(status)) {
      errors.push({
        row: row.rowNumber,
        message: `invalid status ${status || "blank"}`,
      });
    }

    if (caseId) {
      seenCaseIds.add(caseId);
    }

    if (
      suiteVersion === args.suite.version &&
      caseIndex.has(caseId) &&
      EXECUTABLE_STATUSES.has(status as ExecutionUploadExecutableStatus)
    ) {
      normalizedRows.push({
        suiteVersion,
        caseId,
        status: status as ExecutionUploadNormalizedRow["status"],
        actualResult: row.values.actualResult ?? "",
        defectReference: row.values.defectReference ?? "",
        executedBy: row.values.executedBy ?? "",
        executedAt: row.values.executedAt ?? "",
        notes: row.values.notes ?? "",
        title: row.values.title || caseIndex.get(caseId),
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
    };
  }

  if (normalizedRows.length === 0) {
    return {
      ok: false,
      errors: [{ message: "no executable results" }],
      warnings,
    };
  }

  return {
    ok: true,
    rows: normalizedRows,
    warnings,
  };
}
