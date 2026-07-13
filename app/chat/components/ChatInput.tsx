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

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          id={inputId}
          ref={ref}
          value={value}
          onChange={(e) => onChangeAction(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 14,
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(15,23,42,0.14)",
            background: isDark ? "rgba(255,255,255,0.92)" : "#ffffff",
            color: "#111",
            outline: "none",
            boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.04)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSendAction();
          }}
          disabled={!!disabled}
        />

        <button
          onClick={onSendAction}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: isDark
              ? "1px solid rgba(255,255,255,0.14)"
              : "1px solid rgba(15,23,42,0.14)",
            background: isDark ? "rgba(0,0,0,0.55)" : "#ffffff",
            color: isDark ? "#fff" : "#0f172a",
            fontWeight: 950,
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
