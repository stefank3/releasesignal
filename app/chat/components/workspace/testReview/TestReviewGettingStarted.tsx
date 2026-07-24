"use client";

export type TestReviewGettingStartedProps = {
  hasPersistentTestSuite: boolean;
  resolvedTheme: "light" | "dark";
};

export function TestReviewGettingStarted(
  args: TestReviewGettingStartedProps
) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <section
      aria-label="Test Review getting started"
      style={{
        marginBottom: 12,
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 12,
        padding: "12px 14px",
        background: isDark ? "#2B2A26" : "#FCFBF6",
        color: isDark ? "#EDEAE3" : "#262521",
        display: "grid",
        gap: 5,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950 }}>Getting started</div>
      <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.76 }}>
        {args.hasPersistentTestSuite
          ? "Review the saved suite for coverage gaps and improvement opportunities."
          : "Generate and save a test suite in Test Design before running workspace review."}
      </div>
    </section>
  );
}
