// app/chat/components/FeatureWorkspaceSummary.tsx
// M12 Step 3:
// First visible feature-workspace layer.
// Shows artifact-backed session state for:
// - Refined Requirement
// - Test Suite
// - Review

"use client";

import React from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

type Props = {
  chat: UseChatSessionReturn;
  resolvedTheme?: "light" | "dark";
};

function StatusChip(args: {
  ready: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 74,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        border: args.ready
          ? isDark
            ? "1px solid rgba(34,197,94,0.28)"
            : "1px solid rgba(22,163,74,0.25)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        background: args.ready
          ? isDark
            ? "rgba(34,197,94,0.14)"
            : "rgba(22,163,74,0.10)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      {args.ready ? "Ready" : "Pending"}
    </span>
  );
}

function SummaryCard(args: {
  title: string;
  ready: boolean;
  description: string;
  meta?: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        padding: 12,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 950, color: isDark ? "#ffffff" : "#0f172a" }}>
          {args.title}
        </div>

        <StatusChip ready={args.ready} resolvedTheme={args.resolvedTheme} />
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.8 }}>
        {args.description}
      </div>

      {args.meta ? (
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
          {args.meta}
        </div>
      ) : null}
    </div>
  );
}

export default function FeatureWorkspaceSummary({
  chat,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  const requirementReady = chat.hasPinnedRequirement;
  const suiteReady = chat.hasPersistentTestSuite;
  const reviewReady = chat.hasReviewArtifact;

  const suiteVersion = chat.sessionArtifact?.testSuite?.version;
  const suiteCount = chat.sessionArtifact?.testSuite?.cases?.length ?? 0;
  const reviewScore = chat.sessionArtifact?.reviewResult?.score;

  return (
    <div
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 14,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 950 }}>
          Feature Workspace
        </div>

        <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
          This session is now tracked as a QA workspace backed by persisted artifacts.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <SummaryCard
          title="Requirement"
          ready={requirementReady}
          description={
            requirementReady
              ? "A Refined Requirement is available for this feature."
              : "The feature scope still needs refinement before downstream workflow steps."
          }
          meta={
            requirementReady
              ? "Strategy artifact present"
              : "No refined requirement saved yet"
          }
          resolvedTheme={resolvedTheme}
        />

        <SummaryCard
          title="Test Suite"
          ready={suiteReady}
          description={
            suiteReady
              ? "A generated test suite is available for this workspace."
              : "No persisted suite exists yet for this feature."
          }
          meta={
            suiteReady
              ? `Version ${suiteVersion ?? "—"} • ${suiteCount} case${suiteCount === 1 ? "" : "s"}`
              : "Generate the suite from the refined requirement"
          }
          resolvedTheme={resolvedTheme}
        />

        <SummaryCard
          title="Review"
          ready={reviewReady}
          description={
            reviewReady
              ? "A persisted review result is available for the current suite."
              : "Coverage review has not yet been completed for this suite."
          }
          meta={
            reviewReady
              ? `Review score: ${typeof reviewScore === "number" ? `${reviewScore}/100` : "available"}`
              : "Run Test Review against the current suite"
          }
          resolvedTheme={resolvedTheme}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          opacity: 0.72,
          lineHeight: 1.45,
          borderTop: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(15,23,42,0.08)",
          paddingTop: 10,
        }}
      >
        Current stage: <strong style={{ fontWeight: 900 }}>{chat.workflowStatus.title.replace("Workspace stage: ", "")}</strong>
        {" • "}
        Next: <strong style={{ fontWeight: 900 }}>{chat.workflowStatus.nextAction}</strong>
      </div>
    </div>
  );
}