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
import { getArtifactConsistencyState } from "@/lib/chat/artifact";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession.helpers";
import ReviewCard from "../cards/ReviewCard";

import ChatMessageList from "./ChatMessageList";
import FeatureWorkspaceSummary from "./FeatureWorkspaceSummary";
import { ReleaseReadinessPanel } from "./ReleaseReadinessPanel";
import StrategyPanel from "./StrategyPanel";
import { ActivityTimelinePanel } from "./workspace/ActivityTimelinePanel";
import { ArtifactDocumentSurface } from "./workspace/ArtifactDocumentSurface";
import { StrategyWorkspaceStart } from "./workspace/strategy/StrategyWorkspaceStart";
import { TestDesignInputSurface } from "./workspace/testDesign/TestDesignInputSurface";
import { TestReviewEntrySurface } from "./workspace/testReview/TestReviewEntrySurface";
import { TestReviewGettingStarted } from "./workspace/testReview/TestReviewGettingStarted";
import { TestReviewSeparateSuiteDisclosure } from "./workspace/testReview/TestReviewSeparateSuiteDisclosure";
import {
  buildReviewProvenanceLabel,
  getLatestArtifactDocumentIndexesToHide,
} from "./workspace/artifactDocumentItems";

type Props = {
  chat: UseChatSessionReturn;
  onAfterUiAction?: () => void;
  onCreditsMayHaveChanged?: () => void;
  resolvedTheme?: "light" | "dark";
};

function OnboardingHint(args: {
  showStrategyHint: boolean;
  testDesignVisual?: boolean;
  hasWorkspaceArtifacts: boolean;
  nextAction: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        marginBottom: 12,
        border: args.testDesignVisual
          ? isDark
            ? "1px solid #3A382F"
            : "1px solid #D9D3C2"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        borderRadius: args.testDesignVisual ? 12 : 14,
        padding: args.testDesignVisual ? "14px 16px" : 12,
        background: args.testDesignVisual
          ? isDark
            ? "#2B2A26"
            : "#FCFBF6"
          : isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(15,23,42,0.03)",
        color: args.testDesignVisual
          ? isDark
            ? "#EDEAE3"
            : "#262521"
          : isDark
            ? "#ffffff"
            : "#0f172a",
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
          border: args.testDesignVisual
            ? isDark
              ? "1px solid #38362D"
              : "1px solid #DFD9C8"
            : isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
          background: isDark
            ? args.testDesignVisual
              ? "#21201C"
              : "rgba(255,255,255,0.03)"
            : args.testDesignVisual
              ? "#EDEAE0"
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
          <strong
            style={{
              fontWeight: 900,
              color: args.testDesignVisual
                ? isDark
                  ? "#D97757"
                  : "#C15F3C"
                : undefined,
            }}
          >
            {args.nextAction}
          </strong>
        </div>
      </div>

      {args.testDesignVisual ? null : (
        <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
          Example:
          <br />
          <span style={{ opacity: 0.88 }}>
            Paste a Jira ticket for login with MFA, clarify scope and risks, then
            generate a structured test suite.
          </span>
        </div>
      )}

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
  testDesignVisual?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        marginBottom: 8,
        paddingLeft: 2,
        color: args.testDesignVisual
          ? isDark
            ? "#EDEAE3"
            : "#262521"
          : isDark
            ? "#ffffff"
            : "#0f172a",
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

function getActivityDetail(item: UseChatSessionReturn["items"][number]): string {
  if (item.kind === "review") {
    return `Review completed - score ${item.review.score}/100`;
  }

  if (item.kind === "casesText") {
    return "Generated test suite artifact";
  }

  if (item.kind === "casesLegacy") {
    return "Loaded legacy test suite";
  }

  if (item.kind === "error") {
    return item.details || item.title || "Workspace action needs attention";
  }

  if (item.kind === "text") {
    return String(item.text ?? "").replace(/\s+/g, " ").trim();
  }

  return "Workspace activity";
}

function getActivityTimeLabel(index: number): string {
  if (index === 0) return "latest";
  if (index === 1) return "recent";
  return "earlier";
}

function PopulatedStrategyRecentActivity(args: {
  chat: UseChatSessionReturn;
  processingBanner?: React.ReactNode;
  resolvedTheme: "light" | "dark";
  hiddenItemIndexes?: number[];
}) {
  const isDark = args.resolvedTheme === "dark";
  const hiddenItemIndexes = new Set(args.hiddenItemIndexes ?? []);
  const recentItems = args.chat.items
    .filter((_, index) => !hiddenItemIndexes.has(index))
    .slice(-5)
    .reverse();

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
        <div
          style={{
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 950 }}>
              Recent activity
            </span>
            <span style={{ fontSize: 11, opacity: 0.62 }}>
              Last 5 events
            </span>
          </div>

          {args.processingBanner}

          <div style={{ display: "grid", gap: 6 }}>
            {recentItems.length ? (
              recentItems.map((item, index) => {
                const detail = getActivityDetail(item);
                const truncated =
                  detail.length > 180 ? `${detail.slice(0, 180)}...` : detail;

                return (
                  <details key={`recent-${index}-${item.kind}`}>
                    <summary
                      style={{
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 0",
                        borderTop: isDark
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(15,23,42,0.08)",
                        fontSize: 12,
                        lineHeight: 1.35,
                      }}
                    >
                      <span aria-hidden="true" style={{ opacity: 0.72 }}>
                        •
                      </span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getActivityLabel(item)}
                      </span>
                      <span style={{ opacity: 0.56 }}>
                        {getActivityTimeLabel(index)}
                      </span>
                      <span
                        style={{
                          color: isDark
                            ? "rgba(147,197,253,0.95)"
                            : "rgba(37,99,235,0.90)",
                          fontWeight: 900,
                        }}
                      >
                        View details
                      </span>
                    </summary>
                    <div
                      style={{
                        padding: "4px 0 8px 22px",
                        fontSize: 11,
                        lineHeight: 1.45,
                        opacity: 0.7,
                      }}
                    >
                      {truncated || "No additional detail."}
                    </div>
                  </details>
                );
              })
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                No recent activity yet.
              </div>
            )}
          </div>
        </div>
    </section>
  );
}

export default function ChatPanel({
  chat,
  onAfterUiAction,
  onCreditsMayHaveChanged,
  resolvedTheme = "dark",
}: Props) {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isNarrow, setIsNarrow] = useState(false);

  const runBillableAction = (action: () => Promise<boolean>) => {
    void (async () => {
      const creditsMayHaveChanged = await action();
      onAfterUiAction?.();
      if (creditsMayHaveChanged) {
        onCreditsMayHaveChanged?.();
      }
    })();
  };

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
  const isTestReviewSession = chat.mode === "review";
  const previousModeRef = useRef(chat.mode);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = chat.mode;

    if (chat.mode === "coach" && previousMode !== "coach") {
      chat.setInput("");
    }
  }, [chat.mode, chat.setInput]);

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

  // M12.10 CHANGE:
  // - separate the summary area from the workflow guidance area
  // - keep both artifact-driven, but give each a distinct visual role
  const workspaceOverviewWrapStyle: React.CSSProperties = {
    display: "grid",
    gap: 14,
    marginBottom: 12,
  };

  const showOnboardingHint = chat.items.length === 0 && !isBusy && !isCoachSession;

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
  const showActivityTimeline =
    !isPopulatedStrategy && (!isCoachSession || chat.items.length > 0 || isBusy);
  const artifactConsistency = getArtifactConsistencyState(chat.sessionArtifact);
  const persistedReview = chat.sessionArtifact?.reviewResult ?? null;
  const persistedReviewLineage = persistedReview as
    | (typeof persistedReview & {
        basedOnRequirementVersion?: number;
        basedOnSuiteVersion?: number;
      })
    | null;
  const reviewHasComparableLineage =
    typeof persistedReviewLineage?.basedOnRequirementVersion === "number" &&
    typeof persistedReviewLineage?.basedOnSuiteVersion === "number" &&
    typeof artifactConsistency.requirementVersion === "number" &&
    typeof artifactConsistency.suiteVersion === "number";
  // "unknown" is a distinct terminal state, not a fallback for "current" — a review
  // with missing lineage metadata must never be treated as matching the live suite.
  const reviewLineageStatus: "current" | "stale" | "unknown" =
    artifactConsistency.reviewStale
      ? "stale"
      : reviewHasComparableLineage &&
          persistedReviewLineage?.basedOnRequirementVersion ===
            artifactConsistency.requirementVersion &&
          persistedReviewLineage?.basedOnSuiteVersion === artifactConsistency.suiteVersion
        ? "current"
        : "unknown";
  const reviewLineageLabels = persistedReview
    ? [
        typeof persistedReviewLineage?.basedOnSuiteVersion === "number"
          ? `Based on Test Suite v${persistedReviewLineage.basedOnSuiteVersion}`
          : "Test Suite lineage unknown",
        typeof persistedReviewLineage?.basedOnRequirementVersion === "number"
          ? `Based on Requirement v${persistedReviewLineage.basedOnRequirementVersion}`
          : "Requirement lineage unknown",
      ]
    : [];
  const reviewLineageReasons =
    reviewLineageStatus === "stale"
      ? artifactConsistency.reasons.filter((reason) =>
          reason.toLowerCase().includes("review result")
        )
      : reviewLineageStatus === "unknown" && persistedReview
        ? ["This review does not include enough lineage metadata to verify it against the current requirement and suite."]
        : [];
  const testReviewRequirementVersion = (
    chat.sessionArtifact?.refinedRequirement as { version?: number } | undefined
  )?.version;
  const testReviewSuiteVersion = chat.sessionArtifact?.testSuite?.version;
  const testReviewSuiteCount =
    chat.sessionArtifact?.testSuite?.cases?.length ?? 0;
  const testReviewScore = chat.sessionArtifact?.reviewResult?.score;
  const testReviewPrerequisiteChips = [
    chat.hasPinnedRequirement
      ? `Requirement · v${testReviewRequirementVersion ?? 1}`
      : "Requirement · not saved",
    chat.hasPersistentTestSuite
      ? `Test suite · v${testReviewSuiteVersion ?? "—"} · ${testReviewSuiteCount} cases`
      : "Test suite · none",
    chat.hasReviewArtifact
      ? `Review · ${reviewLineageStatus} · ${testReviewScore ?? "—"}/100`
      : "Review · not run",
  ];
  const reviewFreeItems = isTestReviewSession
    ? chat.items.filter((item) => item.kind !== "review")
    : chat.items;
  const reviewFreeSessionArtifact =
    isTestReviewSession && chat.sessionArtifact
      ? { ...chat.sessionArtifact, reviewResult: undefined }
      : chat.sessionArtifact;
  const processingBanner = isBusy ? (
    <div style={processingBannerStyle}>
      {chat.isRunningWorkflowAction
        ? "Running workspace action..."
        : getProcessingLabel(chat.mode)}
    </div>
  ) : null;
  const releaseReadinessPanel = showReleaseReadiness ? (
    <ReleaseReadinessPanel
      sessionArtifact={chat.sessionArtifact}
      resolvedTheme={resolvedTheme}
      commandCenter={false}
    />
  ) : null;
  const activityTimeline =
    showActivityTimeline && !isTestDesignSession && !isTestReviewSession ? (
    <div>
      <ActivityTimelinePanel
        ref={chatBoxRef}
        resolvedTheme={resolvedTheme}
        isNarrow={isNarrow}
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
            runBillableAction(() => chat.generateTestsFromRequirement());
          }}
          canGenerateTests={chat.canGenerateTests}
          isGeneratingTests={chat.isRunningWorkflowAction}
          onRefineRequirementAction={() => {
            runBillableAction(() => chat.refineRequirement());
          }}
          canRefineRequirement={chat.canRefineRequirement}
          isRefiningRequirement={chat.isRunningWorkflowAction}
          onGenerateNextBatchAction={() => {
            runBillableAction(() => chat.generateNextBatchOfTests());
          }}
          canGenerateNextBatch={canGenerateNextBatch}
          isGeneratingNextBatch={chat.isRunningWorkflowAction}
          onRegenerateSuiteAction={() => {
            runBillableAction(() => chat.regenerateSuite());
          }}
          canRegenerateSuite={chat.canRegenerateSuite}
          isRegeneratingSuite={chat.isRunningWorkflowAction}
          onReviewTestSuiteAction={() => {
            runBillableAction(() => chat.reviewTestSuite());
          }}
          canReviewTestSuite={chat.canReviewTestSuite}
          isReviewingTestSuite={chat.isRunningWorkflowAction}
        />
      </ActivityTimelinePanel>
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
        {isTestDesignSession ? (
          <TestDesignInputSurface
            input={chat.input}
            setInput={chat.setInput}
            send={chat.send}
            setInputElement={(node) => {
              inputRef.current =
                node as unknown as HTMLInputElement | null;
            }}
            isBusy={isBusy}
            resolvedTheme={resolvedTheme}
            runBillableAction={runBillableAction}
          />
        ) : null}

        {isTestReviewSession ? (
          <TestReviewEntrySurface
            prerequisiteChips={testReviewPrerequisiteChips}
            hasPersistentTestSuite={chat.hasPersistentTestSuite}
            canReviewTestSuite={chat.canReviewTestSuite}
            isRunningWorkflowAction={chat.isRunningWorkflowAction}
            reviewTestSuite={chat.reviewTestSuite}
            resolvedTheme={resolvedTheme}
            runBillableAction={runBillableAction}
          />
        ) : null}

        {showOnboardingHint && !isTestReviewSession ? (
          <OnboardingHint
            showStrategyHint={isCoachSession}
            testDesignVisual={isTestDesignSession}
            hasWorkspaceArtifacts={hasWorkspaceArtifacts}
            nextAction={chat.workflowStatus.nextAction}
            resolvedTheme={resolvedTheme}
          />
        ) : null}

        {showOnboardingHint && isTestReviewSession ? (
          <TestReviewGettingStarted
            hasPersistentTestSuite={chat.hasPersistentTestSuite}
            resolvedTheme={resolvedTheme}
          />
        ) : null}

        {isCoachSession ? (
          <StrategyWorkspaceStart
            input={chat.input}
            setInput={chat.setInput}
            refinedRequirement={chat.sessionArtifact?.refinedRequirement}
            setInputElement={(node) => {
              inputRef.current =
                node as unknown as HTMLInputElement | null;
            }}
            isBusy={isBusy}
            lastPending={chat.lastPending}
            isSending={chat.isSending}
            isRunningWorkflowAction={chat.isRunningWorkflowAction}
            canRefineRequirement={chat.canRefineRequirement}
            canGenerateTests={chat.canGenerateTests}
            send={chat.send}
            refineRequirement={chat.refineRequirement}
            generateTestsFromRequirement={chat.generateTestsFromRequirement}
            startNewSessionInMode={chat.startNewSessionInMode}
            strategyPanel={
              <StrategyPanel chat={chat} resolvedTheme={resolvedTheme} />
            }
            hasWorkspaceArtifacts={hasWorkspaceArtifacts}
            resolvedTheme={resolvedTheme}
            onAfterUiAction={onAfterUiAction}
            onCreditsMayHaveChanged={onCreditsMayHaveChanged}
          />
        ) : null}

        {!isTestReviewSession ? (
        <div style={workspaceOverviewWrapStyle}>
          <div data-tour-anchor="artifact-summary">
            <WorkspaceSectionLabel
              title="Workflow status"
              description={
                hasWorkspaceArtifacts
                  ? "Saved requirement, generated suite, review result, and execution evidence for this workspace."
                  : "No persisted workspace artifacts yet. Start by shaping the requirement or continuing the next recommended step."
              }
              resolvedTheme={resolvedTheme}
              testDesignVisual={isTestDesignSession}
            />

            <FeatureWorkspaceSummary
              chat={chat}
              resolvedTheme={resolvedTheme}
              commandCenter={isPopulatedStrategy}
              onCreditsMayHaveChanged={onCreditsMayHaveChanged}
            />

            {releaseReadinessPanel}

            <ArtifactDocumentSurface
              key={`artifact-documents-${chat.mode}-${chat.activeSessionId ?? "no-session"}`}
              items={chat.items}
              sessionArtifact={chat.sessionArtifact}
              sessionId={chat.activeSessionId}
              resolvedTheme={resolvedTheme}
              commandCenter={isPopulatedStrategy}
              testDesignVisual={isTestDesignSession}
              initiallyOpenSuite={isTestDesignSession ? false : undefined}
              onUpdateTestSuiteAction={(cases) => {
                void chat.updateTestSuite(cases);
              }}
              onGenerateTestsAction={() => {
                runBillableAction(() => chat.generateTestsFromRequirement());
              }}
              canGenerateTests={chat.canGenerateTests}
              isGeneratingTests={chat.isRunningWorkflowAction}
              onRefineRequirementAction={() => {
                runBillableAction(() => chat.refineRequirement());
              }}
              canRefineRequirement={chat.canRefineRequirement}
              isRefiningRequirement={chat.isRunningWorkflowAction}
              onGenerateNextBatchAction={() => {
                runBillableAction(() => chat.generateNextBatchOfTests());
              }}
              canGenerateNextBatch={canGenerateNextBatch}
              isGeneratingNextBatch={chat.isRunningWorkflowAction}
              onRegenerateSuiteAction={() => {
                runBillableAction(() => chat.regenerateSuite());
              }}
              canRegenerateSuite={chat.canRegenerateSuite}
              isRegeneratingSuite={chat.isRunningWorkflowAction}
              onReviewTestSuiteAction={() => {
                runBillableAction(() => chat.reviewTestSuite());
              }}
              canReviewTestSuite={chat.canReviewTestSuite}
              isReviewingTestSuite={chat.isRunningWorkflowAction}
              onExecutionUploadSuccess={chat.applyExecutionEvidenceUpload}
            />

            {isTestDesignSession ? (
              <PopulatedStrategyRecentActivity
                chat={chat}
                processingBanner={processingBanner}
                resolvedTheme={resolvedTheme}
                hiddenItemIndexes={hiddenTimelineDocumentIndexes}
              />
            ) : null}

            {!hasWorkspaceArtifacts &&
            !isBusy &&
            !isTestDesignSession &&
            !isCoachSession ? (
              <EmptyWorkspaceHint resolvedTheme={resolvedTheme} />
            ) : null}
          </div>

        </div>
        ) : null}

        {isTestReviewSession ? (
          <div style={workspaceOverviewWrapStyle}>
            <div data-tour-anchor="artifact-summary">
              <WorkspaceSectionLabel
                title="Workflow status"
                description={
                  hasWorkspaceArtifacts
                    ? "Saved requirement, generated suite, review result, and execution evidence for this workspace."
                    : "No saved workspace artifacts yet. Start with the review prerequisite above."
                }
                resolvedTheme={resolvedTheme}
                testDesignVisual
              />

              <FeatureWorkspaceSummary
                chat={chat}
                resolvedTheme={resolvedTheme}
                commandCenter={false}
                onCreditsMayHaveChanged={onCreditsMayHaveChanged}
              />

              {persistedReview ? (
                <div data-tour-anchor="review-actions">
                  <ReviewCard
                    review={persistedReview}
                    resolvedTheme={resolvedTheme}
                    provenanceLabel={buildReviewProvenanceLabel(chat.sessionArtifact)}
                    provenanceDescription="Saved review result for the current test design."
                    lineageStatus={reviewLineageStatus}
                    lineageLabels={reviewLineageLabels}
                    lineageReasons={reviewLineageReasons}
                    onImproveTestPlanAction={() => {
                      runBillableAction(() => chat.regenerateSuite());
                    }}
                    canImproveTestPlan={chat.canRegenerateSuite}
                    isImprovingTestPlan={chat.isRunningWorkflowAction}
                    onGenerateFromGapsAction={() => {
                      runBillableAction(() => chat.generateNextBatchOfTests());
                    }}
                    canGenerateFromGaps={canGenerateNextBatch}
                    isGeneratingFromGaps={chat.isRunningWorkflowAction}
                  />
                </div>
              ) : null}

              {releaseReadinessPanel}

              <ArtifactDocumentSurface
                key={`artifact-documents-${chat.mode}-${chat.activeSessionId ?? "no-session"}`}
                items={reviewFreeItems}
                sessionArtifact={reviewFreeSessionArtifact}
                sessionId={chat.activeSessionId}
                resolvedTheme={resolvedTheme}
                testDesignVisual
                initiallyOpenSuite={false}
                onUpdateTestSuiteAction={(cases) => {
                  void chat.updateTestSuite(cases);
                }}
                onExecutionUploadSuccess={chat.applyExecutionEvidenceUpload}
              />

              <TestReviewSeparateSuiteDisclosure
                input={chat.input}
                setInput={chat.setInput}
                send={chat.send}
                setInputElement={(node) => {
                  inputRef.current =
                    node as unknown as HTMLInputElement | null;
                }}
                isBusy={isBusy}
                resolvedTheme={resolvedTheme}
                runBillableAction={runBillableAction}
              />

              {!hasWorkspaceArtifacts && !isBusy ? (
                <EmptyWorkspaceHint resolvedTheme={resolvedTheme} />
              ) : null}
            </div>

            <PopulatedStrategyRecentActivity
              chat={chat}
              processingBanner={processingBanner}
              resolvedTheme={resolvedTheme}
              hiddenItemIndexes={hiddenTimelineDocumentIndexes}
            />

          </div>
        ) : null}

        {isPopulatedStrategy ? (
          <div style={{ display: "grid", gap: 12 }}>
            <PopulatedStrategyRecentActivity
              chat={chat}
              processingBanner={processingBanner}
              resolvedTheme={resolvedTheme}
            />
          </div>
        ) : null}

        {isTestReviewSession ? null : activityTimeline}
      </div>
    </div>
  );
}
