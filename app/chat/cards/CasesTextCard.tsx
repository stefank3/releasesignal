// app/chat/cards/CasesTextCard.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted CasesTextCard from page.tsx (no behavior change).

"use client";

import React, { useEffect, useState } from "react";

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)", // CHANGE: dark-friendly border
        background: "rgba(255,255,255,0.06)", // CHANGE: dark-friendly surface
        color: "#fff", // CHANGE: dark-friendly text
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function CasesTextCard({ text }: { text: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const copyText = async () => {
    // CHANGE: Clipboard API is best, but fallback improves reliability (non-HTTPS / permissions).
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied ✓");
      return;
    } catch {
      // continue to fallback below
    }

    try {
      // CHANGE (lint fix):
      // Create a fresh textarea for legacy copy fallback instead of mutating
      // a memoized DOM element reference.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.setAttribute("readonly", "true");

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);

      setToast(ok ? "Copied ✓" : "Copy failed (clipboard blocked)");
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)", // CHANGE: dark-friendly border
        borderRadius: 18,
        padding: 20,
        background: "rgba(255,255,255,0.05)", // CHANGE: matches chat panel surfaces
        boxShadow: "0 10px 26px rgba(0,0,0,0.22)", // CHANGE: closer to your dark aesthetic
        color: "#fff", // CHANGE: dark-friendly text
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 950 }}>Generated Test Cases</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)" }}>Copy-paste into Jira/Xray</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <SmallButton onClick={copyText}>Copy</SmallButton>
        </div>
      </div>

      {toast && (
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)", // CHANGE: dark-friendly chip
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      )}

      <pre
        style={{
          marginTop: 14,
          whiteSpace: "pre-wrap",
          fontSize: 13,
          lineHeight: 1.55,
          background: "rgba(0,0,0,0.22)", // CHANGE: dark-friendly code surface
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 14,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {text}
      </pre>
    </div>
  );
}