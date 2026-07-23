"use client";

import React from "react";
import type { UseChatSessionReturn } from "../../../hooks/useChatSession";

export type CompactRequirementBarProps = {
  input: UseChatSessionReturn["input"];
  setInput: UseChatSessionReturn["setInput"];
  refinedRequirement?: unknown;
  setInputElement: (node: HTMLTextAreaElement | null) => void;
  isBusy: boolean;
  lastPending: UseChatSessionReturn["lastPending"];
  isSending: UseChatSessionReturn["isSending"];
  isRunningWorkflowAction: UseChatSessionReturn["isRunningWorkflowAction"];
  canRefineRequirement: UseChatSessionReturn["canRefineRequirement"];
  canGenerateTests: UseChatSessionReturn["canGenerateTests"];
  send: UseChatSessionReturn["send"];
  refineRequirement: UseChatSessionReturn["refineRequirement"];
  generateTestsFromRequirement: UseChatSessionReturn["generateTestsFromRequirement"];
  startNewSessionInMode: UseChatSessionReturn["startNewSessionInMode"];
  strategyPanel: React.ReactNode;
  resolvedTheme: "light" | "dark";
  onAfterUiAction?: () => void;
  onCreditsMayHaveChanged?: () => void;
};

export function CompactRequirementBar(args: CompactRequirementBarProps) {
  const isDark = args.resolvedTheme === "dark";
  const [isExpandedEditorOpen, setIsExpandedEditorOpen] = React.useState(false);
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);
  const version = (
    args.refinedRequirement as { version?: number } | undefined
  )?.version;
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedText = isDark ? "#A39F92" : "#6F6A5C";

  const runBillableAction = (action: () => Promise<boolean>) => {
    void (async () => {
      const creditsMayHaveChanged = await action();
      args.onAfterUiAction?.();
      if (creditsMayHaveChanged) {
        args.onCreditsMayHaveChanged?.();
      }
    })();
  };

  const buttonStyle: React.CSSProperties = {
    borderRadius: 12,
    border: isDark
      ? "1px solid #3A382F"
      : "1px solid #D9D3C2",
    background: isDark ? "#302F2A" : "#FFFFFF",
    color: textColor,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: args.isBusy ? "not-allowed" : "pointer",
    opacity: args.isBusy ? 0.58 : 1,
    boxShadow: isDark ? "none" : "0 3px 8px rgba(38,37,33,0.06)",
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: isDark ? "1px solid #D97757" : "1px solid #C15F3C",
    background: isDark ? "#D97757" : "#C15F3C",
    color: "#FFFFFF",
  };

  const destructiveTextButtonStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: isDark ? "#E8776A" : "#B0392E",
    padding: "8px 4px",
    fontSize: 12,
    fontWeight: 900,
    cursor: args.isBusy ? "not-allowed" : "pointer",
    opacity: args.isBusy ? 0.58 : 1,
  };

  return (
    <section
      aria-label="Saved requirement"
      data-tour-anchor="workflow-start"
      style={{
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
      }}
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
          borderBottom: isDark
            ? "1px solid #3A382F"
            : "1px solid #D9D3C2",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {args.lastPending &&
          !args.isSending &&
          !args.isRunningWorkflowAction ? (
            <button
              type="button"
              onClick={() => {
                runBillableAction(() => args.send({ replay: true }));
              }}
              style={buttonStyle}
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              runBillableAction(() => args.refineRequirement());
            }}
            style={primaryButtonStyle}
            disabled={args.isBusy || !args.canRefineRequirement}
          >
            Refine again
          </button>
          <button
            type="button"
            onClick={() => {
              runBillableAction(() => args.generateTestsFromRequirement());
            }}
            style={buttonStyle}
            disabled={args.isBusy || !args.canGenerateTests}
          >
            {args.isRunningWorkflowAction ? "Generating..." : "Generate Tests"}
          </button>
          <button
            type="button"
            onClick={() => {
              args.startNewSessionInMode("coach");
              args.onAfterUiAction?.();
            }}
            style={buttonStyle}
            disabled={args.isBusy}
          >
            New workspace
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            args.setInput("");
            args.onAfterUiAction?.();
          }}
          style={destructiveTextButtonStyle}
          disabled={args.isBusy}
          title="Clear the requirement editor input"
        >
          Clear input
        </button>
      </div>

      <div
        data-tour-anchor="start-here-input"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 950 }}>
              Requirement
            </div>
            <span
              style={{
                border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
                background: isDark ? "#302F2A" : "#FFFFFF",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 900,
                color: mutedText,
              }}
            >
              Saved - v{version ?? "n"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: mutedText, lineHeight: 1.45 }}>
            The saved requirement is driving this Strategy workspace. AI-assisted
            - review before you rely on it.
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="strategy-next-input"
          style={{
            display: "block",
            marginBottom: 7,
            color: textColor,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Next Strategy input
        </label>
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
            id="strategy-next-input"
            ref={(node) => {
              args.setInputElement(node);
            }}
            value={args.input}
            disabled={args.isBusy}
            onChange={(event) => {
              args.setInput(event.target.value);
            }}
            onFocus={() => setIsEditorFocused(true)}
            onBlur={() => setIsEditorFocused(false)}
            placeholder="Enter the next refinement, acceptance-criteria change, or requirement update."
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
              The saved requirement remains unchanged until you submit this next Strategy input.
            </div>
            <button
              type="button"
              onClick={() => {
                runBillableAction(() => args.send());
              }}
              style={buttonStyle}
              disabled={args.isBusy || !args.input.trim()}
            >
              Update requirement
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpandedEditorOpen((current) => !current)}
          style={{
            cursor: "pointer",
            width: "fit-content",
            border: "none",
            background: "transparent",
            padding: 0,
            marginTop: 10,
            color: mutedText,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {isExpandedEditorOpen ? "Hide expanded editor" : "Expand editor"}
        </button>

        {isExpandedEditorOpen ? (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {args.strategyPanel}
          </div>
        ) : null}
      </div>
    </section>
  );
}
