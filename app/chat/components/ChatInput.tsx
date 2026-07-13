// app/chat/components/ChatInput.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extract the input row (textbox + send button + placeholder + Enter-to-send)
// NOTE: no behavior change intended.
//
// CHANGE (M8.3 Input UX Alignment):
// - align placeholders with Strategy / Test Design / Test Review terminology
// - use mode-aware primary button labels for stronger workflow clarity
// - keep behavior unchanged and lightweight for beta
//
// CHANGE (M10 UI Pass):
// - add theme-aware input/button styling
// - remove mixed hardcoded dark/light styling
// - improve visual consistency in light mode
//
// CHANGE (M10 Remaining Work - Assistant Tone Alignment):
// - shift input wording from chatbot-style phrasing to workflow-assistant phrasing
// - keep guidance task-oriented and QA-specific

"use client";

import React from "react";
import type { Mode } from "../chat.types";

type Props = {
  mode: Mode;
  value: string;
  disabled?: boolean;
  hasReviewArtifactContext?: boolean;
  inputId?: string;
  visualVariant?: "default" | "strategy-editor";
  resolvedTheme?: "light" | "dark";

  // Naming ends with "Action" to avoid Next/TS “serializable props” warnings in some setups.
  onChangeAction: (next: string) => void;
  onSendAction: () => void;
};

function getPlaceholder(mode: Mode): string {
  if (mode === "review") {
    return "Paste a test suite or test plan to review, or use workspace actions above.";
  }

  if (mode === "cases") {
    return "Describe the feature, refined requirement, or additional coverage to generate.";
  }

  return "Refine a requirement or paste a Jira/API change description.";
}

function getButtonLabel(mode: Mode, disabled?: boolean): string {
  if (disabled) return "Sending...";

  if (mode === "review") return "Review";
  if (mode === "cases") return "Generate Tests";
  return "Refine Requirement";
}

function getHelperText(
  mode: Mode,
  hasReviewArtifactContext?: boolean
): string | null {
  if (mode !== "review") return null;

  if (hasReviewArtifactContext) {
    return "For existing suites, use Review Suite or the Review Result actions so Release Signal uses the persisted artifact context. Paste here only when you want to review a separate suite or plan.";
  }

  return "Free-form review is for pasted test suites or test plans. Workspace actions appear when persisted artifacts are available.";
}

const ChatInput = React.forwardRef<HTMLInputElement, Props>(function ChatInput(
  {
    mode,
    value,
    disabled,
    hasReviewArtifactContext = false,
    inputId,
    visualVariant = "default",
    resolvedTheme = "dark",
    onChangeAction,
    onSendAction,
  },
  ref
) {
  const placeholder = getPlaceholder(mode);
  const buttonLabel = getButtonLabel(mode, disabled);
  const helperText = getHelperText(mode, hasReviewArtifactContext);

  const isDark = resolvedTheme === "dark";
  const isStrategyEditor = visualVariant === "strategy-editor";
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        marginTop: isStrategyEditor ? 0 : 14,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: isStrategyEditor ? "center" : undefined,
          flexWrap: isStrategyEditor ? "wrap" : undefined,
        }}
      >
        <input
          id={inputId}
          ref={ref}
          value={value}
          onChange={(e) => onChangeAction(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            minWidth: isStrategyEditor ? 240 : undefined,
            padding: isStrategyEditor ? "10px 12px" : "12px 14px",
            borderRadius: isStrategyEditor ? 12 : 14,
            border: isStrategyEditor
              ? isDark
                ? "1px solid #3A382F"
                : "1px solid #D9D3C2"
              : isDark
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(15,23,42,0.14)",
            background: isStrategyEditor
              ? isDark
                ? "#1B1A17"
                : "#FFFFFF"
              : isDark
                ? "rgba(255,255,255,0.92)"
                : "#ffffff",
            color: isStrategyEditor
              ? isDark
                ? "#EDEAE3"
                : "#262521"
              : "#111",
            outline: "none",
            boxShadow:
              isStrategyEditor && isFocused
                ? isDark
                  ? "0 0 0 2px rgba(217,119,87,0.28)"
                  : "0 0 0 2px rgba(193,95,60,0.20)"
                : isDark
                  ? "none"
                  : "0 4px 10px rgba(15,23,42,0.04)",
            colorScheme: isStrategyEditor ? (isDark ? "dark" : "light") : undefined,
          }}
          onFocus={isStrategyEditor ? () => setIsFocused(true) : undefined}
          onBlur={isStrategyEditor ? () => setIsFocused(false) : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSendAction();
          }}
          disabled={!!disabled}
        />

        <button
          onClick={onSendAction}
          style={{
            padding: isStrategyEditor ? "8px 11px" : "12px 16px",
            borderRadius: isStrategyEditor ? 12 : 14,
            border: isStrategyEditor
              ? isDark
                ? "1px solid #D97757"
                : "1px solid #C15F3C"
              : isDark
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid rgba(15,23,42,0.14)",
            background: isStrategyEditor
              ? isDark
                ? "#D97757"
                : "#C15F3C"
              : isDark
                ? "rgba(0,0,0,0.55)"
                : "#ffffff",
            color: isStrategyEditor ? "#FFFFFF" : isDark ? "#fff" : "#0f172a",
            fontWeight: isStrategyEditor ? 900 : 950,
            fontSize: isStrategyEditor ? 12 : undefined,
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
          }}
          disabled={!!disabled}
        >
          {buttonLabel}
        </button>
      </div>

      {helperText ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.45,
            color: isDark ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.62)",
          }}
        >
          {helperText}
        </div>
      ) : null}
    </div>
  );
});

export default ChatInput;
