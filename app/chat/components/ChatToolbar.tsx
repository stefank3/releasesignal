// app/chat/components/ChatToolbar.tsx
// Utility actions for the authenticated workspace.
// Primary workflow navigation lives in ChatHeader.

"use client";

import React from "react";
import type { Mode } from "../chat.types";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

import { Chip, HeaderButton, Toolbar } from "./ChatUI";

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
  resolvedTheme?: "light" | "dark";
};

export default function ChatToolbar({
  chat,
  onAfterUiAction,
  resolvedTheme = "dark",
}: Props) {
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

  return (
    <>
      <Toolbar resolvedTheme={resolvedTheme}>
        <Chip resolvedTheme={resolvedTheme}>Workspace</Chip>

        {chat.lastPending && !chat.isSending && !chat.isRunningWorkflowAction ? (
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
        ) : null}

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

        <HeaderButton
          resolvedTheme={resolvedTheme}
          onClickAction={() => {
            chat.startNewSessionInMode("coach");
            onAfterUiAction?.();
          }}
          disabled={isBusy}
        >
          New workspace
        </HeaderButton>

        {showGenerateTestsAction ? (
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
            {chat.isRunningWorkflowAction ? "Generating..." : "Generate Tests"}
          </HeaderButton>
        ) : null}
      </Toolbar>

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

      {chat.activeSessionId || chat.messagesCursor ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            margin: "10px 0",
            flexWrap: "wrap",
            alignItems: "center",
            color: subtleText,
            fontSize: 12,
          }}
        >
          {chat.activeSessionId ? (
            <span>
              Workspace {chat.activeSessionId.slice(0, 8)}... uses persisted artifacts.
            </span>
          ) : null}

          {chat.activeSessionId && chat.messagesCursor ? (
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
              {chat.messagesLoading ? "Loading..." : "Load older"}
            </HeaderButton>
          ) : null}
        </div>
      ) : null}

      {chat.rateLimitMsg ? <div style={bannerStyle}>{chat.rateLimitMsg}</div> : null}
    </>
  );
}
