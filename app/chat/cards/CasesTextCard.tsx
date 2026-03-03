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
        border: "1px solid #ddd",
        background: "#fff",
        color: "#111",
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
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied ✓");
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
        boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
        color: "#111",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 950 }}>Generated Test Cases</div>
          <div style={{ fontSize: 12, color: "#666" }}>Copy-paste into Jira/Xray</div>
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
            border: "1px solid #e6e6e6",
            background: "#fff",
            color: "#111",
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
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
        }}
      >
        {text}
      </pre>
    </div>
  );
}