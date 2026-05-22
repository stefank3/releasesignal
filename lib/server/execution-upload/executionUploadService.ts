import type { TestSuiteArtifact } from "@/lib/chat/artifact";
import type { ExecutionEvidenceInput } from "@/lib/server/execution/executionEvidenceValidator";
import { validateExecutionCsvUpload } from "@/lib/server/execution-upload/executionCsvValidator";
import type {
  ExecutionUploadValidationError,
  ExecutionUploadValidationWarning,
} from "@/lib/server/execution-upload/executionUploadTypes";

type CsvUploadReadResult =
  | {
      ok: true;
      sessionId: string;
      csvText: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

type ExecutionEvidenceRequestResult =
  | {
      ok: true;
      kind: "json";
      input: ExecutionEvidenceInput;
      sessionId: string;
    }
  | {
      ok: true;
      kind: "csv";
      sessionId: string;
      csvText: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export type CsvUploadEvidenceInputResult =
  | {
      ok: true;
      input: ExecutionEvidenceInput;
      warnings: ExecutionUploadValidationWarning[];
    }
  | {
      ok: false;
      message: string;
      errors: ExecutionUploadValidationError[];
      warnings: ExecutionUploadValidationWarning[];
    };

function optionalFormString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildRunTimestamp(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "-");
}

function buildRawOutcome(args: {
  actualResult: string;
  notes: string;
  executedBy: string;
}): string {
  const parts: string[] = [];

  if (args.actualResult) {
    parts.push(`Actual result: ${args.actualResult}`);
  }

  if (args.notes) {
    parts.push(`Notes: ${args.notes}`);
  }

  if (args.executedBy) {
    parts.push(`Executed by: ${args.executedBy}`);
  }

  return parts.join("\n");
}

async function readMultipartCsvUpload(req: Request): Promise<CsvUploadReadResult> {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Execution CSV upload request must be valid multipart/form-data.",
    };
  }

  const querySessionId =
    new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  const sessionId =
    querySessionId || optionalFormString(formData.get("sessionId"));
  if (!sessionId) {
    return {
      ok: false,
      status: 400,
      message: "Missing sessionId for execution CSV upload.",
    };
  }

  const csvEntry =
    formData.get("file") ?? formData.get("csvFile") ?? formData.get("csv");

  if (!csvEntry) {
    return {
      ok: false,
      status: 400,
      message: "Execution CSV upload requires a CSV file field.",
    };
  }

  const csvText =
    typeof csvEntry === "string" ? csvEntry : await csvEntry.text();

  if (!csvText.trim()) {
    return {
      ok: false,
      status: 400,
      message: "Execution CSV upload file is empty.",
    };
  }

  return {
    ok: true,
    sessionId,
    csvText,
  };
}

async function readTextCsvUpload(req: Request): Promise<CsvUploadReadResult> {
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";

  if (!sessionId) {
    return {
      ok: false,
      status: 400,
      message: "Missing sessionId query parameter for text/csv execution upload.",
    };
  }

  const csvText = await req.text();
  if (!csvText.trim()) {
    return {
      ok: false,
      status: 400,
      message: "Execution CSV upload body is empty.",
    };
  }

  return {
    ok: true,
    sessionId,
    csvText,
  };
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isExecutionCsvUpload(req: Request): boolean {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  return (
    contentType.includes("multipart/form-data") ||
    contentType.includes("text/csv") ||
    contentType.includes("application/csv")
  );
}

export async function readExecutionCsvUploadRequest(
  req: Request
): Promise<CsvUploadReadResult> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    return readMultipartCsvUpload(req);
  }

  return readTextCsvUpload(req);
}

export async function readExecutionEvidenceImportRequest(
  req: Request
): Promise<ExecutionEvidenceRequestResult> {
  if (isExecutionCsvUpload(req)) {
    const upload = await readExecutionCsvUploadRequest(req);

    if (!upload.ok) {
      return upload;
    }

    return {
      ok: true,
      kind: "csv",
      sessionId: upload.sessionId,
      csvText: upload.csvText,
    };
  }

  const body = await readJsonBody(req);

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Execution evidence request body must be valid JSON.",
    };
  }

  const input = body as ExecutionEvidenceInput;
  const sessionId =
    typeof input.sessionId === "string" ? input.sessionId.trim() : "";

  if (!sessionId) {
    return {
      ok: false,
      status: 400,
      message: "Missing sessionId for execution evidence import.",
    };
  }

  return {
    ok: true,
    kind: "json",
    input,
    sessionId,
  };
}

export function buildExecutionEvidenceInputFromCsvUpload(args: {
  sessionId: string;
  csvText: string;
  suite: TestSuiteArtifact;
  nowIso?: string;
}): CsvUploadEvidenceInputResult {
  const validation = validateExecutionCsvUpload({
    csvText: args.csvText,
    suite: args.suite,
  });

  if (!validation.ok) {
    return {
      ok: false,
      message: "Execution CSV upload could not be saved because validation failed.",
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const observedAt = args.nowIso ?? new Date().toISOString();
  const runTimestamp = buildRunTimestamp(observedAt);

  return {
    ok: true,
    input: {
      sessionId: args.sessionId,
      suiteVersion: args.suite.version,
      source: "manual",
      observedAt,
      runId: `execution-csv-v${args.suite.version}-${runTimestamp}`,
      runLabel: `Release Signal Execution CSV upload ${observedAt}`,
      caseResults: validation.rows.map((row) => {
        const rawOutcome = buildRawOutcome({
          actualResult: row.actualResult,
          notes: row.notes,
          executedBy: row.executedBy,
        });

        return {
          caseId: row.caseId,
          status: row.status,
          source: "manual",
          ...(row.executedAt ? { observedAt: row.executedAt } : {}),
          ...(row.defectReference
            ? { externalCaseRef: row.defectReference }
            : {}),
          ...(row.title ? { externalCaseName: row.title } : {}),
          ...(rawOutcome ? { rawOutcome } : {}),
        };
      }),
    },
    warnings: validation.warnings,
  };
}
