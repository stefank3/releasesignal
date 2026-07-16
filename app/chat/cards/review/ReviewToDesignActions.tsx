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
        borderRadius: 8,
        border: args.primary
          ? isDark
            ? "1px solid #D97757"
            : "1px solid #C15F3C"
          : isDark
            ? "1px solid #4A4739"
            : "1px solid #C4BCA7",
        background: args.disabled
          ? isDark
            ? "#302F2A"
            : "#EDEAE0"
          : args.primary
            ? isDark
              ? "#D97757"
              : "#C15F3C"
            : isDark
              ? "#35332C"
              : "#F1EDE2",
        color: args.disabled
          ? isDark
            ? "#7D796C"
            : "#8B8577"
          : args.primary
            ? "#FFFFFF"
            : isDark
              ? "#EDEAE3"
              : "#262521",
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

function hasActionableReviewGaps(gapCount: number): boolean {
  return gapCount > 0;
}

function hasActionableReviewImprovements(args: {
  gapCount: number;
  improvementCount: number;
}): boolean {
  return args.gapCount > 0 || args.improvementCount > 0;
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

  const canTargetGaps = hasActionableReviewGaps(gapCount);
  const canImproveFromReview = hasActionableReviewImprovements({
    gapCount,
    improvementCount,
  });
  const showGenerateFromGaps =
    canTargetGaps && typeof onGenerateFromGapsAction === "function";
  const showImproveTestPlan =
    canImproveFromReview && typeof onImproveTestPlanAction === "function";
  const hasVisibleActions = showGenerateFromGaps || showImproveTestPlan;

  const targetText = hasVisibleActions
    ? `${gapCount} gap${gapCount === 1 ? "" : "s"} and ${improvementCount} improvement${improvementCount === 1 ? "" : "s"} identified for the next test-plan update.`
    : "This review does not currently have prioritized gaps to turn into new tests.";

  return (
    <section
      aria-label="Review to test design actions"
      style={{
        border: isDark ? "1px solid #55452F" : "1px solid #DFC9AE",
        borderRadius: 12,
        padding: 14,
        background: isDark
          ? "linear-gradient(135deg,#33291F 0%,#262521 72%)"
          : "linear-gradient(135deg,#F0E2CE 0%,#F6F4ED 72%)",
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
          These actions use the latest saved review and test suite.
        </div>
        {hasVisibleActions ? (
          <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
            This may take a little longer while Release Signal evaluates the
            saved suite and review findings.
          </div>
        ) : null}
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.68 }}>
          {targetText}
        </div>
      </div>

      {hasVisibleActions ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {showImproveTestPlan ? (
            <ActionButton
              primary
              onClick={onImproveTestPlanAction}
              disabled={!canImproveTestPlan || isImprovingTestPlan}
              resolvedTheme={resolvedTheme}
            >
              {isImprovingTestPlan ? "Improving..." : "Improve Test Plan"}
            </ActionButton>
          ) : null}

          {showGenerateFromGaps ? (
            <ActionButton
              onClick={onGenerateFromGapsAction}
              disabled={!canGenerateFromGaps || isGeneratingFromGaps}
              resolvedTheme={resolvedTheme}
            >
              {isGeneratingFromGaps
                ? "Generating..."
                : "Generate Tests from Review Gaps"}
            </ActionButton>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
