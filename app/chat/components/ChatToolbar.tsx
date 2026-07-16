// app/chat/components/ChatToolbar.tsx
// Utility actions for the authenticated workspace.
// Primary workflow navigation lives in ChatHeader.

"use client";

import React from "react";
import type { Mode } from "../chat.types";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

import { TestSuiteExportMenu } from "./TestSuiteExportMenu";

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
  onCreditsMayHaveChanged?: () => void;
  resolvedTheme?: "light" | "dark";
};

export default function ChatToolbar({
  chat,
  onAfterUiAction,
  onCreditsMayHaveChanged,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#ffffff" : "#0f172a";

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

  const isBusy = chat.isSending || chat.isRunningWorkflowAction;
  const hasWorkspace = !!chat.activeSessionId;
  const showGenerateTestsAction = chat.hasPinnedRequirement && hasWorkspace;
  const testDesignButtonStyle: React.CSSProperties = {
    borderRadius: 8,
    border: isDark ? "1px solid #4A4739" : "1px solid #C4BCA7",
    background: isDark ? "#35332C" : "#F1EDE2",
    color: isDark ? "#EDEAE3" : "#262521",
    padding: "7px 13px",
    fontSize: 12.5,
    fontWeight: 700,
    lineHeight: 1.2,
    cursor: isBusy ? "not-allowed" : "pointer",
    opacity: isBusy ? 0.55 : 1,
    whiteSpace: "nowrap",
  };
  const testDesignPrimaryButtonStyle: React.CSSProperties = {
    ...testDesignButtonStyle,
    border: isDark ? "1px solid #D97757" : "1px solid #C15F3C",
    background: isDark ? "#D97757" : "#C15F3C",
    color: "#FFFFFF",
  };
  const testDesignClearStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: isDark ? "#E8776A" : "#B0392E",
    padding: "7px 10px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: isBusy ? "not-allowed" : "pointer",
    opacity: isBusy ? 0.55 : 1,
    whiteSpace: "nowrap",
  };

  const runBillableAction = (action: () => Promise<boolean>) => {
    void (async () => {
      const creditsMayHaveChanged = await action();
      onAfterUiAction?.();
      if (creditsMayHaveChanged) {
        onCreditsMayHaveChanged?.();
      }
    })();
  };

  return (
    <>
      {chat.mode === "cases" ? (
        <section
          aria-label="Test Design workspace actions"
          style={{
            marginTop: 10,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "9px 12px",
            borderRadius: 12,
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            background: isDark ? "#2B2A26" : "#FCFBF6",
            color: isDark ? "#EDEAE3" : "#262521",
          }}
        >
          <span
            style={{
              marginRight: 4,
              color: isDark ? "#7D796C" : "#8B8577",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Test Design
          </span>

          {chat.lastPending && !isBusy ? (
            <button
              type="button"
              onClick={() => runBillableAction(() => chat.send({ replay: true }))}
              style={testDesignButtonStyle}
            >
              Retry
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => runBillableAction(() => chat.generateTestsFromRequirement())}
            style={
              {
                ...(chat.hasPersistentTestSuite
                  ? testDesignButtonStyle
                  : testDesignPrimaryButtonStyle),
                opacity: chat.canGenerateTests ? 1 : 0.55,
                cursor: chat.canGenerateTests ? "pointer" : "not-allowed",
              }
            }
            disabled={!chat.canGenerateTests}
            title={
              !chat.hasPinnedRequirement
                ? "Generate Tests needs a saved requirement"
                : undefined
            }
          >
            {chat.isRunningWorkflowAction ? "Generating..." : "Generate Tests"}
          </button>

          {!chat.hasPinnedRequirement ? (
            <span
              style={{
                color: isDark ? "#7D796C" : "#8B8577",
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              Needs a saved requirement
            </span>
          ) : null}

          {chat.hasPersistentTestSuite ? (
            <>
              <button
                type="button"
                onClick={() => runBillableAction(() => chat.regenerateSuite())}
                style={{
                  ...testDesignPrimaryButtonStyle,
                  opacity: chat.canRegenerateSuite ? 1 : 0.55,
                  cursor: chat.canRegenerateSuite ? "pointer" : "not-allowed",
                }}
                disabled={!chat.canRegenerateSuite}
              >
                {chat.isRunningWorkflowAction ? "Improving..." : "Improve Test Plan"}
              </button>
              <button
                type="button"
                onClick={() => runBillableAction(() => chat.generateNextBatchOfTests())}
                style={{
                  ...testDesignButtonStyle,
                  opacity: chat.canGenerateNextBatch ? 1 : 0.55,
                  cursor: chat.canGenerateNextBatch ? "pointer" : "not-allowed",
                }}
                disabled={!chat.canGenerateNextBatch}
              >
                {chat.isRunningWorkflowAction
                  ? "Generating..."
                  : "Generate Next Batch"}
              </button>
              <button
                type="button"
                onClick={() => runBillableAction(() => chat.reviewTestSuite())}
                style={{
                  ...testDesignButtonStyle,
                  opacity: chat.canReviewTestSuite ? 1 : 0.55,
                  cursor: chat.canReviewTestSuite ? "pointer" : "not-allowed",
                }}
                disabled={!chat.canReviewTestSuite}
              >
                {chat.isRunningWorkflowAction
                  ? "Reviewing..."
                  : "Review Test Suite"}
              </button>

              <TestSuiteExportMenu
                sessionId={chat.activeSessionId}
                disabled={!chat.hasPersistentTestSuite || isBusy}
                resolvedTheme={resolvedTheme}
                visualVariant="strategy"
              />
            </>
          ) : null}

          {chat.activeSessionId && chat.messagesCursor ? (
            <button
              type="button"
              onClick={() => {
                void chat.loadSessionMessages(
                  chat.activeSessionId!,
                  false,
                  chat.activeSessionMode
                );
              }}
              style={testDesignButtonStyle}
              disabled={chat.messagesLoading || chat.isRunningWorkflowAction}
            >
              {chat.messagesLoading ? "Loading..." : "Load older"}
            </button>
          ) : null}

          <span style={{ flex: "1 1 20px" }} />

          <button
            type="button"
            onClick={() => {
              chat.startNewSessionInMode("coach");
              onAfterUiAction?.();
            }}
            style={testDesignButtonStyle}
            disabled={isBusy}
          >
            New workspace
          </button>
          <button
            type="button"
            onClick={() => {
              chat.startNewSessionInMode(chat.mode);
              localStorage.removeItem(STORAGE_KEY);
              onAfterUiAction?.();
            }}
            style={testDesignClearStyle}
            disabled={isBusy}
          >
            Clear
          </button>
        </section>
      ) : null}

      {chat.mode === "review" ? (
        <section
          aria-label="Test Review workspace actions"
          style={{
            marginTop: 10,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "9px 12px",
            borderRadius: 12,
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            background: isDark ? "#2B2A26" : "#FCFBF6",
            color: isDark ? "#EDEAE3" : "#262521",
          }}
        >
          <span
            style={{
              marginRight: 4,
              color: isDark ? "#7D796C" : "#8B8577",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            Test Review
          </span>

          {chat.lastPending && !chat.isSending && !chat.isRunningWorkflowAction ? (
            <button
              type="button"
              onClick={() => runBillableAction(() => chat.send({ replay: true }))}
              style={testDesignButtonStyle}
            >
              Retry
            </button>
          ) : null}

          {showGenerateTestsAction ? (
            <button
              type="button"
              onClick={() => runBillableAction(() => chat.generateTestsFromRequirement())}
              style={{
                ...testDesignButtonStyle,
                opacity: chat.canGenerateTests ? 1 : 0.55,
                cursor: chat.canGenerateTests ? "pointer" : "not-allowed",
              }}
              disabled={!chat.canGenerateTests}
            >
              {chat.isRunningWorkflowAction ? "Generating..." : "Generate Tests"}
            </button>
          ) : null}

          {chat.activeSessionId && chat.messagesCursor ? (
            <button
              type="button"
              onClick={() => {
                void chat.loadSessionMessages(
                  chat.activeSessionId!,
                  false,
                  chat.activeSessionMode
                );
              }}
              style={testDesignButtonStyle}
              disabled={chat.messagesLoading || chat.isRunningWorkflowAction}
            >
              {chat.messagesLoading ? "Loading..." : "Load older"}
            </button>
          ) : null}

          <span style={{ flex: "1 1 20px" }} />

          <button
            type="button"
            onClick={() => {
              chat.startNewSessionInMode("coach");
              onAfterUiAction?.();
            }}
            style={testDesignButtonStyle}
            disabled={isBusy}
          >
            New workspace
          </button>

          <button
            type="button"
            onClick={() => {
              chat.startNewSessionInMode(chat.mode);
              localStorage.removeItem(STORAGE_KEY);
              onAfterUiAction?.();
            }}
            style={testDesignClearStyle}
            disabled={isBusy}
          >
            Clear
          </button>
        </section>
      ) : null}

      {chat.modeLockMsg
        ? (() => {
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
          })()
        : null}

      {chat.workflowActionError ? (
        <div style={workflowErrorBannerStyle}>{chat.workflowActionError}</div>
      ) : null}

      {chat.rateLimitMsg ? <div style={bannerStyle}>{chat.rateLimitMsg}</div> : null}
    </>
  );
}
