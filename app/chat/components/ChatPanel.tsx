// app/chat/components/ChatPanel.tsx
// M7: Extract chat body (messages + guided suggestions + input) from page.tsx.

"use client";

import React, { useEffect, useRef } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession";

import ChatMessageList from "./ChatMessageList";
import GuidedSuggestions from "../GuidedSuggestions";
import ChatInput from "./ChatInput";

type Props = {
  chat: UseChatSessionReturn;
  onAfterSendAction?: () => void; // optional: page can force scroll-to-bottom, etc.
};

export default function ChatPanel({ chat, onAfterSendAction }: Props) {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <>
      {/* Chat messages */}
      <div ref={chatBoxRef} style={chatBoxStyle}>
        <ChatMessageList items={chat.items} mode={chat.mode} />
      </div>

      {/* Guided suggestions block (below chat, above input) */}
      {chat.mode === "coach" && chat.activeSessionMode === "coach" && chat.latestCoachSuggestions && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-start" }}>
          <GuidedSuggestions
            suggestions={chat.latestCoachSuggestions}
            onUseSelectionsAction={(autofillText: string) => {
              chat.setInput(autofillText);
              requestAnimationFrame(() => {
                inputRef.current?.focus();
                chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
              });
            }}
          />
        </div>
      )}

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