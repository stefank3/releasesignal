// app/chat/components/ChatToolbar.tsx
// M7: Extract toolbars + banners (demo toolbar, mode toolbar, session meta, rate limit, mode lock banner)
//
// CHANGE (M8.2 Workflow UI Alignment):
// - aligns visible UI naming with the new workflow terminology
// - internal modes remain unchanged: coach / cases / review
// - removes redundant mode switcher buttons from the toolbar
// - keeps ChatHeader as the primary workflow selector
// - preserves session-lock rules and demo behavior

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
  return m === "coach" ? "Strategy" : m === "review" ? "Test Review" : "Test Design";
}

type Props = {
  chat: UseChatSessionReturn;
  onAfterUiAction?: () => void; // page can force scroll-to-bottom, etc.
};

export default function ChatToolbar({ chat, onAfterUiAction }: Props) {
  const rateChipText = useMemo(() => {
    if (!chat.rate) return null;
    return `Rate: ${chat.rate.remaining}/${chat.rate.limit} · resets in ${chat.rate.resetSeconds}s`;
  }, [chat.rate]);

  const loadDemoAction = (demoMode: Mode, text: string) => {
    // Preserve existing behavior: cannot change mode inside an existing locked session.
    if (chat.activeSessionId && demoMode !== chat.activeSessionMode) {
      chat.trySetMode(demoMode); // sets modeLockMsg via hook
      return;
    }

    chat.trySetMode(demoMode);
    chat.setInput(text);
  };

  return (
    <>
      {/* Demo toolbar */}
      <Toolbar
        right={
          <HeaderButton
            onClickAction={() => {
              chat.startNewSessionInMode(chat.mode);
              localStorage.removeItem(STORAGE_KEY);
              onAfterUiAction?.();
            }}
            disabled={chat.isSending}
          >
            Clear
          </HeaderButton>
        }
      >
        <Chip>Demo</Chip>

        <HeaderButton
          onClickAction={() => loadDemoAction("coach", DEMO_COACH_LOGIN)}
          disabled={chat.isSending}
        >
          Login + MFA (Strategy)
        </HeaderButton>

        <HeaderButton
          onClickAction={() => loadDemoAction("review", DEMO_REVIEW_LOGIN)}
          disabled={chat.isSending}
        >
          Login + MFA (Test Review)
        </HeaderButton>

        <HeaderButton
          onClickAction={() => loadDemoAction("review", DEMO_REVIEW_EXPORT)}
          disabled={chat.isSending}
        >
          Export CSV (Test Review)
        </HeaderButton>

        <HeaderButton
          onClickAction={() => loadDemoAction("cases", DEMO_CASES_LOGIN)}
          disabled={chat.isSending}
        >
          Login + MFA (Test Design)
        </HeaderButton>
      </Toolbar>

      <div style={{ height: 10 }} />

      {/* Session actions toolbar */}
      <Toolbar>
        <Group>
          <ModeBadge mode={chat.mode} />
          {rateChipText && <Chip>{rateChipText}</Chip>}
          {chat.lastRequestId && <Chip>rid: {chat.lastRequestId.slice(0, 8)}…</Chip>}

          {chat.lastPending && !chat.isSending && (
            <HeaderButton
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
        </Group>

        {/* M8.2:
            Removed redundant mode switcher buttons from the toolbar.
            ChatHeader is now the primary workflow selector.
        */}

        <Group>
          <Chip>New session</Chip>
          <HeaderButton
            onClickAction={() => {
              chat.startNewSessionInMode("coach");
              onAfterUiAction?.();
            }}
            disabled={chat.isSending}
          >
            Strategy
          </HeaderButton>
          <HeaderButton
            onClickAction={() => {
              chat.startNewSessionInMode("review");
              onAfterUiAction?.();
            }}
            disabled={chat.isSending}
          >
            Test Review
          </HeaderButton>
          <HeaderButton
            onClickAction={() => {
              chat.startNewSessionInMode("cases");
              onAfterUiAction?.();
            }}
            disabled={chat.isSending}
          >
            Test Design
          </HeaderButton>
        </Group>
      </Toolbar>

      {/* Mode lock banner (null-safe) */}
      {chat.modeLockMsg &&
        (() => {
          const lock = chat.modeLockMsg;
          return (
            <div
              style={{
                marginTop: 10,
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ lineHeight: 1.35 }}>
                This session is locked to <b>{modeLabel(lock.sessionMode)}</b>. To use{" "}
                <b>{modeLabel(lock.requestedMode)}</b>, start a new session.
              </div>

              <button
                onClick={() => {
                  chat.startNewSessionInMode(lock.requestedMode);
                  onAfterUiAction?.();
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                New session in {modeLabel(lock.requestedMode)}
              </button>
            </div>
          );
        })()}

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
        <Chip>{chat.activeSessionId ? `Session: ${chat.activeSessionId.slice(0, 8)}…` : "Session: (new)"}</Chip>

        {chat.activeSessionId ? <ModeBadge mode={chat.activeSessionMode} locked /> : null}

        {chat.activeSessionId && chat.messagesCursor && (
          <HeaderButton
            onClickAction={() => {
              void (async () => {
                await chat.loadSessionMessages(
                  chat.activeSessionId!,
                  false,
                  chat.activeSessionMode
                );
              })();
            }}
            disabled={chat.messagesLoading}
          >
            {chat.messagesLoading ? "Loading…" : "Load older"}
          </HeaderButton>
        )}

        {chat.activeSessionId ? (
          <div style={{ fontSize: 12, opacity: 0.72 }}>
            Mode is session-locked. Start a new session to switch workflow steps.
          </div>
        ) : null}
      </div>

      {/* Rate limit banner */}
      {chat.rateLimitMsg && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {chat.rateLimitMsg}
        </div>
      )}
    </>
  );
}