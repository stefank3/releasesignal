"use client";

import React from "react";
import type {
  ExecutionIntelligenceArtifact,
  SessionArtifact,
} from "../../chat.types";

type UploadError = {
  row?: number;
  message?: string;
  code?: string;
  caseId?: string;
};

type UploadResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  executionIntelligence?: ExecutionIntelligenceArtifact;
  artifact?: SessionArtifact | null;
  artifactUpdatedAt?: string | null;
  details?: {
    errors?: UploadError[];
  };
};

type Props = {
  sessionId: string | null;
  disabled?: boolean;
  resolvedTheme?: "light" | "dark";
  buttonLabel?: string;
  onUploadSuccess: (args: {
    executionIntelligence: ExecutionIntelligenceArtifact;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => void;
};

function getErrorMessages(payload: UploadResponse | null): string[] {
  const errors = payload?.details?.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((error) => {
        const message = error.message ?? error.code ?? "Validation failed.";
        return typeof error.row === "number"
          ? `Row ${error.row}: ${message}`
          : message;
      })
      .slice(0, 6);
  }

  return [
    payload?.error ?? payload?.message ?? "Test results could not be uploaded.",
  ];
}

export function UploadTestResultsButton({
  sessionId,
  disabled = false,
  resolvedTheme = "dark",
  buttonLabel = "Upload Test Results",
  onUploadSuccess,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);

  const isDark = resolvedTheme === "dark";
  const uploadDisabled = disabled || !sessionId || isUploading;

  async function uploadFile(file: File) {
    if (!sessionId || uploadDisabled) return;

    setSuccess(null);
    setErrors([]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrors(["Please choose a .csv file."]);
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const params = new URLSearchParams({ sessionId });
      const response = await fetch(`/api/execution-evidence?${params.toString()}`, {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | UploadResponse
        | null;

      if (!response.ok || !payload?.executionIntelligence) {
        setErrors(getErrorMessages(payload));
        return;
      }

      onUploadSuccess({
        executionIntelligence: payload.executionIntelligence,
        artifact: payload.artifact,
        artifactUpdatedAt: payload.artifactUpdatedAt ?? null,
      });
      setSuccess("Execution results uploaded successfully.");
    } catch {
      setErrors(["Test results could not be uploaded."]);
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.82 }}>
          Upload a completed Release Signal Execution CSV template.
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.68 }}>
          Allowed statuses: passed, failed, blocked, skipped, not_run.
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadFile(file);
        }}
      />

      <button
        type="button"
        disabled={uploadDisabled}
        onClick={() => inputRef.current?.click()}
        style={{
          justifySelf: "start",
          borderRadius: 10,
          border: isDark
            ? "1px solid rgba(96,165,250,0.30)"
            : "1px solid rgba(37,99,235,0.24)",
          background: isDark ? "rgba(96,165,250,0.14)" : "rgba(37,99,235,0.08)",
          color: isDark ? "#ffffff" : "#0f172a",
          cursor: uploadDisabled ? "not-allowed" : "pointer",
          opacity: uploadDisabled ? 0.58 : 1,
          padding: "8px 10px",
          fontSize: 12,
          fontWeight: 950,
        }}
      >
        {isUploading ? "Uploading..." : buttonLabel}
      </button>

      {success ? (
        <div
          style={{
            borderRadius: 10,
            border: isDark
              ? "1px solid rgba(34,197,94,0.26)"
              : "1px solid rgba(22,163,74,0.20)",
            background: isDark ? "rgba(34,197,94,0.10)" : "rgba(22,163,74,0.08)",
            padding: "8px 9px",
            fontSize: 11,
            fontWeight: 850,
            lineHeight: 1.45,
          }}
        >
          {success}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div
          style={{
            borderRadius: 10,
            border: isDark
              ? "1px solid rgba(239,68,68,0.28)"
              : "1px solid rgba(220,38,38,0.22)",
            background: isDark ? "rgba(239,68,68,0.10)" : "rgba(220,38,38,0.08)",
            padding: "8px 9px",
            display: "grid",
            gap: 5,
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 950 }}>Test results could not be uploaded.</div>
          {errors.map((error, index) => (
            <div key={`${error}-${index}`}>{error}</div>
          ))}
          <div style={{ opacity: 0.78 }}>
            Check suite version, case IDs, and status values.
          </div>
        </div>
      ) : null}
    </div>
  );
}
