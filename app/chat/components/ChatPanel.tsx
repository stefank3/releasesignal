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

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession";

import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import StrategyPanel from "./StrategyPanel";

type Props = {
  chat: UseChatSessionReturn;
  onAfterSendAction?: () => void;
};

function OnboardingHint({ showStrategyHint }: { showStrategyHint: boolean }) {
  return (
    <div
      style={{
        marginBottom: 12,
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.92 }}>Getting started</div>

      <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
        Describe a feature or paste a requirement.
        {showStrategyHint ? " Use the Strategy Panel to refine it before generating cases." : ""}
      </div>

      <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
        Example:
        <br />
        <span style={{ opacity: 0.88 }}>
          Create a test strategy for login with MFA and then generate test cases.
        </span>
      </div>
    </div>
  );
}

export default function ChatPanel({ chat, onAfterSendAction }: Props) {
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

  // Keep scroll preference updated based on user scrolling
  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    const onScroll = () => {
      chat.shouldAutoScrollRef.current = isNearBottom(el);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [chat]);

  // Auto-scroll when new items arrive (only if user is already near bottom)
  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    if (chat.shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.items, chat]);

  const isCoachSession = chat.mode === "coach" && chat.activeSessionMode === "coach";

  const gridTemplateColumns = useMemo(() => {
    if (!isCoachSession) return "1fr";
    if (isNarrow) return "1fr";
    // CHANGE: slightly wider strategy area felt too detached at 360px; tighten balance a bit
    return "minmax(0, 1fr) 340px";
  }, [isCoachSession, isNarrow]);

  // CHANGE: left side becomes one unified chat surface
  const leftPanelStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "1fr auto",
    minHeight: isNarrow ? "60vh" : "68vh",
  };

  const chatBoxStyle: React.CSSProperties = {
    padding: 14,
    overflow: "auto",
    minHeight: 0,
  };

  // CHANGE: visually attach input to the chat panel instead of floating below
  const inputWrapStyle: React.CSSProperties = {
    borderTop: "1px solid rgba(255,255,255,0.10)",
    padding: 12,
    background: "rgba(0,0,0,0.16)",
  };

  // CHANGE (M7.7): onboarding hint shows only on empty sessions / first interaction
  const showOnboardingHint = chat.items.length === 0 && !chat.isSending;

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        alignItems: "start",
        gridTemplateColumns,
      }}
    >
      {/* Left: unified chat surface (messages + input) */}
      <div>
        {showOnboardingHint ? <OnboardingHint showStrategyHint={isCoachSession} /> : null}

        <div style={leftPanelStyle}>
          <div ref={chatBoxRef} style={chatBoxStyle}>
            <ChatMessageList items={chat.items} mode={chat.mode} />
          </div>

          <div style={inputWrapStyle}>
            <ChatInput
              ref={inputRef}
              mode={chat.mode}
              value={chat.input}
              disabled={chat.isSending}
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

      {/* Right: strategy panel */}
      {isCoachSession ? (
        <div>
          <StrategyPanel chat={chat} />
        </div>
      ) : null}
    </div>
  );
}