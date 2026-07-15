// app/chat/components/TestSuiteExportMenu.tsx
// M15 Generic Suite Export Layer:
// Small UI trigger for deterministic JSON / CSV suite export.
//
// This component only triggers the export API.
// It does not format export content.
// It does not read or mutate TestSuiteArtifact.
// It does not contain export mapping/business logic.
// V1.1 adds a Release Signal execution CSV template export only.
// This does not add upload behavior or external tool compatibility claims.

"use client";

import { useState, type CSSProperties } from "react";

type ExportFormat = "json" | "csv" | "execution-csv";

type TestSuiteExportMenuProps = {
  sessionId: string | null;
  disabled?: boolean;
  formats?: ExportFormat[];
  resolvedTheme?: "light" | "dark";
  visualVariant?: "default" | "strategy";
};

function buildExportUrl(args: {
  sessionId: string;
  format: ExportFormat;
}): string {
  const params = new URLSearchParams({
    sessionId: args.sessionId,
    format: args.format,
  });

  return `/api/test-suites/export?${params.toString()}`;
}

export function TestSuiteExportMenu({
  sessionId,
  disabled = false,
  formats = ["json", "csv", "execution-csv"],
  resolvedTheme = "dark",
  visualVariant = "default",
}: TestSuiteExportMenuProps) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportDisabled = disabled || !sessionId || !!isExporting;
  const useStrategyVisuals = visualVariant === "strategy";
  const isDark = resolvedTheme === "dark";
  const strategyButtonStyle: CSSProperties | undefined = useStrategyVisuals
    ? {
        borderRadius: 8,
        border: isDark ? "1px solid #4A4739" : "1px solid #C4BCA7",
        background: isDark ? "#35332C" : "#F1EDE2",
        color: isDark ? "#EDEAE3" : "#262521",
        padding: "7px 13px",
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.2,
        cursor: exportDisabled ? "not-allowed" : "pointer",
        opacity: exportDisabled ? 0.55 : 1,
        whiteSpace: "nowrap",
      }
    : undefined;

  async function handleExport(format: ExportFormat) {
    if (!sessionId || exportDisabled) return;

    setError(null);
    setIsExporting(format);

    try {
      const response = await fetch(
        buildExportUrl({
          sessionId,
          format,
        }),
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error ?? "Suite export failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] ??
        (format === "execution-csv"
          ? "release-signal-execution-template.csv"
          : `release-signal-suite.${format}`);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suite export failed.");
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div
      className={useStrategyVisuals ? undefined : "flex flex-col gap-2"}
      style={useStrategyVisuals ? { display: "grid", gap: 8 } : undefined}
    >
      <div
        className={useStrategyVisuals ? undefined : "flex flex-wrap gap-2"}
        style={
          useStrategyVisuals
            ? { display: "flex", flexWrap: "wrap", gap: 8 }
            : undefined
        }
      >
        {formats.includes("json") ? (
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => handleExport("json")}
            className={
              useStrategyVisuals
                ? undefined
                : "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            }
            style={strategyButtonStyle}
          >
            {isExporting === "json" ? "Exporting JSON..." : "Export JSON"}
          </button>
        ) : null}

        {formats.includes("csv") ? (
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => handleExport("csv")}
            className={
              useStrategyVisuals
                ? undefined
                : "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            }
            style={strategyButtonStyle}
          >
            {isExporting === "csv" ? "Exporting CSV..." : "Export CSV"}
          </button>
        ) : null}

        {formats.includes("execution-csv") ? (
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => handleExport("execution-csv")}
            className={
              useStrategyVisuals
                ? undefined
                : "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            }
            style={strategyButtonStyle}
          >
            {isExporting === "execution-csv"
              ? "Exporting Template..."
              : "Export Execution Template"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          className={useStrategyVisuals ? undefined : "text-xs text-red-400"}
          style={
            useStrategyVisuals
              ? {
                  margin: 0,
                  fontSize: 11,
                  color: isDark ? "#E8776A" : "#B0392E",
                }
              : undefined
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
