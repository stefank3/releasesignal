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

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession.helpers";

import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import ChatWorkflowBanner from "./ChatWorkflowBanner";
import FeatureWorkspaceSummary from "./FeatureWorkspaceSummary";
import { ReleaseReadinessPanel } from "./ReleaseReadinessPanel";
import StrategyPanel from "./StrategyPanel";

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
          Describe the feature, release area, or system under test.
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
          Clarify the login flow with MFA, identify the main risks, then generate
          a structured test suite.
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

  const gridTemplateColumns = useMemo(() => {
    if (!isCoachSession) return "1fr";
    if (isNarrow) return "1fr";
    return "minmax(0, 1fr) 400px";
  }, [isCoachSession, isNarrow]);

  const leftPanelStyle: React.CSSProperties = {
    border: isDark
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "1fr auto",
    minHeight: isNarrow ? "60vh" : "68vh",
    boxShadow: isDark
      ? "0 8px 30px rgba(0,0,0,0.18)"
      : "0 8px 24px rgba(15,23,42,0.06)",
  };

  const chatBoxStyle: React.CSSProperties = {
    padding: 14,
    overflow: "auto",
    minHeight: 0,
  };

  const inputWrapStyle: React.CSSProperties = {
    borderTop: isDark
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(15,23,42,0.10)",
    padding: 12,
    background: isDark ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.55)",
  };

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

  const strategyPanelWrapStyle: React.CSSProperties = {
    border: isDark
      ? "1px solid rgba(255,255,255,0.12)"
      : "1px solid rgba(15,23,42,0.12)",
    borderRadius: 18,
    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
    padding: 12,
    minHeight: isNarrow ? undefined : "68vh",
    boxShadow: isDark
      ? "0 8px 30px rgba(0,0,0,0.18)"
      : "0 8px 24px rgba(15,23,42,0.06)",
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

  const showOnboardingHint = chat.items.length === 0 && !isBusy;

  const canUseRefinedRequirement =
    isTestDesignSession &&
    chat.hasPinnedRequirement &&
    !!buildRefinedRequirementInput(chat.sessionArtifact);

  const hasWorkspaceArtifacts =
    chat.hasPinnedRequirement ||
    chat.hasPersistentTestSuite ||
    chat.hasReviewArtifact;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        alignItems: "start",
        gridTemplateColumns,
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

        <div style={workspaceOverviewWrapStyle}>
          <div>
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

            <ReleaseReadinessPanel
              sessionArtifact={chat.sessionArtifact}
              resolvedTheme={resolvedTheme}
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
            <ChatWorkflowBanner
              status={chat.workflowStatus}
              chat={chat}
              resolvedTheme={resolvedTheme}
            />
          </div>
        </div>

        <div style={leftPanelStyle}>
          <div ref={chatBoxRef} style={chatBoxStyle}>
            {isBusy ? (
              <div style={processingBannerStyle}>
                {chat.isRunningWorkflowAction
                  ? "Running workspace action…"
                  : getProcessingLabel(chat.mode)}
              </div>
            ) : null}

            <ChatMessageList
              items={chat.items}
              mode={chat.mode}
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
              canGenerateNextBatch={
                chat.hasPinnedRequirement && chat.hasPersistentTestSuite
              }
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
          </div>

          <div style={inputWrapStyle}>
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
          </div>
        </div>
      </div>

      {isCoachSession ? (
        <div style={strategyPanelWrapStyle}>
          <StrategyPanel chat={chat} resolvedTheme={resolvedTheme} />
        </div>
      ) : null}
    </div>
  );
}
