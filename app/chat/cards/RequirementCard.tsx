"use client";

import React, { useEffect, useState } from "react";

// M12.9 CHANGE:
// Keep RequirementCard presentational-only.
// It may expose contextual actions, but execution logic must stay in the hook/container.
type RequirementCardProps = {
  text: string;
  onGenerateTestsAction?: () => void;
  canGenerateTests?: boolean;
  isGeneratingTests?: boolean;
};

export default function RequirementCard({
  text,
  onGenerateTestsAction,
  canGenerateTests = false,
  isGeneratingTests = false,
}: RequirementCardProps) {
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

  const showGenerateTestsAction = typeof onGenerateTestsAction === "function";

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950 }}>Technical Requirement</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {showGenerateTestsAction ? (
            <button
              onClick={onGenerateTestsAction}
              disabled={!canGenerateTests || isGeneratingTests}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.20)",
                background:
                  !canGenerateTests || isGeneratingTests
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor:
                  !canGenerateTests || isGeneratingTests ? "not-allowed" : "pointer",
                opacity: !canGenerateTests || isGeneratingTests ? 0.55 : 1,
              }}
            >
              {isGeneratingTests ? "Generating…" : "Generate Tests"}
            </button>
          ) : null}

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