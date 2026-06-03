// app/chat/components/ReleaseReadinessPanel.tsx
// M17 Release Readiness:
// Collapsed/expandable report surface for deterministic release readiness.
// This keeps the compact FeatureWorkspaceSummary clean while still exposing
// the readiness report in the chat workspace.

"use client";

import React from "react";
import type { SessionArtifact } from "@/lib/chat/artifact";
import { buildReleaseReadinessSummary } from "@/lib/release-readiness/releaseReadinessService";
import type { ReleaseReadinessStatus } from "@/lib/release-readiness/releaseReadinessTypes";
import { ReleaseReadinessSummary } from "./ReleaseReadinessSummary";
import { ExecutionResultsBreakdown } from "./readiness/ExecutionResultsBreakdown";
import { ArtifactProvenanceLabel } from "./workspace/ArtifactProvenanceLabel";

type Props = {
  sessionArtifact: SessionArtifact | null | undefined;
  resolvedTheme?: "light" | "dark";
};

const STATUS_LABELS: Record<ReleaseReadinessStatus, string> = {
  insufficient_data: "Insufficient Data",
  not_ready: "Not Ready",
  weak: "Weak Readiness",
  partial: "Partial Readiness",
  ready_with_risk: "Ready With Risk",
  ready: "Ready",
  blocked: "Blocked",
};

function getStatusTone(status: ReleaseReadinessStatus): {
  border: string;
  background: string;
} {
  switch (status) {
    case "ready":
      return {
        border: "1px solid rgba(34,197,94,0.28)",
        background: "rgba(34,197,94,0.08)",
      };
    case "ready_with_risk":
    case "partial":
    case "weak":
      return {
        border: "1px solid rgba(245,158,11,0.28)",
        background: "rgba(245,158,11,0.08)",
      };
    case "not_ready":
    case "blocked":
      return {
        border: "1px solid rgba(239,68,68,0.28)",
        background: "rgba(239,68,68,0.08)",
      };
    case "insufficient_data":
    default:
      return {
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(148,163,184,0.06)",
      };
  }
}

export function ReleaseReadinessPanel({
  sessionArtifact,
  resolvedTheme = "dark",
}: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDark = resolvedTheme === "dark";

  const readiness = React.useMemo(
    () => buildReleaseReadinessSummary(sessionArtifact ?? null),
    [sessionArtifact]
  );

  const tone = getStatusTone(readiness.status);

  return (
    <section
      data-tour-anchor="release-readiness-panel"
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        background: isDark ? "rgba(255,255,255,0.035)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          padding: 14,
          display: "grid",
          gap: 10,
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 950 }}>
              Release Readiness Report
            </div>
            <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
              Deterministic release signal derived from requirement, suite,
              review, and execution evidence.
            </div>
            <ArtifactProvenanceLabel
              label="Release Readiness · Calculated from requirement, suite, review, and execution evidence"
              resolvedTheme={resolvedTheme}
            />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <span
              style={{
                border: tone.border,
                background: tone.background,
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {STATUS_LABELS[readiness.status]}
            </span>

            <span
              style={{
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                background: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(15,23,42,0.04)",
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              Confidence: {readiness.confidence}
            </span>

            <span
              aria-hidden="true"
              style={{
                fontSize: 16,
                opacity: 0.7,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 120ms ease",
              }}
            >
              ▾
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
          {readiness.summary}
        </div>
      </button>

      {isOpen ? (
        <div
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
            padding: 12,
          }}
        >
          <ExecutionResultsBreakdown factors={readiness.factors} />
          <ReleaseReadinessSummary readiness={readiness} />
        </div>
      ) : null}
    </section>
  );
}
