"use client";

import React, { useEffect, useState } from "react";
import { ArtifactProvenanceLabel } from "../components/workspace/ArtifactProvenanceLabel";
import { RequirementContentRenderer } from "./requirement/RequirementContentRenderer";

// M12.9 CHANGE:
// Keep RequirementCard presentational-only.
// It may expose contextual actions, but execution logic must stay in the hook/container.
//
// M12.9 Phase 2 CHANGE:
// - add Refine Requirement action surface
// - keep visibility/enablement parent-driven
// - do not move workflow execution into the card
//
// M12.10 CHANGE:
// - separate requirement workflow actions from local copy action
// - improve readability of action availability at the card level
// - add theme-aware styling to match the rest of the workspace
// - preserve existing action behavior and presentational-only role

type RequirementCardProps = {
  text: string;
  resolvedTheme?: "light" | "dark";
  provenanceLabel?: string;
  provenanceDescription?: string;

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
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={args.onClick}
      disabled={args.disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: isDark
          ? "1px solid rgba(255,255,255,0.20)"
          : "1px solid rgba(15,23,42,0.14)",
        background: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(15,23,42,0.03)"
          : isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(15,23,42,0.05)",
        color: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.45)"
            : "rgba(15,23,42,0.45)"
          : isDark
            ? "#ffffff"
            : "#0f172a",
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

function SectionLabel(args: {
  title: string;
  description?: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.2,
          color: isDark ? "#ffffff" : "#0f172a",
          opacity: 0.92,
        }}
      >
        {args.title}
      </div>

      {args.description ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: isDark
              ? "rgba(255,255,255,0.68)"
              : "rgba(15,23,42,0.62)",
          }}
        >
          {args.description}
        </div>
      ) : null}
    </div>
  );
}

export default function RequirementCard({
  text,
  resolvedTheme = "dark",
  provenanceLabel,
  provenanceDescription,
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

  const isDark = resolvedTheme === "dark";

  const showGenerateTestsAction = typeof onGenerateTestsAction === "function";
  const showRefineRequirementAction =
    typeof onRefineRequirementAction === "function";

  const workflowHint =
    showGenerateTestsAction || showRefineRequirementAction
      ? "These actions use the persisted requirement artifact for downstream workflow steps."
      : "No workflow actions are available on this requirement card.";

  return (
    <div
      style={{
        width: "100%",
        border: isDark
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(15,23,42,0.12)",
        borderRadius: 16,
        padding: 16,
        background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
        color: isDark ? "#ffffff" : "#0f172a",
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
            fontSize: 11,
            fontWeight: 900,
            padding: "4px 8px",
            borderRadius: 999,
            border: isDark
              ? "1px solid rgba(255,255,255,0.14)"
              : "1px solid rgba(15,23,42,0.12)",
            background: isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(15,23,42,0.04)",
            color: isDark
              ? "rgba(255,255,255,0.82)"
              : "rgba(15,23,42,0.82)",
          }}
        >
          Requirement artifact
        </div>
      </div>

      {provenanceLabel || provenanceDescription ? (
        <div style={{ display: "grid", gap: 6 }}>
          {provenanceLabel ? (
            <ArtifactProvenanceLabel
              label={provenanceLabel}
              resolvedTheme={resolvedTheme}
            />
          ) : null}

          {provenanceDescription ? (
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.76 }}>
              {provenanceDescription}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <SectionLabel
            title="Workflow actions"
            description={workflowHint}
            resolvedTheme={resolvedTheme}
          />

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
                resolvedTheme={resolvedTheme}
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
                resolvedTheme={resolvedTheme}
              >
                {isGeneratingTests ? "Generating…" : "Generate Tests"}
              </SmallButton>
            ) : null}
          </div>
        </div>

        <div>
          <SectionLabel
            title="Local action"
            description="Copy the current requirement text for external use."
            resolvedTheme={resolvedTheme}
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <SmallButton
              onClick={copy}
              resolvedTheme={resolvedTheme}
            >
              Copy
            </SmallButton>
          </div>
        </div>
      </div>

      {toast ? (
        <div
          style={{
            fontSize: 11,
            opacity: 0.8,
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(15,23,42,0.10)",
            borderRadius: 999,
            padding: "4px 8px",
            display: "inline-block",
            width: "fit-content",
          }}
        >
          {toast}
        </div>
      ) : null}

      <div>
        <SectionLabel
          title="Requirement content"
          description="Current rendered requirement text for this workspace. Section formatting is display-only."
          resolvedTheme={resolvedTheme}
        />

        <RequirementContentRenderer
          text={text}
          resolvedTheme={resolvedTheme}
        />
      </div>
    </div>
  );
}
