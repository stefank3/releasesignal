"use client";

import React, { useEffect, useState } from "react";

// M12.9 CHANGE:
// Keep RequirementCard presentational-only.
// It may expose contextual actions, but execution logic must stay in the hook/container.
//
// M12.9 Phase 2 CHANGE:
// - add Refine Requirement action surface
// - keep visibility/enablement parent-driven
// - do not move workflow execution into the card
type RequirementCardProps = {
  text: string;
  onGenerateTestsAction?: () => void;
  canGenerateTests?: boolean;
  isGeneratingTests?: boolean;

  onRefineRequirementAction?: () => void;
  canRefineRequirement?: boolean;
  isRefiningRequirement?: boolean;
};

function SmallButton(args: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={args.onClick}
      disabled={args.disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.20)",
        background: args.disabled
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.10)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 900,
        cursor: args.disabled ? "not-allowed" : "pointer",
        opacity: args.disabled ? 0.55 : 1,
      }}
    >
      {args.children}
    </button>
  );
}

export default function RequirementCard({
  text,
  onGenerateTestsAction,
  canGenerateTests = false,
  isGeneratingTests = false,
  onRefineRequirementAction,
  canRefineRequirement = false,
  isRefiningRequirement = false,
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
  const showRefineRequirementAction =
    typeof onRefineRequirementAction === "function";

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

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {showRefineRequirementAction ? (
            <SmallButton
              onClick={() => {
                onRefineRequirementAction?.();
              }}
              disabled={!canRefineRequirement || isRefiningRequirement}
            >
              {isRefiningRequirement ? "Refining…" : "Refine Requirement"}
            </SmallButton>
          ) : null}

          {showGenerateTestsAction ? (
            <SmallButton
              onClick={() => {
                onGenerateTestsAction?.();
              }}
              disabled={!canGenerateTests || isGeneratingTests}
            >
              {isGeneratingTests ? "Generating…" : "Generate Tests"}
            </SmallButton>
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