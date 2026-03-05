// app/chat/components/ChatPanel.tsx
// M7: Extract chat body (messages + guided suggestions + input) from page.tsx.

"use client";

import React, { useEffect, useRef } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { isNearBottom } from "../hooks/useChatSession";

import ChatMessageList from "./ChatMessageList";
import GuidedSuggestions from "../GuidedSuggestions";
import ChatInput from "./ChatInput";

// CHANGE (M7.7): display pinned Session Artifact (Refined Requirement)
function ArtifactCard(props: {
  artifact: UseChatSessionReturn["sessionArtifact"];
  artifactUpdatedAt: UseChatSessionReturn["artifactUpdatedAt"];
}) {
  const a = props.artifact;
  if (!a?.refinedRequirement) return null;

  const rr = a.refinedRequirement;

  const wrapStyle: React.CSSProperties = {
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.85,
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "2px 8px",
    borderRadius: 999,
  };

  const sectionTitle: React.CSSProperties = { fontWeight: 700, fontSize: 12, opacity: 0.9, marginTop: 10 };
  const item: React.CSSProperties = { fontSize: 13, opacity: 0.92, marginTop: 4, lineHeight: 1.35 };

  const updated = props.artifactUpdatedAt ? new Date(props.artifactUpdatedAt).toLocaleString() : null;

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>
        <span>📌 Pinned Requirement</span>
        <span style={badgeStyle}>{updated ? `Updated: ${updated}` : "Pinned"}</span>
      </div>

      {rr.objective && (
        <>
          <div style={sectionTitle}>Objective</div>
          <div style={item}>{rr.objective}</div>
        </>
      )}

      {rr.context && (
        <>
          <div style={sectionTitle}>Context / Constraints</div>
          <div style={item}>( {rr.context} )</div>
        </>
      )}

      {!!rr.integrations?.length && (
        <>
          <div style={sectionTitle}>Integrations</div>
          <div style={item}>{rr.integrations.join(", ")}</div>
        </>
      )}

      {!!rr.riskFocus?.length && (
        <>
          <div style={sectionTitle}>Risk focus</div>
          <div style={item}>{rr.riskFocus.join(", ")}</div>
        </>
      )}

      {!!rr.inScope?.length && (
        <>
          <div style={sectionTitle}>In scope</div>
          {rr.inScope.slice(0, 12).map((s, i) => (
            <div key={`inscope-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      )}

      {!!rr.outOfScope?.length && (
        <>
          <div style={sectionTitle}>Out of scope</div>
          {rr.outOfScope.slice(0, 12).map((s, i) => (
            <div key={`outscope-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      )}

      {!!rr.acceptanceCriteria?.length && (
        <>
          <div style={sectionTitle}>Acceptance criteria</div>
          {rr.acceptanceCriteria.slice(0, 12).map((s, i) => (
            <div key={`ac-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

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

      {/* CHANGE (M7.7): Pinned requirement card (Session Artifact) */}
      {chat.activeSessionId && chat.sessionArtifact?.refinedRequirement && (
        <ArtifactCard artifact={chat.sessionArtifact} artifactUpdatedAt={chat.artifactUpdatedAt} />
      )}

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