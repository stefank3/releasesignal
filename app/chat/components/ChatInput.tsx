// app/chat/components/ChatInput.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extract the input row (textbox + send button + placeholder + Enter-to-send)
// NOTE: no behavior change intended.

"use client";

import React from "react";
import type { Mode } from "../chat.types";

type Props = {
  mode: Mode;
  value: string;
  disabled?: boolean;

  // Naming ends with "Action" to avoid Next/TS “serializable props” warnings in some setups.
  onChangeAction: (next: string) => void;
  onSendAction: () => void;
};

const ChatInput = React.forwardRef<HTMLInputElement, Props>(function ChatInput(
  { mode, value, disabled, onChangeAction, onSendAction },
  ref,
) {
  const placeholder =
    mode === "review"
      ? "Paste test cases / test plan…"
      : mode === "cases"
        ? "Describe feature + acceptance criteria (or user story)…"
        : "Describe the feature / workflow…";

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChangeAction(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: "12px 14px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.92)",
          color: "#111",
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
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontWeight: 950,
          opacity: disabled ? 0.7 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        disabled={!!disabled}
      >
        {disabled ? "Sending…" : "Send"}
      </button>
    </div>
  );
});

export default ChatInput;