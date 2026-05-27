"use client";

import React from "react";

type Props = {
  gapCount: number;
  improvementCount: number;
  resolvedTheme?: "light" | "dark";
  onImproveTestPlanAction?: () => void;
  canImproveTestPlan?: boolean;
  isImprovingTestPlan?: boolean;
  onGenerateFromGapsAction?: () => void;
  canGenerateFromGaps?: boolean;
  isGeneratingFromGaps?: boolean;
};

function ActionButton(args: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={args.onClick}
      disabled={args.disabled || !args.onClick}
      style={{
        padding: "8px 11px",
        borderRadius: 10,
        border: args.primary
          ? isDark
            ? "1px solid rgba(125,211,252,0.35)"
            : "1px solid rgba(37,99,235,0.28)"
          : isDark
            ? "1px solid rgba(255,255,255,0.18)"
            : "1px solid rgba(15,23,42,0.14)",
        background: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(15,23,42,0.03)"
          : args.primary
            ? isDark
              ? "rgba(125,211,252,0.14)"
              : "rgba(37,99,235,0.08)"
            : isDark
              ? "rgba(255,255,255,0.07)"
              : "#ffffff",
        color: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.46)"
            : "rgba(15,23,42,0.46)"
          : isDark
            ? "#ffffff"
            : "#0f172a",
        cursor: args.disabled || !args.onClick ? "not-allowed" : "pointer",
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1.2,
      }}
    >
      {args.children}
    </button>
  );
}

export function ReviewToDesignActions({
  gapCount,
  improvementCount,
  resolvedTheme = "dark",
  onImproveTestPlanAction,
  canImproveTestPlan = false,
  isImprovingTestPlan = false,
  onGenerateFromGapsAction,
  canGenerateFromGaps = false,
  isGeneratingFromGaps = false,
}: Props) {
  const isDark = resolvedTheme === "dark";
  const hasActions =
    typeof onImproveTestPlanAction === "function" ||
    typeof onGenerateFromGapsAction === "function";

  if (!hasActions) return null;

  const hasReviewTargets = gapCount > 0 || improvementCount > 0;
  const targetText = hasReviewTargets
    ? `${gapCount} gap${gapCount === 1 ? "" : "s"} and ${improvementCount} improvement${improvementCount === 1 ? "" : "s"} available as targeting context.`
    : "No explicit review gaps were listed, but the current suite and review remain available as context.";

  return (
    <section
      aria-label="Review to test design actions"
      style={{
        border: isDark
          ? "1px solid rgba(125,211,252,0.20)"
          : "1px solid rgba(37,99,235,0.16)",
        borderRadius: 16,
        padding: 14,
        background: isDark ? "rgba(125,211,252,0.07)" : "rgba(37,99,235,0.045)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 950 }}>
          Use this review to improve the test plan
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.76 }}>
          Create targeted coverage for uncovered or partially covered areas.
          These actions use the latest persisted review and suite context.
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.68 }}>
          {targetText}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionButton
          primary
          onClick={onGenerateFromGapsAction}
          disabled={!canGenerateFromGaps || isGeneratingFromGaps}
          resolvedTheme={resolvedTheme}
        >
          {isGeneratingFromGaps
            ? "Generating..."
            : "Generate Tests from Review Gaps"}
        </ActionButton>

        <ActionButton
          onClick={onImproveTestPlanAction}
          disabled={!canImproveTestPlan || isImprovingTestPlan}
          resolvedTheme={resolvedTheme}
        >
          {isImprovingTestPlan ? "Improving..." : "Improve Test Plan"}
        </ActionButton>
      </div>
    </section>
  );
}
