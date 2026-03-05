// app/chat/components/ChatPanel.tsx
// M7: Extract chat body (messages + guided suggestions + input) from page.tsx.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession";

import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";

// CHANGE (M7 Locked): StrategyPanel consolidates guided stepper + pinned artifact
import StrategyPanel from "./StrategyPanel";

type Props = {
  chat: UseChatSessionReturn;
  onAfterSendAction?: () => void; // optional: page can force scroll-to-bottom, etc.
};

export default function ChatPanel({ chat, onAfterSendAction }: Props) {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // CHANGE (M7 Locked, responsive): stack StrategyPanel under chat on narrow screens
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

  const chatBoxStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    height: "52vh",
    overflow: "auto",
    background: "rgba(255,255,255,0.04)",
  };

  // CHANGE (M7 Locked): show StrategyPanel only for coach sessions
  const isCoachSession = chat.mode === "coach" && chat.activeSessionMode === "coach";

  // CHANGE (M7 Locked): avoid hard 2-col layout on narrow widths
  const gridTemplateColumns = useMemo(() => {
    if (!isCoachSession) return "1fr";
    if (isNarrow) return "1fr"; // stack
    return "1fr 360px"; // desktop split
  }, [isCoachSession, isNarrow]);

  return (
    <>
      <div
        style={{
          display: "grid",
          gap: 12,
          alignItems: "start",
          gridTemplateColumns,
        }}
      >
        {/* Chat messages */}
        <div>
          <div ref={chatBoxRef} style={chatBoxStyle}>
            <ChatMessageList items={chat.items} mode={chat.mode} />
          </div>
        </div>

        {/* Strategy panel (coach only) */}
        {isCoachSession ? (
          <div>
            <StrategyPanel chat={chat} />
          </div>
        ) : null}
      </div>

      {/* Input row */}
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
    </>
  );
}