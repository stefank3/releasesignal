"use client";

import type { UseChatSessionReturn } from "../../../hooks/useChatSession";

export type TestReviewEntrySurfaceProps = {
  prerequisiteChips: readonly string[];
  hasPersistentTestSuite: UseChatSessionReturn["hasPersistentTestSuite"];
  canReviewTestSuite: UseChatSessionReturn["canReviewTestSuite"];
  isRunningWorkflowAction: UseChatSessionReturn["isRunningWorkflowAction"];
  reviewTestSuite: UseChatSessionReturn["reviewTestSuite"];
  resolvedTheme: "light" | "dark";
  runBillableAction: (action: () => Promise<boolean>) => void;
};

export function TestReviewEntrySurface(args: TestReviewEntrySurfaceProps) {
  const isDark = args.resolvedTheme === "dark";
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedText = isDark ? "#A39F92" : "#6F6A5C";
  const hasSuite = args.hasPersistentTestSuite;

  return (
    <section
      aria-label="Test Review entry"
      style={{
        marginBottom: 12,
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 14,
        padding: 14,
        background: isDark ? "#262521" : "#F6F4ED",
        color: textColor,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 950 }}>Review Test Suite</div>
          <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.4 }}>
            Review the saved test suite for coverage gaps, risk areas, and
            improvement opportunities.
          </div>
        </div>
        <span
          style={{
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            borderRadius: 999,
            padding: "4px 8px",
            background: isDark ? "#302F2A" : "#EDEAE0",
            color: mutedText,
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          {hasSuite ? "Saved suite available" : "Needs a saved suite"}
        </span>
      </div>

      <div
        style={{
          border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
          borderRadius: 12,
          padding: 12,
          background: isDark ? "#21201C" : "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", minWidth: 0 }}>
          {args.prerequisiteChips.map((label) => (
            <span
              key={label}
              style={{
                border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
                borderRadius: 999,
                padding: "4px 8px",
                background: isDark ? "#302F2A" : "#EDEAE0",
                color: mutedText,
                fontSize: 10.5,
                fontWeight: 800,
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            args.runBillableAction(() => args.reviewTestSuite());
          }}
          disabled={!args.canReviewTestSuite}
          style={{
            borderRadius: 8,
            border: isDark ? "1px solid #D97757" : "1px solid #C15F3C",
            background: isDark ? "#D97757" : "#C15F3C",
            color: "#FFFFFF",
            padding: "8px 11px",
            fontSize: 12,
            fontWeight: 900,
            cursor: args.canReviewTestSuite ? "pointer" : "not-allowed",
            opacity: args.canReviewTestSuite ? 1 : 0.55,
            whiteSpace: "nowrap",
          }}
        >
          {args.isRunningWorkflowAction ? "Reviewing..." : "Review Test Suite"}
        </button>
      </div>

      {!hasSuite ? (
        <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.45 }}>
          Generate and save a test suite in Test Design before running workspace
          review.
        </div>
      ) : null}
    </section>
  );
}
