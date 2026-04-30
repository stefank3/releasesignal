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
//
// M14 CHANGE:
// - add upload control for txt / md / csv suite ingestion
// - keep uploaded file state separate from freeform text input
// - show selected file marker in the composer
// - allow removing a selected file before send
// - do not place raw file content into the text input
//
// M14 FIX:
// - upload control is review-only
// - remove upload wording from non-review modes
//
// M14 FOLLOW-UP FIX:
// - show unsupported/read-failed upload errors inline instead of alert-only
// - make rejected uploads visible without creating artifacts or triggering review

"use client";

import React from "react";
import type { Mode } from "../chat.types";
import {
  buildPendingUploadedSuite,
  type PendingUploadedSuite,
} from "../hooks/helpers/uploadedSuiteRequest";

type Props = {
  mode: Mode;
  value: string;
  disabled?: boolean;
  resolvedTheme?: "light" | "dark";
  pendingUploadedSuite?: PendingUploadedSuite | null;

  // Naming ends with "Action" to avoid Next/TS “serializable props” warnings in some setups.
  onChangeAction: (next: string) => void;
  onSendAction: () => void;
  onPendingUploadedSuiteChangeAction?: (
    next: PendingUploadedSuite | null
  ) => void;
};

function getPlaceholder(mode: Mode): string {
  if (mode === "review") {
    return "Paste a test suite or upload a txt, md, or csv suite to evaluate.";
  }

  if (mode === "cases") {
    return "Describe the feature, refined requirement, or additional coverage to generate or extend.";
  }

  return "Describe the feature, workflow, scope, or requirement to refine.";
}

function getButtonLabel(mode: Mode, disabled?: boolean): string {
  if (disabled) return "Sending...";

  if (mode === "review") return "Review";
  if (mode === "cases") return "Generate Tests";
  return "Refine";
}

const ChatInput = React.forwardRef<HTMLInputElement, Props>(function ChatInput(
  {
    mode,
    value,
    disabled,
    resolvedTheme = "dark",
    pendingUploadedSuite = null,
    onChangeAction,
    onSendAction,
    onPendingUploadedSuiteChangeAction,
  },
  ref
) {
  const placeholder = getPlaceholder(mode);
  const buttonLabel = getButtonLabel(mode, disabled);

  const isDark = resolvedTheme === "dark";
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canUploadSuite = mode === "review";
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenFilePicker = () => {
    if (disabled || !canUploadSuite) return;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleRemoveSelectedFile = () => {
    setUploadError(null);
    onPendingUploadedSuiteChangeAction?.(null);
    clearFileInput();
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    try {
      const content = await file.text();

      if (!content || !content.trim()) {
        window.alert("The uploaded file is empty. Please upload a valid test suite.");
        event.target.value = "";
        return;
      }

    const pendingUpload = buildPendingUploadedSuite({
        filename: file.name,
        content,
      });

      if (!pendingUpload) {
        onPendingUploadedSuiteChangeAction?.(null);
        setUploadError(
          "Unsupported suite file. Upload a non-empty .txt, .md, or .csv test-suite file for review."
        );
        clearFileInput();
        return;
      }

      onPendingUploadedSuiteChangeAction?.(pendingUpload);
      setUploadError(null);
    } catch {
      onPendingUploadedSuiteChangeAction?.(null);
      setUploadError(
        "The selected file could not be read. Upload a plain text, markdown, or CSV suite file."
      );
      clearFileInput();
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      {canUploadSuite ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,text/plain,text/markdown,text/csv,.text,.markdown"
          onChange={handleFileSelected}
          style={{ display: "none" }}
          disabled={!!disabled}
        />
      ) : null}

      {canUploadSuite && uploadError ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: isDark
              ? "1px solid rgba(248,113,113,0.35)"
              : "1px solid rgba(220,38,38,0.28)",
            background: isDark
              ? "rgba(248,113,113,0.10)"
              : "rgba(220,38,38,0.06)",
            color: isDark ? "#fecaca" : "#7f1d1d",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          {uploadError}
        </div>
      ) : null}

      {canUploadSuite && pendingUploadedSuite ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(15,23,42,0.14)",
            background: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(15,23,42,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: isDark ? "rgba(255,255,255,0.9)" : "#0f172a",
              }}
            >
              Suite file selected
            </span>
            <span
              style={{
                fontSize: 13,
                color: isDark ? "rgba(255,255,255,0.75)" : "#334155",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={pendingUploadedSuite.filename}
            >
              {pendingUploadedSuite.filename} ({pendingUploadedSuite.format})
            </span>
          </div>

          <button
            type="button"
            onClick={handleRemoveSelectedFile}
            disabled={!!disabled}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: isDark
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(15,23,42,0.12)",
              background: isDark ? "rgba(0,0,0,0.28)" : "#ffffff",
              color: isDark ? "#fff" : "#0f172a",
              fontWeight: 800,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10 }}>
        <input
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

        {canUploadSuite ? (
          <button
            type="button"
            onClick={handleOpenFilePicker}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: isDark
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid rgba(15,23,42,0.14)",
              background: isDark ? "rgba(0,0,0,0.55)" : "#ffffff",
              color: isDark ? "#fff" : "#0f172a",
              fontWeight: 900,
              opacity: disabled ? 0.7 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
            }}
            disabled={!!disabled}
            title="Upload txt, md, or csv suite file"
          >
            Upload
          </button>
        ) : null}

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
    </div>
  );
});

export default ChatInput;