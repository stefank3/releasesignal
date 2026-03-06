"use client";

import React, { useEffect, useState } from "react";

export default function RequirementCard({ text }: { text: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied ✓");
    } catch {
      setToast("Copy failed");
    }
  }

  return (
    <div
      style={{
        width: "100%",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(255,255,255,0.05)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 950 }}>Technical Requirement</div>

        <button
          onClick={copy}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Copy
        </button>
      </div>

      {toast ? (
        <div
          style={{
            fontSize: 11,
            opacity: 0.8,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            padding: "4px 8px",
            display: "inline-block",
            width: "fit-content",
          }}
        >
          {toast}
        </div>
      ) : null}

      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "inherit",
          color: "#fff",
        }}
      >
        {text}
      </pre>
    </div>
  );
}