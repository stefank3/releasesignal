// app/chat/components/ChatPanel.tsx
// M7: Extract chat body (messages + guided suggestions + input) from page.tsx.
//
// CHANGE (M7.5 UX Polish):
// - unify message list + input into one left-side surface
// - reduce visual separation between chat and strategy panel
// - improve proportions on desktop
// - keep responsive stacking on narrow screens
//
// CHANGE (M7.7 Onboarding):
// - add a lightweight first-run hint for empty sessions
// - guide users toward the intended Coach → Strategy Panel → Cases workflow
//
// CHANGE (M8.4 Workflow Clarity):
// - align visible onboarding language with Strategy / Test Design / Test Review
// - make the Strategy area visually more distinct from the chat
// - slightly increase Strategy panel presence on desktop
// - clarify the intended workflow in the empty state
//
// CHANGE (M8.8 Use Refined Requirement):
// - adds a helper action in Test Design mode
// - lets users prefill the input from the pinned Refined Requirement
// - reduces copy/paste friction during beta
// - does not auto-send; user can still adjust before generation
//
// CHANGE (M10 UI Pass):
// - add theme-aware panel styling
// - remove dark-only hardcoded shell assumptions
// - prepare panel surfaces for light / dark / system theme support
// - keep behavior unchanged
//
// CHANGE (M10 Remaining Work - Task 1):
// - add visible AI processing indicator
// - reduce the perception that the product is frozen during model execution
// - keep messaging aligned with workflow assistant behavior
//
// CHANGE (M10 Remaining Work - Assistant Tone Alignment):
// - shift onboarding language away from chatbot cues
// - reinforce workflow-assistant positioning
//
// CHANGE (M12 Step 1 - Workflow Progression Awareness):
// - consume workflow progression state from useChatSession
// - extract workflow banner into a dedicated child component
// - keep ChatPanel focused on workspace layout orchestration
//
// M12.9 CHANGE:
// - pass contextual workflow action props into the message renderer
// - treat workflow actions as a busy state for shared panel UX
// - keep orchestration in hook; keep panel as layout + prop passing only
//
// M12.9 Phase 2 CHANGE:
// - thread Refine Requirement action through panel-level message wiring
// - keep action visibility and execution hook-driven
// - do not introduce prompt-dependent fallback behavior
//
// M12.9 Phase 2 CHANGE:
// - thread Improve / Regenerate Suite action through panel-level message wiring
// - keep it distinct from Generate Next Batch
// - keep action visibility and execution hook-driven
//
// M12.10 CHANGE:
// - visually separate artifact summary from workflow guidance
// - reduce perceived duplication in the workspace overview area
// - keep summary + banner both visible but easier to distinguish
// - preserve existing workflow behavior and rendering order
//
// M12.11 CHANGE:
// - strengthen first-run guidance and empty-state clarity
// - add presentational onboarding copy around how the workspace is used
// - keep all workflow/artifact decisions hook-driven and unchanged
//
// M12.15 FOLLOW-UP CHANGE:
// - pass chat artifact context into the workflow banner
// - allow compact release-health reinforcement in the banner
// - keep ChatPanel orchestration-only
//
// M17 CHANGE:
// - render ReleaseReadinessPanel below FeatureWorkspaceSummary
// - keep readiness outside the compact artifact card grid
// - keep ChatPanel as layout orchestration only

"use client";

import React, { useEffect, useRef, useState } from "react";
import { buildReleaseReadinessSummary } from "@/lib/release-readiness/releaseReadinessService";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession.helpers";

import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import ChatWorkflowBanner from "./ChatWorkflowBanner";
import FeatureWorkspaceSummary from "./FeatureWorkspaceSummary";
import { ReleaseReadinessPanel, STATUS_LABELS } from "./ReleaseReadinessPanel";
import StrategyPanel from "./StrategyPanel";
import { ActivityTimelinePanel } from "./workspace/ActivityTimelinePanel";
import { ArtifactDocumentSurface } from "./workspace/ArtifactDocumentSurface";
import { getLatestArtifactDocumentIndexesToHide } from "./workspace/artifactDocumentItems";

type Props = {
  chat: UseChatSessionReturn;
  onAfterSendAction?: () => void;
  resolvedTheme?: "light" | "dark";
};

function OnboardingHint(args: {
  showStrategyHint: boolean;
  hasWorkspaceArtifacts: boolean;
  nextAction: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        padding: 12,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.92 }}>
          Getting started
        </div>

        <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.5 }}>
          This workspace helps you clarify a requirement, generate a structured
          test suite, and review coverage against the saved artifacts.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 4,
          padding: "8px 10px",
          borderRadius: 10,
          border: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(15,23,42,0.08)",
          background: isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.72)",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.82 }}>
          Start here
        </div>

        <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
          Start by refining a requirement or pasting a Jira/API change description.
          {args.showStrategyHint
            ? " Use Strategy to clarify scope and risks first, then continue into Test Design."
            : ""}
        </div>

        <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
          Next suggested move:{" "}
          <strong style={{ fontWeight: 900 }}>{args.nextAction}</strong>
        </div>
      </div>

      <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
        Example:
        <br />
        <span style={{ opacity: 0.88 }}>
          Paste a Jira ticket for login with MFA, clarify scope and risks, then
          generate a structured test suite.
        </span>
      </div>

      {/* M12.11 NOTE:
          Clarifies what users should expect from an empty workspace.
          Informational only; no state or workflow ownership. */}
      <div style={{ fontSize: 11, opacity: 0.66, lineHeight: 1.45 }}>
        {args.hasWorkspaceArtifacts
          ? "Saved workspace artifacts will remain visible above the chat as you continue."
          : "No saved requirement, suite, or review exists yet for this workspace."}
      </div>
    </div>
  );
}

function WorkspaceSectionLabel(args: {
  title: string;
  description: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        marginBottom: 8,
        paddingLeft: 2,
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <div
        style={{ fontSize: 11, fontWeight: 950, opacity: 0.9, letterSpacing: 0.2 }}
      >
        {args.title}
      </div>
      <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.4 }}>
        {args.description}
      </div>
    </div>
  );
}

function EmptyWorkspaceHint(args: { resolvedTheme: "light" | "dark" }) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 12,
        border: isDark
          ? "1px dashed rgba(255,255,255,0.12)"
          : "1px dashed rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.6)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.84 }}>
        Empty workspace
      </div>
      <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.45 }}>
        Once you save a refined requirement, generate a suite, or complete a
        review, the latest persisted workspace state will appear here.
      </div>
    </div>
  );
}

const strategyWorkflowSteps = [
  {
    title: "Refine requirement",
    body: "Clarify scope, rules, risks.",
    tourAnchor: "workflow-preview-requirement",
  },
  {
    title: "Generate test suite",
    body: "Structured, reviewable cases.",
    tourAnchor: "workflow-preview-test-design",
  },
  {
    title: "Review coverage",
    body: "Find gaps and weak checks.",
    tourAnchor: "workflow-preview-review",
  },
  {
    title: "Add execution results",
    body: "Upload pass/fail evidence.",
    tourAnchor: "workflow-preview-results",
  },
  {
    title: "Release readiness",
    body: "Your decision-support signal.",
    tourAnchor: "workflow-preview-readiness",
  },
];

function WorkflowPreview(args: { resolvedTheme: "light" | "dark" }) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: isDark ? "rgba(255,255,255,0.58)" : "rgba(15,23,42,0.56)",
        }}
      >
        What happens next
      </div>

      <div
        aria-label="What happens next"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
        }}
      >
        {strategyWorkflowSteps.map((step, index) => (
          <div
            key={step.title}
            data-tour-anchor={step.tourAnchor}
            style={{
              borderRadius: 12,
              border: isDark
                ? "1px dashed rgba(255,255,255,0.12)"
                : "1px dashed rgba(15,23,42,0.14)",
              background: isDark ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.025)",
              padding: 12,
              display: "grid",
              gap: 8,
              minHeight: 118,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.12)"
                  : "1px solid rgba(15,23,42,0.12)",
                color: isDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.68)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {index + 1}
            </div>
            <div
              style={{
                color: isDark ? "rgba(255,255,255,0.82)" : "rgba(15,23,42,0.82)",
                fontSize: 13,
                fontWeight: 900,
                lineHeight: 1.25,
              }}
            >
              {step.title}
            </div>
            <div
              style={{
                color: isDark ? "rgba(255,255,255,0.58)" : "rgba(15,23,42,0.58)",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              {step.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeStageTitle(title: string | undefined): string {
  return (
    String(title ?? "").replace(/^Workspace stage:\s*/i, "").trim() || "Unknown"
  );
}

function getStageIndex(args: {
  currentStage: string;
  requirementReady: boolean;
  suiteReady: boolean;
  reviewReady: boolean;
  executionEvidenceReady: boolean;
}): number {
  const stage = args.currentStage.toLowerCase();

  if (stage.includes("execution") || args.executionEvidenceReady) return 4;
  if (stage.includes("review") || args.reviewReady) return 3;
  if (stage.includes("test design") || stage.includes("suite") || args.suiteReady) {
    return 2;
  }
  return 1;
}

function toReviewStrength(score: number | null | undefined): string | null {
  if (typeof score !== "number") return null;
  if (score >= 90) return "Strong";
  if (score >= 75) return "Usable";
  if (score >= 50) return "Mixed";
  return "Weak";
}

function Pill(args: {
  label: string;
  tone?: "neutral" | "positive" | "info" | "warning";
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const tone = args.tone ?? "neutral";
  const border =
    tone === "positive"
      ? isDark
        ? "1px solid rgba(34,197,94,0.30)"
        : "1px solid rgba(22,163,74,0.24)"
      : tone === "info"
        ? isDark
          ? "1px solid rgba(96,165,250,0.30)"
          : "1px solid rgba(37,99,235,0.22)"
        : tone === "warning"
          ? isDark
            ? "1px solid rgba(245,158,11,0.34)"
            : "1px solid rgba(217,119,6,0.26)"
          : isDark
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(15,23,42,0.12)";
  const background =
    tone === "positive"
      ? isDark
        ? "rgba(34,197,94,0.13)"
        : "rgba(22,163,74,0.09)"
      : tone === "info"
        ? isDark
          ? "rgba(96,165,250,0.13)"
          : "rgba(37,99,235,0.08)"
        : tone === "warning"
          ? isDark
            ? "rgba(245,158,11,0.13)"
            : "rgba(245,158,11,0.10)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        border,
        background,
        borderRadius: 999,
        padding: "5px 9px",
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {args.label}
    </span>
  );
}

function PopulatedCommandBand(args: {
  chat: UseChatSessionReturn;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const artifact = args.chat.sessionArtifact;
  const reviewScore = artifact?.reviewResult?.score;
  const reviewStrength = toReviewStrength(reviewScore);
  const readiness = buildReleaseReadinessSummary(artifact ?? null);
  const currentStage = normalizeStageTitle(args.chat.workflowStatus.title);
  const stageIndex = getStageIndex({
    currentStage,
    requirementReady: args.chat.hasPinnedRequirement,
    suiteReady: args.chat.hasPersistentTestSuite,
    reviewReady: args.chat.hasReviewArtifact,
    executionEvidenceReady: !!artifact?.executionIntelligence,
  });
  const workspaceName =
    args.chat.sessions.find((session) => session.id === args.chat.activeSessionId)
      ?.title?.trim() || "Feature workspace";
  const reviewLabel =
    typeof reviewScore === "number"
      ? `Review Score: ${reviewScore}/100${reviewStrength ? ` - ${reviewStrength}` : ""}`
      : "Review Score: Not reviewed yet";
  const readinessNeedsExecution = !readiness.factors.executionEvidencePresent;
  const readinessLabel =
    readiness.status === "insufficient_data" && readinessNeedsExecution
      ? "Readiness: Not enough data yet - Needs execution"
      : `Readiness: ${STATUS_LABELS[readiness.status]}`;
  const nextAction = readinessNeedsExecution
    ? "Next: add execution results to generate your readiness signal."
    : `Next: ${args.chat.workflowStatus.nextAction}`;

  return (
    <section
      aria-label="Strategy command center"
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 14,
        background: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.76)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 10,
        boxShadow: isDark
          ? "0 8px 30px rgba(0,0,0,0.12)"
          : "0 8px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 950 }}>
          Stage {stageIndex} of 5 - {workspaceName}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill
            label={reviewLabel}
            tone={typeof reviewScore === "number" ? "positive" : "neutral"}
            resolvedTheme={args.resolvedTheme}
          />
          <Pill
            label={readinessLabel}
            tone={readiness.status === "insufficient_data" ? "warning" : "info"}
            resolvedTheme={args.resolvedTheme}
          />
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
        {nextAction}
      </div>
    </section>
  );
}

function CompactRequirementBar(args: {
  chat: UseChatSessionReturn;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  resolvedTheme: "light" | "dark";
  onAfterSendAction?: () => void;
}) {
  const isDark = args.resolvedTheme === "dark";
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const version = (
    args.chat.sessionArtifact?.refinedRequirement as { version?: number } | undefined
  )?.version;
  const textColor = isDark ? "#ffffff" : "#0f172a";
  const mutedText = isDark ? "rgba(255,255,255,0.70)" : "rgba(15,23,42,0.64)";
  const editorInput = buildRefinedRequirementInput(args.chat.sessionArtifact);

  const buttonStyle: React.CSSProperties = {
    borderRadius: 12,
    border: isDark
      ? "1px solid rgba(255,255,255,0.16)"
      : "1px solid rgba(15,23,42,0.14)",
    background: isDark ? "rgba(255,255,255,0.08)" : "#ffffff",
    color: textColor,
    padding: "8px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: args.isBusy ? "not-allowed" : "pointer",
    opacity: args.isBusy ? 0.58 : 1,
    boxShadow: isDark ? "none" : "0 3px 8px rgba(15,23,42,0.04)",
  };

  return (
    <section
      aria-label="Saved requirement"
      data-tour-anchor="workflow-start"
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 14,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.72)",
        color: textColor,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        data-tour-anchor="start-here-input"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 950 }}>
            Requirement saved - v{version ?? "n"}
          </div>
          <div style={{ fontSize: 12, color: mutedText, lineHeight: 1.45 }}>
            The saved requirement is driving this Strategy workspace. AI-assisted
            - review before you rely on it.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setIsEditorOpen(true);
              if (editorInput) {
                args.chat.setInput(editorInput);
              }
              window.setTimeout(() => args.inputRef.current?.focus(), 0);
            }}
            style={buttonStyle}
            disabled={args.isBusy}
          >
            Update requirement
          </button>
          <button
            type="button"
            onClick={() => {
              void args.chat.refineRequirement();
            }}
            style={buttonStyle}
            disabled={args.isBusy || !args.chat.canRefineRequirement}
          >
            Refine again
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setIsEditorOpen((current) => !current)}
          style={{
            cursor: "pointer",
            width: "fit-content",
            border: "none",
            background: "transparent",
            padding: 0,
            color: mutedText,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {isEditorOpen ? "Collapse editor" : "Expand editor"}
        </button>

        {isEditorOpen ? (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <ChatInput
              ref={args.inputRef}
              mode={args.chat.mode}
              value={args.chat.input}
              disabled={args.isBusy}
              resolvedTheme={args.resolvedTheme}
              onChangeAction={(next: string) => args.chat.setInput(next)}
              onSendAction={() => {
                void (async () => {
                  await args.chat.send();
                  args.onAfterSendAction?.();
                })();
              }}
            />
            <StrategyPanel chat={args.chat} resolvedTheme={args.resolvedTheme} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StrategyWorkspaceStart(args: {
  chat: UseChatSessionReturn;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  hasWorkspaceArtifacts: boolean;
  resolvedTheme: "light" | "dark";
  onAfterSendAction?: () => void;
}) {
  const isDark = args.resolvedTheme === "dark";
  const textColor = isDark ? "#ffffff" : "#0f172a";
  const mutedText = isDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.66)";

  const surfaceStyle: React.CSSProperties = {
    marginBottom: 14,
    border: isDark
      ? "1px solid rgba(255,255,255,0.12)"
      : "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    padding: 20,
    background: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)",
    color: textColor,
    boxShadow: isDark
      ? "0 8px 30px rgba(0,0,0,0.14)"
      : "0 8px 24px rgba(15,23,42,0.05)",
  };

  if (args.hasWorkspaceArtifacts) {
    return (
      <CompactRequirementBar
        chat={args.chat}
        inputRef={args.inputRef}
        isBusy={args.isBusy}
        resolvedTheme={args.resolvedTheme}
        onAfterSendAction={args.onAfterSendAction}
      />
    );
  }

  return (
    <section
      aria-label="Strategy workspace start"
      data-tour-anchor="workflow-start"
      style={surfaceStyle}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span
              style={{
                borderRadius: 999,
                border: isDark
                  ? "1px solid rgba(255,255,255,0.16)"
                  : "1px solid rgba(15,23,42,0.12)",
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(15,23,42,0.04)",
                color: textColor,
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 950,
              }}
            >
              Start here
            </span>
            <span style={{ fontSize: 12, fontWeight: 850, color: mutedText }}>
              Turn a requirement into a reviewed test suite and readiness signal
            </span>
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                color: textColor,
                fontSize: 28,
                lineHeight: 1.12,
                fontWeight: 950,
              }}
            >
              Describe what you&apos;re testing.
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                maxWidth: 840,
                color: mutedText,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Turn a requirement into a reviewed test suite and a clear
              release-readiness signal. Release Signal supports your release
              decision; it does not approve releases. The QA/release owner has
              the final call.
            </p>
          </div>
        </div>

        <div data-tour-anchor="start-here-input" style={{ display: "grid", gap: 8 }}>
          <ChatInput
            ref={args.inputRef}
            mode={args.chat.mode}
            value={args.chat.input}
            disabled={args.isBusy}
            resolvedTheme={args.resolvedTheme}
            onChangeAction={(next: string) => args.chat.setInput(next)}
            onSendAction={() => {
              void (async () => {
                await args.chat.send();
                args.onAfterSendAction?.();
              })();
            }}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: mutedText, lineHeight: 1.45 }}>
              AI-assisted - you review generated requirements and tests before
              using them.
            </div>
          </div>
        </div>

        <StrategyPanel
          chat={args.chat}
          resolvedTheme={args.resolvedTheme}
        />

        <WorkflowPreview resolvedTheme={args.resolvedTheme} />
      </div>
    </section>
  );
}

function buildRefinedRequirementInput(
  artifact: UseChatSessionReturn["sessionArtifact"]
): string | null {
  const rr = artifact?.refinedRequirement;
  if (!rr) return null;

  const lines: string[] = [];

  if (rr.objective?.trim()) {
    lines.push(`Objective: ${rr.objective.trim()}`);
  }

  if (rr.context?.trim()) {
    lines.push(`Context / Constraints: ${rr.context.trim()}`);
  }

  if (rr.inScope?.length) {
    lines.push(`In Scope: ${rr.inScope.join(", ")}`);
  }

  if (rr.outOfScope?.length) {
    lines.push(`Out of Scope: ${rr.outOfScope.join(", ")}`);
  }

  if (rr.integrations?.length) {
    lines.push(`Integrations: ${rr.integrations.join(", ")}`);
  }

  if (rr.riskFocus?.length) {
    lines.push(`Risk Focus: ${rr.riskFocus.join(", ")}`);
  }

  if (rr.acceptanceCriteria?.length) {
    lines.push("Acceptance Criteria:");
    for (const item of rr.acceptanceCriteria) {
      lines.push(`- ${item}`);
    }
  }

  if (!lines.length) return null;

  lines.push("");
  lines.push(
    "Generate structured test cases based on this Refined Requirement. Avoid duplicates with any existing tests in this session."
  );

  return lines.join("\n");
}

function getProcessingLabel(mode: UseChatSessionReturn["mode"]): string {
  if (mode === "review") return "Reviewing coverage…";
  if (mode === "cases") return "Generating test cases…";
  return "Analyzing requirement…";
}

function getActivityLabel(item: UseChatSessionReturn["items"][number]): string {
  if (item.kind === "review") return "Review completed";
  if (item.kind === "casesText") return "Test suite generated";
  if (item.kind === "casesLegacy") return "Legacy test suite loaded";
  if (item.kind === "error") return item.title || "Workspace action needs attention";

  if (item.kind === "text") {
    if (item.role === "user") return "Workspace input added";
    const text = String(item.text ?? "");
    if (text.includes("Refined Technical Requirement")) return "Requirement refined";
    if (text.includes("Readiness")) return "Readiness recalculated";
    return "Assistant response added";
  }

  return "Workspace activity";
}

function PopulatedStrategyRecentActivity(args: {
  chat: UseChatSessionReturn;
  chatBoxRef: React.RefObject<HTMLDivElement | null>;
  hiddenTimelineDocumentIndexes: number[];
  processingBanner?: React.ReactNode;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const recentItems = args.chat.items.slice(-5).reverse();

  return (
    <section
      aria-label="Recent activity"
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        background: isDark ? "rgba(255,255,255,0.032)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <details>
        <summary
          style={{
            cursor: "pointer",
            padding: "12px 14px",
            display: "grid",
            gap: 5,
            borderBottom: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 950 }}>
            Recent activity
          </span>
          <span style={{ fontSize: 11, opacity: 0.66, lineHeight: 1.4 }}>
            Last 5 events - View details
          </span>
        </summary>

        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {recentItems.length ? (
              recentItems.map((item, index) => (
                <div
                  key={`recent-${index}-${item.kind}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid rgba(15,23,42,0.08)",
                    background: isDark
                      ? "rgba(255,255,255,0.025)"
                      : "rgba(255,255,255,0.64)",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                >
                  <span>{getActivityLabel(item)}</span>
                  <span style={{ opacity: 0.58 }}>{item.kind}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                No recent activity yet.
              </div>
            )}
          </div>

          <ActivityTimelinePanel
            ref={args.chatBoxRef}
            resolvedTheme={args.resolvedTheme}
            isNarrow
            title="Recent activity"
            description="Supporting conversation and previous workspace activity. Latest long artifacts stay collapsed above."
          >
            {args.processingBanner}
            <ChatMessageList
              items={args.chat.items}
              mode={args.chat.mode}
              sessionArtifact={args.chat.sessionArtifact}
              resolvedTheme={args.resolvedTheme}
              hiddenItemIndexes={args.hiddenTimelineDocumentIndexes}
              onUpdateTestSuiteAction={(cases) => {
                void args.chat.updateTestSuite(cases);
              }}
              onGenerateTestsAction={() => {
                void args.chat.generateTestsFromRequirement();
              }}
              canGenerateTests={args.chat.canGenerateTests}
              isGeneratingTests={args.chat.isRunningWorkflowAction}
              onRefineRequirementAction={() => {
                void args.chat.refineRequirement();
              }}
              canRefineRequirement={args.chat.canRefineRequirement}
              isRefiningRequirement={args.chat.isRunningWorkflowAction}
              onGenerateNextBatchAction={() => {
                void args.chat.generateNextBatchOfTests();
              }}
              canGenerateNextBatch={
                args.chat.hasPinnedRequirement && args.chat.hasPersistentTestSuite
              }
              isGeneratingNextBatch={args.chat.isRunningWorkflowAction}
              onRegenerateSuiteAction={() => {
                void args.chat.regenerateSuite();
              }}
              canRegenerateSuite={args.chat.canRegenerateSuite}
              isRegeneratingSuite={args.chat.isRunningWorkflowAction}
              onReviewTestSuiteAction={() => {
                void args.chat.reviewTestSuite();
              }}
              canReviewTestSuite={args.chat.canReviewTestSuite}
              isReviewingTestSuite={args.chat.isRunningWorkflowAction}
            />
          </ActivityTimelinePanel>
        </div>
      </details>
    </section>
  );
}

function PopulatedStrategyAssistantPanel(args: {
  chat: UseChatSessionReturn;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isBusy: boolean;
  resolvedTheme: "light" | "dark";
  onAfterSendAction?: () => void;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <section
      aria-label="Ask about this workspace"
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        background: isDark ? "rgba(255,255,255,0.032)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <details>
        <summary
          style={{
            cursor: "pointer",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 950 }}>
            Ask about this workspace
          </span>
          <span style={{ fontSize: 11, opacity: 0.66 }}>
            Review external suite remains available from Test Review.
          </span>
        </summary>

        <div
          style={{
            padding: 14,
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <ChatInput
            ref={args.inputRef}
            mode={args.chat.mode}
            value={args.chat.input}
            disabled={args.isBusy}
            resolvedTheme={args.resolvedTheme}
            onChangeAction={(next: string) => args.chat.setInput(next)}
            onSendAction={() => {
              void (async () => {
                await args.chat.send();
                args.onAfterSendAction?.();
              })();
            }}
          />
        </div>
      </details>
    </section>
  );
}

export default function ChatPanel({
  chat,
  onAfterSendAction,
  resolvedTheme = "dark",
}: Props) {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    const onScroll = () => {
      chat.shouldAutoScrollRef.current = isNearBottom(el);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [chat]);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    if (chat.shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.items, chat]);

  // BUG FIX (M12 Strategy + History triage):
  // Panel rendering must follow the currently selected visible tab/view,
  // not the persisted effective session classification.
  // activeSessionMode is useful for workflow/history reasoning, but using it
  // here causes Strategy/Test Design/Test Review shells to bleed across views.
  const isCoachSession = chat.mode === "coach";
  const isTestDesignSession = chat.mode === "cases";
  const isDark = resolvedTheme === "dark";

  const isBusy = chat.isSending || chat.isRunningWorkflowAction;

  const processingBannerStyle: React.CSSProperties = {
    marginBottom: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: isDark
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(15,23,42,0.10)",
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
    color: isDark ? "#ffffff" : "#0f172a",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.35,
  };

  const helperBannerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: isDark
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(15,23,42,0.10)",
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
  };

  const helperButtonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 12,
    border: isDark
      ? "1px solid rgba(255,255,255,0.16)"
      : "1px solid rgba(15,23,42,0.16)",
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
    color: isDark ? "#ffffff" : "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  // M12.10 CHANGE:
  // - separate the summary area from the workflow guidance area
  // - keep both artifact-driven, but give each a distinct visual role
  const workspaceOverviewWrapStyle: React.CSSProperties = {
    display: "grid",
    gap: 14,
    marginBottom: 12,
  };

  const showOnboardingHint = chat.items.length === 0 && !isBusy && !isCoachSession;

  const canUseRefinedRequirement =
    isTestDesignSession &&
    chat.hasPinnedRequirement &&
    !!buildRefinedRequirementInput(chat.sessionArtifact);

  const canGenerateNextBatch =
    chat.hasPinnedRequirement && chat.hasPersistentTestSuite;

  const hiddenTimelineDocumentIndexes =
    getLatestArtifactDocumentIndexesToHide(chat.items);

  const hasWorkspaceArtifacts =
    chat.hasPinnedRequirement ||
    chat.hasPersistentTestSuite ||
    chat.hasReviewArtifact;

  const hasExecutionEvidence = !!chat.sessionArtifact?.executionIntelligence;
  const isPopulatedStrategy = isCoachSession && hasWorkspaceArtifacts;
  const showReleaseReadiness =
    chat.hasPersistentTestSuite || chat.hasReviewArtifact || hasExecutionEvidence;
  const showWorkspaceOverview = hasWorkspaceArtifacts || !isCoachSession;
  const showActivityTimeline =
    !isPopulatedStrategy && (!isCoachSession || chat.items.length > 0 || isBusy);
  const processingBanner = isBusy ? (
    <div style={processingBannerStyle}>
      {chat.isRunningWorkflowAction
        ? "Running workspace action..."
        : getProcessingLabel(chat.mode)}
    </div>
  ) : null;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        alignItems: "start",
        gridTemplateColumns: "1fr",
      }}
    >
      <div>
        {showOnboardingHint ? (
          <OnboardingHint
            showStrategyHint={isCoachSession}
            hasWorkspaceArtifacts={hasWorkspaceArtifacts}
            nextAction={chat.workflowStatus.nextAction}
            resolvedTheme={resolvedTheme}
          />
        ) : null}

        {isCoachSession ? (
          <StrategyWorkspaceStart
            chat={chat}
            inputRef={inputRef}
            isBusy={isBusy}
            hasWorkspaceArtifacts={hasWorkspaceArtifacts}
            resolvedTheme={resolvedTheme}
            onAfterSendAction={onAfterSendAction}
          />
        ) : null}

        {isPopulatedStrategy ? (
          <PopulatedCommandBand chat={chat} resolvedTheme={resolvedTheme} />
        ) : null}

        {showWorkspaceOverview ? (
        <div style={workspaceOverviewWrapStyle}>
          <div data-tour-anchor="artifact-summary">
            <WorkspaceSectionLabel
              title="Artifact summary"
              description={
                hasWorkspaceArtifacts
                  ? "Current persisted requirement, suite, and review state for this workspace."
                  : "No persisted workspace artifacts yet. Start by shaping the requirement or continuing the next recommended step."
              }
              resolvedTheme={resolvedTheme}
            />

            <FeatureWorkspaceSummary
              chat={chat}
              resolvedTheme={resolvedTheme}
            />

            {showReleaseReadiness ? (
              <ReleaseReadinessPanel
                sessionArtifact={chat.sessionArtifact}
                resolvedTheme={resolvedTheme}
              />
            ) : null}

            <ArtifactDocumentSurface
              items={chat.items}
              sessionArtifact={chat.sessionArtifact}
              resolvedTheme={resolvedTheme}
              onUpdateTestSuiteAction={(cases) => {
                void chat.updateTestSuite(cases);
              }}
              onGenerateTestsAction={() => {
                void chat.generateTestsFromRequirement();
              }}
              canGenerateTests={chat.canGenerateTests}
              isGeneratingTests={chat.isRunningWorkflowAction}
              onRefineRequirementAction={() => {
                void chat.refineRequirement();
              }}
              canRefineRequirement={chat.canRefineRequirement}
              isRefiningRequirement={chat.isRunningWorkflowAction}
              onGenerateNextBatchAction={() => {
                void chat.generateNextBatchOfTests();
              }}
              canGenerateNextBatch={canGenerateNextBatch}
              isGeneratingNextBatch={chat.isRunningWorkflowAction}
              onRegenerateSuiteAction={() => {
                void chat.regenerateSuite();
              }}
              canRegenerateSuite={chat.canRegenerateSuite}
              isRegeneratingSuite={chat.isRunningWorkflowAction}
              onReviewTestSuiteAction={() => {
                void chat.reviewTestSuite();
              }}
              canReviewTestSuite={chat.canReviewTestSuite}
              isReviewingTestSuite={chat.isRunningWorkflowAction}
            />

            {!hasWorkspaceArtifacts && !isBusy ? (
              <EmptyWorkspaceHint resolvedTheme={resolvedTheme} />
            ) : null}
          </div>

          <div>
            <WorkspaceSectionLabel
              title="Workflow guidance"
              description="Current stage and the next recommended workspace move."
              resolvedTheme={resolvedTheme}
            />
            <div data-tour-anchor="workflow-guidance">
              <ChatWorkflowBanner
                status={chat.workflowStatus}
                resolvedTheme={resolvedTheme}
              />
            </div>
          </div>
        </div>
        ) : null}

        {isPopulatedStrategy ? (
          <div style={{ display: "grid", gap: 12 }}>
            <PopulatedStrategyRecentActivity
              chat={chat}
              chatBoxRef={chatBoxRef}
              hiddenTimelineDocumentIndexes={hiddenTimelineDocumentIndexes}
              processingBanner={processingBanner}
              resolvedTheme={resolvedTheme}
            />
            <PopulatedStrategyAssistantPanel
              chat={chat}
              inputRef={inputRef}
              isBusy={isBusy}
              resolvedTheme={resolvedTheme}
              onAfterSendAction={onAfterSendAction}
            />
          </div>
        ) : null}

        {showActivityTimeline ? (
        <div>
          <ActivityTimelinePanel
            ref={chatBoxRef}
            resolvedTheme={resolvedTheme}
            isNarrow={isNarrow}
            inputSlot={
              isCoachSession ? null :
              <>
                {canUseRefinedRequirement ? (
                  <div style={helperBannerStyle}>
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                      Use the pinned{" "}
                      <strong style={{ fontWeight: 900 }}>
                        Refined Requirement
                      </strong>{" "}
                      as the starting point for test generation.
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextInput = buildRefinedRequirementInput(
                          chat.sessionArtifact
                        );
                        if (!nextInput) return;

                        chat.setInput(nextInput);

                        requestAnimationFrame(() => {
                          inputRef.current?.focus();
                        });
                      }}
                      style={helperButtonStyle}
                      disabled={isBusy}
                    >
                      Use Refined Requirement
                    </button>
                  </div>
                ) : null}

                <ChatInput
                  ref={inputRef}
                  mode={chat.mode}
                  value={chat.input}
                  disabled={isBusy}
                  hasReviewArtifactContext={
                    chat.mode === "review" &&
                    (chat.hasPersistentTestSuite || chat.hasReviewArtifact)
                  }
                  resolvedTheme={resolvedTheme}
                  onChangeAction={(next: string) => chat.setInput(next)}
                  onSendAction={() => {
                    void (async () => {
                      await chat.send();
                      onAfterSendAction?.();
                    })();
                  }}
                />
              </>
            }
          >
            {processingBanner}

            <ChatMessageList
              items={chat.items}
              mode={chat.mode}
              sessionArtifact={chat.sessionArtifact}
              resolvedTheme={resolvedTheme}
              hiddenItemIndexes={hiddenTimelineDocumentIndexes}
              onUpdateTestSuiteAction={(cases) => {
                void chat.updateTestSuite(cases);
              }}
              onGenerateTestsAction={() => {
                void chat.generateTestsFromRequirement();
              }}
              canGenerateTests={chat.canGenerateTests}
              isGeneratingTests={chat.isRunningWorkflowAction}
              onRefineRequirementAction={() => {
                void chat.refineRequirement();
              }}
              canRefineRequirement={chat.canRefineRequirement}
              isRefiningRequirement={chat.isRunningWorkflowAction}
              onGenerateNextBatchAction={() => {
                void chat.generateNextBatchOfTests();
              }}
              canGenerateNextBatch={canGenerateNextBatch}
              isGeneratingNextBatch={chat.isRunningWorkflowAction}
              onRegenerateSuiteAction={() => {
                void chat.regenerateSuite();
              }}
              canRegenerateSuite={chat.canRegenerateSuite}
              isRegeneratingSuite={chat.isRunningWorkflowAction}
              onReviewTestSuiteAction={() => {
                void chat.reviewTestSuite();
              }}
              canReviewTestSuite={chat.canReviewTestSuite}
              isReviewingTestSuite={chat.isRunningWorkflowAction}
            />
          </ActivityTimelinePanel>
        </div>
        ) : null}
      </div>
    </div>
  );
}
