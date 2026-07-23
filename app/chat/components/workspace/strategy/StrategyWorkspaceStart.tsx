"use client";

import React from "react";
import {
  CompactRequirementBar,
  type CompactRequirementBarProps,
} from "./CompactRequirementBar";

export type StrategyWorkspaceStartProps = CompactRequirementBarProps & {
  hasWorkspaceArtifacts: boolean;
};

export function StrategyWorkspaceStart(args: StrategyWorkspaceStartProps) {
  const { hasWorkspaceArtifacts, ...compactRequirementBarProps } = args;
  const isDark = args.resolvedTheme === "dark";
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedText = isDark ? "#A39F92" : "#6F6A5C";

  const surfaceStyle: React.CSSProperties = {
    marginBottom: 12,
    border: isDark
      ? "1px solid #3A382F"
      : "1px solid #D9D3C2",
    borderRadius: 14,
    padding: 14,
    background: isDark ? "#262521" : "#F6F4ED",
    color: textColor,
    display: "grid",
    gap: 12,
  };

  const inputShellStyle: React.CSSProperties = {
    border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
    borderRadius: 12,
    padding: 12,
    background: isDark ? "#1B1A17" : "#FFFFFF",
    display: "grid",
    gap: 8,
  };

  const secondaryShellStyle: React.CSSProperties = {
    display: "grid",
    gap: 10,
    borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
    paddingTop: 12,
  };

  const exampleChipStyle: React.CSSProperties = {
    border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
    borderRadius: 999,
    padding: "4px 8px",
    background: isDark ? "#302F2A" : "#FFFFFF",
    color: mutedText,
    fontSize: 11,
    fontWeight: 900,
  };

  const emptyActionButtonStyle: React.CSSProperties = {
    borderRadius: 12,
    border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
    background: isDark ? "#302F2A" : "#FFFFFF",
    color: textColor,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: args.isBusy ? "not-allowed" : "pointer",
    opacity: args.isBusy ? 0.58 : 1,
    boxShadow: isDark ? "none" : "0 3px 8px rgba(38,37,33,0.06)",
  };

  const emptyClearInputStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: isDark ? "#E8776A" : "#B0392E",
    padding: "8px 4px",
    fontSize: 12,
    fontWeight: 900,
    cursor: args.isBusy ? "not-allowed" : "pointer",
    opacity: args.isBusy ? 0.58 : 1,
  };

  const emptyPrimaryActionStyle: React.CSSProperties = {
    ...emptyActionButtonStyle,
    border: isDark ? "1px solid #D97757" : "1px solid #C15F3C",
    background: isDark ? "#D97757" : "#C15F3C",
    color: "#FFFFFF",
  };

  const submitRequirement = () => {
    void (async () => {
      const creditsMayHaveChanged = await args.send();
      args.onAfterUiAction?.();
      if (creditsMayHaveChanged) {
        args.onCreditsMayHaveChanged?.();
      }
    })();
  };

  if (hasWorkspaceArtifacts) {
    return (
      <CompactRequirementBar {...compactRequirementBarProps} />
    );
  }

  return (
    <section
      aria-label="Strategy workspace start"
      data-tour-anchor="workflow-start"
      style={surfaceStyle}
    >
      <div
        aria-label="Workspace action bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          paddingBottom: 12,
          borderBottom: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        }}
      >
        <button
          type="button"
          onClick={() => {
            args.startNewSessionInMode("coach");
            args.onAfterUiAction?.();
          }}
          style={emptyActionButtonStyle}
          disabled={args.isBusy}
        >
          New workspace
        </button>

        <button
          type="button"
          onClick={() => {
            args.setInput("");
            args.onAfterUiAction?.();
          }}
          style={emptyClearInputStyle}
          disabled={args.isBusy}
          title="Clear the requirement input"
        >
          Clear input
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 6, maxWidth: 860 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 950,
                textTransform: "uppercase",
                color: textColor,
                opacity: 0.68,
              }}
            >
              Strategy
            </div>

            <h2
              style={{
                margin: "4px 0 0",
                color: textColor,
                fontSize: 20,
                lineHeight: 1.2,
                fontWeight: 950,
              }}
            >
              Start with the change you need to test.
            </h2>
          </div>

          <p
            style={{
              margin: 0,
              color: mutedText,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Paste a product requirement, user story, API specification, bug fix,
            or workflow change. Release Signal will help refine it into
            structured QA coverage for your review.
          </p>
        </div>

        <div
          data-tour-anchor="start-here-input"
          style={inputShellStyle}
        >
          <div style={{ display: "grid", gap: 3 }}>
            <label
              htmlFor="strategy-requirement-input"
              style={{
                color: textColor,
                fontSize: 13,
                fontWeight: 950,
              }}
            >
              Requirement input
            </label>
            <div style={{ fontSize: 12, color: mutedText, lineHeight: 1.45 }}>
              AI-assisted refinement. Review the structured requirement before
              generating tests.
            </div>
          </div>

          <div
            style={{
              border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
              borderRadius: 12,
              background: isDark ? "#1B1A17" : "#FFFFFF",
              padding: 12,
              boxShadow: isEditorFocused
                ? isDark
                  ? "0 0 0 2px rgba(217,119,87,0.28)"
                  : "0 0 0 2px rgba(193,95,60,0.20)"
                : "none",
            }}
          >
            <textarea
              id="strategy-requirement-input"
              ref={(node) => {
                args.setInputElement(node);
              }}
              aria-label="Requirement input"
              value={args.input}
              disabled={args.isBusy}
              onChange={(event) => args.setInput(event.target.value)}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={() => setIsEditorFocused(false)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !args.isBusy
                ) {
                  event.preventDefault();
                  submitRequirement();
                }
              }}
              placeholder="Refine a requirement or paste a Jira/API change description."
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
                Enter adds a new line. Press Ctrl+Enter or Cmd+Enter to refine.
              </div>
              <button
                type="button"
                onClick={submitRequirement}
                style={emptyPrimaryActionStyle}
                disabled={args.isBusy}
              >
                {args.isBusy ? "Sending..." : "Refine Requirement"}
              </button>
            </div>
          </div>

          <div
            aria-label="Requirement examples"
            style={{ display: "flex", gap: 7, flexWrap: "wrap" }}
          >
            {["User story", "API requirement", "Bug fix", "Workflow change"].map(
              (label) => (
                <span key={label} style={exampleChipStyle}>
                  {label}
                </span>
              )
            )}
          </div>
        </div>

        <div style={secondaryShellStyle}>
          {args.strategyPanel}

        </div>
      </div>
    </section>
  );
}
