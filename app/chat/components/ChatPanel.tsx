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

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession.helpers";

import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import ChatWorkflowBanner from "./ChatWorkflowBanner";
import FeatureWorkspaceSummary from "./FeatureWorkspaceSummary";
import StrategyPanel from "./StrategyPanel";

type Props = {
  chat: UseChatSessionReturn;
  onAfterSendAction?: () => void;
  resolvedTheme?: "light" | "dark";
};

function OnboardingHint(args: {
  showStrategyHint: boolean;
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
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.92 }}>
        Getting started
      </div>

      <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.5 }}>
        Start by describing the feature or system under test.
        {args.showStrategyHint
          ? " Use Strategy to clarify scope and risks, then continue to Test Design."
          : ""}
      </div>

      <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
        Example:
        <br />
        <span style={{ opacity: 0.88 }}>
          Clarify the login flow with MFA, identify the main risks, then generate
          a structured test suite.
        </span>
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

  const showOnboardingHint = chat.items.length === 0 && !chat.isSending;

  const canUseRefinedRequirement =
    isTestDesignSession &&
    chat.hasPinnedRequirement &&
    !!buildRefinedRequirementInput(chat.sessionArtifact);

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
            resolvedTheme={resolvedTheme}
          />
        ) : null}

        <FeatureWorkspaceSummary
          chat={chat}
          resolvedTheme={resolvedTheme}
        />

        <ChatWorkflowBanner
          status={chat.workflowStatus}
          resolvedTheme={resolvedTheme}
        />

        <div style={leftPanelStyle}>
          <div ref={chatBoxRef} style={chatBoxStyle}>
            {chat.isSending ? (
              <div style={processingBannerStyle}>
                {getProcessingLabel(chat.mode)}
              </div>
            ) : null}

            <ChatMessageList
              items={chat.items}
              mode={chat.mode}
              resolvedTheme={resolvedTheme}
              onUpdateTestSuiteAction={(cases) => {
                void chat.updateTestSuite(cases);
              }}
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
                >
                  Use Refined Requirement
                </button>
              </div>
            ) : null}

            <ChatInput
              ref={inputRef}
              mode={chat.mode}
              value={chat.input}
              disabled={chat.isSending}
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