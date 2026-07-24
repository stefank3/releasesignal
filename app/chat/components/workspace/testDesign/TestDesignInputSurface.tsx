"use client";

import React from "react";
import type { UseChatSessionReturn } from "../../../hooks/useChatSession";

export type TestDesignInputSurfaceProps = {
  input: UseChatSessionReturn["input"];
  setInput: UseChatSessionReturn["setInput"];
  send: UseChatSessionReturn["send"];
  setInputElement: (node: HTMLTextAreaElement | null) => void;
  isBusy: boolean;
  resolvedTheme: "light" | "dark";
  runBillableAction: (action: () => Promise<boolean>) => void;
};

export function TestDesignInputSurface(args: TestDesignInputSurfaceProps) {
  const isDark = args.resolvedTheme === "dark";
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedText = isDark ? "#A39F92" : "#6F6A5C";
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <section
      aria-label="Test Design input"
      style={{
        marginBottom: 12,
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 14,
        padding: 14,
        background: isDark ? "#262521" : "#F6F4ED",
        color: textColor,
        display: "grid",
        gap: 10,
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
          <div style={{ fontSize: 13, fontWeight: 950 }}>Generate Tests</div>
          <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.4 }}>
            Describe the feature, requirement, or additional coverage you want
            included.
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
          Additional input
        </span>
      </div>

      <div
        style={{
          border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
          borderRadius: 12,
          padding: 12,
          background: isDark ? "#1B1A17" : "#FFFFFF",
          boxShadow: isFocused
            ? isDark
              ? "0 0 0 2px rgba(217,119,87,0.28)"
              : "0 0 0 2px rgba(193,95,60,0.20)"
            : "none",
        }}
      >
        <textarea
          id="test-design-freeform-input"
          aria-label="Additional Test Design input"
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Describe the feature, requirement, Jira/API change, or additional coverage to generate."
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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 10,
            paddingTop: 10,
            borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
          }}
        >
          <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.4 }}>
            Enter adds a new line. Press Ctrl+Enter or Cmd+Enter to submit.
          </div>
          <button
            type="button"
            onClick={() => {
              args.runBillableAction(() => args.send());
            }}
            disabled={args.isBusy}
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
              whiteSpace: "nowrap",
            }}
          >
            Generate Tests
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: mutedText, lineHeight: 1.45 }}>
        Generate tests from the context entered here. To generate directly from
        the saved requirement, use Generate Tests above.
      </div>
    </section>
  );
}
