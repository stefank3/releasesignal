"use client";

import type { UseChatSessionReturn } from "../../../hooks/useChatSession";

export type TestReviewSeparateSuiteDisclosureProps = {
  input: UseChatSessionReturn["input"];
  setInput: UseChatSessionReturn["setInput"];
  send: UseChatSessionReturn["send"];
  setInputElement: (node: HTMLTextAreaElement | null) => void;
  isBusy: boolean;
  resolvedTheme: "light" | "dark";
  runBillableAction: (action: () => Promise<boolean>) => void;
};

export function TestReviewSeparateSuiteDisclosure(
  args: TestReviewSeparateSuiteDisclosureProps
) {
  const isDark = args.resolvedTheme === "dark";
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedText = isDark ? "#A39F92" : "#6F6A5C";

  return (
    <section
      aria-label="Review a different suite or test plan"
      style={{
        marginBottom: 12,
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 12,
        padding: "12px 14px",
        background: isDark ? "#2B2A26" : "#FCFBF6",
        color: textColor,
      }}
    >
      <details>
        <summary
          style={{
            cursor: "pointer",
            color: textColor,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Review a different suite or test plan
        </summary>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: mutedText,
            lineHeight: 1.45,
          }}
        >
          Paste a separate suite for an independent review without changing the
          saved workspace suite.
        </div>
        <div
          style={{
            marginTop: 9,
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            borderRadius: 12,
            padding: 12,
            background: isDark ? "#1B1A17" : "#FFFFFF",
            display: "grid",
            gap: 7,
          }}
        >
          <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.45 }}>
            Use this option for a separate suite or plan. The saved workspace
            review remains unchanged.
          </div>
          <textarea
            id="test-review-freeform-input"
            aria-label="Separate suite or test plan"
            ref={(node) => {
              args.setInputElement(node);
            }}
            value={args.input}
            disabled={args.isBusy}
            onChange={(event) => args.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !args.isBusy
              ) {
                event.preventDefault();
                args.runBillableAction(() => args.send());
              }
            }}
            placeholder="Paste a separate test suite or test plan to review."
            rows={5}
            style={{
              width: "100%",
              minHeight: 132,
              resize: "vertical",
              boxSizing: "border-box",
              border: "none",
              background: "transparent",
              color: textColor,
              outline: "none",
              fontSize: 13,
              lineHeight: 1.55,
              fontFamily: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              paddingTop: 10,
              borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            }}
          >
            <button
              type="button"
              disabled={args.isBusy}
              onClick={() => {
                args.runBillableAction(() => args.send());
              }}
              style={{
                borderRadius: 8,
                border: isDark ? "1px solid #D97757" : "1px solid #C15F3C",
                background: isDark ? "#D97757" : "#C15F3C",
                color: "#FFFFFF",
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 900,
                cursor: args.isBusy ? "not-allowed" : "pointer",
                opacity: args.isBusy ? 0.55 : 1,
              }}
            >
              Review
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
