// app/chat/components/ChatToolbar.tsx
// M7: Extract toolbars + banners (demo toolbar, mode toolbar, session meta, rate limit, mode lock banner)
//
// CHANGE (M8.2 Workflow UI Alignment):
// - aligns visible UI naming with the new workflow terminology
// - internal modes remain unchanged: coach / cases / review
// - removes redundant mode switcher buttons from the toolbar
// - keeps ChatHeader as the primary workflow selector
// - preserves session-lock rules and demo behavior
//
// CHANGE (M10 UI Pass):
// - add theme-aware toolbar text and banners
// - remove dark-only banner/session-meta styling assumptions
// - keep toolbar behavior unchanged
//
// M12.9 CHANGE:
// - add contextual workspace action entry for Generate Tests
// - keep UI trigger-only; action execution remains in hook
// - expose explicit workflow action error banner
// - preserve existing toolbar layout and demo/session controls
//
// M12.10 CHANGE:
// - improve toolbar clarity by separating session controls from workspace controls
// - make workspace action availability easier to scan
// - keep action gating hook-driven and artifact-driven
// - preserve existing action behavior and session lock behavior
//
// M12.11 CHANGE:
// - improve first-run clarity for toolbar sections
// - make session vs workspace intent easier to understand
// - add lightweight onboarding copy only; no workflow logic changes
//
// V1.1 UI CLEANUP:
// - collapse demo shortcuts behind an optional disclosure
// - remove repeated helper callouts so workspace content appears sooner
// - keep session/workspace actions trigger-only and hook-driven

"use client";

import React, { useMemo } from "react";
import type { Mode } from "../chat.types";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

import { Chip, Group, HeaderButton, ModeBadge, Toolbar } from "./ChatUI";

import {
  DEMO_CASES_LOGIN,
  DEMO_COACH_LOGIN,
  DEMO_REVIEW_EXPORT,
  DEMO_REVIEW_LOGIN,
} from "../demoPrompts";

/** Local storage key (so reload keeps the demo context). */
const STORAGE_KEY = "stefans-mvp-chat-v1";

function modeLabel(m: Mode) {
  return m === "coach"
    ? "Strategy"
    : m === "review"
      ? "Test Review"
      : "Test Design";
}

type Props = {
  chat: UseChatSessionReturn;
  onAfterUiAction?: () => void;

  // M10 UI:
  // Resolved by page shell and passed down so all chrome can follow one theme.
  resolvedTheme?: "light" | "dark";
};

export default function ChatToolbar({
  chat,
  onAfterUiAction,
  resolvedTheme = "dark",
}: Props) {
  const rateChipText = useMemo(() => {
    if (!chat.rate) return null;
    return `Rate: ${chat.rate.remaining}/${chat.rate.limit} · resets in ${chat.rate.resetSeconds}s`;
  }, [chat.rate]);

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#ffffff" : "#0f172a";
  const subtleText = isDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.68)";

  const bannerStyle: React.CSSProperties = {
    marginTop: 10,
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: isDark
      ? "1px solid rgba(255,255,255,0.22)"
      : "1px solid rgba(15,23,42,0.14)",
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
    color: textColor,
    fontSize: 13,
    fontWeight: 800,
  };

  // M12.9:
  // Workflow action failures are explicit system states, not silent no-ops.
  const workflowErrorBannerStyle: React.CSSProperties = {
    ...bannerStyle,
    border: isDark
      ? "1px solid rgba(248,113,113,0.45)"
      : "1px solid rgba(185,28,28,0.22)",
    background: isDark ? "rgba(127,29,29,0.28)" : "rgba(254,242,242,1)",
    color: isDark ? "#fecaca" : "#991b1b",
  };

  const modeLockButtonStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: isDark
      ? "1px solid rgba(255,255,255,0.22)"
      : "1px solid rgba(15,23,42,0.14)",
    background: isDark ? "rgba(255,255,255,0.14)" : "#ffffff",
    color: textColor,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
  };

  const loadDemoAction = (demoMode: Mode, text: string) => {
    // Preserve existing behavior: cannot change mode inside an existing locked session.
    if (chat.activeSessionId && demoMode !== chat.activeSessionMode) {
      chat.trySetMode(demoMode);
      return;
    }

    chat.trySetMode(demoMode);
    chat.setInput(text);
  };

  const isBusy = chat.isSending || chat.isRunningWorkflowAction;
  const hasWorkspace = !!chat.activeSessionId;
  const showGenerateTestsAction = chat.hasPinnedRequirement && hasWorkspace;

  const demoDisclosureStyle: React.CSSProperties = {
    marginBottom: 10,
    borderRadius: 14,
    border: isDark
      ? "1px solid rgba(255,255,255,0.10)"
      : "1px solid rgba(15,23,42,0.10)",
    background: isDark ? "rgba(255,255,255,0.035)" : "rgba(15,23,42,0.025)",
    color: textColor,
    overflow: "hidden",
  };

  const demoSummaryStyle: React.CSSProperties = {
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    listStyle: "none",
  };

  return (
    <>
      <details style={demoDisclosureStyle}>
        <summary style={demoSummaryStyle}>
          Demo shortcuts
          <span style={{ marginLeft: 8, opacity: 0.62, fontWeight: 700 }}>
            sample inputs
          </span>
        </summary>

        <div style={{ padding: "0 10px 10px" }}>
          <Toolbar resolvedTheme={resolvedTheme}>
            <Chip resolvedTheme={resolvedTheme}>Demo</Chip>

            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => loadDemoAction("coach", DEMO_COACH_LOGIN)}
              disabled={isBusy}
            >
              Login + MFA (Strategy)
            </HeaderButton>

            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => loadDemoAction("review", DEMO_REVIEW_LOGIN)}
              disabled={isBusy}
            >
              Login + MFA (Test Review)
            </HeaderButton>

            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => loadDemoAction("review", DEMO_REVIEW_EXPORT)}
              disabled={isBusy}
            >
              Export CSV (Test Review)
            </HeaderButton>

            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => loadDemoAction("cases", DEMO_CASES_LOGIN)}
              disabled={isBusy}
            >
              Login + MFA (Test Design)
            </HeaderButton>
          </Toolbar>
        </div>
      </details>

      {/* Session actions toolbar */}
      <Toolbar resolvedTheme={resolvedTheme}>
        <Group>
          <Chip resolvedTheme={resolvedTheme}>Session</Chip>
          <ModeBadge mode={chat.mode} resolvedTheme={resolvedTheme} />
          {rateChipText && (
            <Chip resolvedTheme={resolvedTheme}>{rateChipText}</Chip>
          )}
          {chat.lastRequestId && (
            <Chip resolvedTheme={resolvedTheme}>
              rid: {chat.lastRequestId.slice(0, 8)}…
            </Chip>
          )}

          {chat.lastPending && !chat.isSending && !chat.isRunningWorkflowAction && (
            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => {
                void (async () => {
                  await chat.send({ replay: true });
                  onAfterUiAction?.();
                })();
              }}
            >
              Retry
            </HeaderButton>
          )}

          <HeaderButton
            resolvedTheme={resolvedTheme}
            onClickAction={() => {
              chat.startNewSessionInMode(chat.mode);
              localStorage.removeItem(STORAGE_KEY);
              onAfterUiAction?.();
            }}
            disabled={isBusy}
          >
            Clear
          </HeaderButton>
        </Group>

        <Group>
          <Chip resolvedTheme={resolvedTheme}>New workspace</Chip>
          <HeaderButton
            resolvedTheme={resolvedTheme}
            onClickAction={() => {
              chat.startNewSessionInMode("coach");
              onAfterUiAction?.();
            }}
            disabled={isBusy}
          >
            Strategy
          </HeaderButton>
          <HeaderButton
            resolvedTheme={resolvedTheme}
            onClickAction={() => {
              chat.startNewSessionInMode("cases");
              onAfterUiAction?.();
            }}
            disabled={isBusy}
          >
            Test Design
          </HeaderButton>
          <HeaderButton
            resolvedTheme={resolvedTheme}
            onClickAction={() => {
              chat.startNewSessionInMode("review");
              onAfterUiAction?.();
            }}
            disabled={isBusy}
          >
            Test Review
          </HeaderButton>
        </Group>
      </Toolbar>

      {/* M12.9:
          Contextual workspace actions are artifact-driven.
          Visibility stays in UI; eligibility/execution stays in hook.
      */}
      {showGenerateTestsAction ? (
        <Toolbar resolvedTheme={resolvedTheme}>
          <Group>
            <Chip resolvedTheme={resolvedTheme}>Workspace actions</Chip>
            <HeaderButton
              resolvedTheme={resolvedTheme}
              onClickAction={() => {
                void (async () => {
                  await chat.generateTestsFromRequirement();
                  onAfterUiAction?.();
                })();
              }}
              disabled={!chat.canGenerateTests}
            >
              {chat.isRunningWorkflowAction ? "Generating…" : "Generate Tests"}
            </HeaderButton>
          </Group>
        </Toolbar>
      ) : null}

      {/* Mode lock banner (null-safe) */}
      {chat.modeLockMsg &&
        (() => {
          const lock = chat.modeLockMsg;
          return (
            <div
              style={{
                ...bannerStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ lineHeight: 1.35 }}>
                This session is locked to <b>{modeLabel(lock.sessionMode)}</b>. To
                use <b>{modeLabel(lock.requestedMode)}</b>, start a new session.
              </div>

              <button
                type="button"
                onClick={() => {
                  chat.startNewSessionInMode(lock.requestedMode);
                  onAfterUiAction?.();
                }}
                style={modeLockButtonStyle}
              >
                New session in {modeLabel(lock.requestedMode)}
              </button>
            </div>
          );
        })()}

      {/* M12.9:
          Explicit workflow-action failure state.
          Avoid silent no-op or empty output states.
      */}
      {chat.workflowActionError && (
        <div style={workflowErrorBannerStyle}>{chat.workflowActionError}</div>
      )}

      {/* Session meta row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          margin: "12px 0 10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Chip resolvedTheme={resolvedTheme}>
          {chat.activeSessionId
            ? `Session: ${chat.activeSessionId.slice(0, 8)}…`
            : "Session: (new)"}
        </Chip>

        {chat.activeSessionId ? (
          <ModeBadge
            mode={chat.activeSessionMode}
            locked
            resolvedTheme={resolvedTheme}
          />
        ) : null}

        {chat.activeSessionId && chat.messagesCursor && (
          <HeaderButton
            resolvedTheme={resolvedTheme}
            onClickAction={() => {
              void (async () => {
                await chat.loadSessionMessages(
                  chat.activeSessionId!,
                  false,
                  chat.activeSessionMode
                );
              })();
            }}
            disabled={chat.messagesLoading || chat.isRunningWorkflowAction}
          >
            {chat.messagesLoading ? "Loading…" : "Load older"}
          </HeaderButton>
        )}

        {chat.activeSessionId ? (
          <div style={{ fontSize: 12, color: subtleText }}>
            Workspace actions use persisted artifacts.
          </div>
        ) : null}
      </div>

      {/* Rate limit banner */}
      {chat.rateLimitMsg && <div style={bannerStyle}>{chat.rateLimitMsg}</div>}
    </>
  );
}
