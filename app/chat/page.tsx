// app/chat/page.tsx
"use client";

import React, { useState } from "react";

import { useChatSession } from "./hooks/useChatSession";

import SessionSidebar from "./components/SessionSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatToolbar from "./components/ChatToolbar";
import ChatPanel from "./components/ChatPanel";

export default function ChatPage() {
  const chat = useChatSession();

  // Page-only: optional rerender tick (used to refresh layout-dependent UI state)
  const [uiTick, setUiTick] = useState(0);
  const bumpUiTickAction = () => setUiTick((v) => v + 1);

  const mainStyle: React.CSSProperties = {
    padding: 20,
    maxWidth: 1040,
    margin: "0 auto",
    color: "#fff",
    background: "radial-gradient(900px 360px at 50% -120px, rgba(255,255,255,0.10), rgba(0,0,0,0))",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <SessionSidebar
        sidebarWidth={chat.sidebarWidth}
        sidebarCollapsed={chat.sidebarCollapsed}
        sessions={chat.sessions}
        sessionsCursor={chat.sessionsCursor}
        sessionsLoading={chat.sessionsLoading}
        activeSessionId={chat.activeSessionId}
        renamingId={chat.renamingId}
        renameValue={chat.renameValue}
        renameSaving={chat.renameSaving}
        deletingId={chat.deletingId}
        deleteBusy={chat.deleteBusy}
        onNewChatAction={() => {
          chat.newChat();
          bumpUiTickAction();
        }}
        onSelectSessionAction={(id, m) => {
          void (async () => {
            await chat.selectSession(id, m);
            bumpUiTickAction();
          })();
        }}
        onLoadMoreSessionsAction={() => void chat.loadSessions(false)}
        onStartRenameAction={(id, title) => {
          chat.setRenamingId(id);
          chat.setRenameValue(title);
        }}
        onRenameValueChangeAction={(v) => chat.setRenameValue(v)}
        onSaveRenameAction={(id, v) => void chat.renameSession(id, v)}
        onCancelRenameAction={() => {
          chat.setRenamingId(null);
          chat.setRenameValue("");
        }}
        onDeleteSessionAction={(id) => void chat.deleteSession(id)}
      />

      <main style={{ ...mainStyle, flex: 1, overflow: "auto" }}>
        <ChatHeader
          sidebarCollapsed={chat.sidebarCollapsed}
          onToggleSidebarAction={() => chat.setSidebarCollapsed((v) => !v)}
        />

        <ChatToolbar
          chat={chat}
          onAfterUiAction={() => {
            bumpUiTickAction();
          }}
        />

        <ChatPanel
          chat={chat}
          onAfterSendAction={() => {
            bumpUiTickAction();
          }}
        />
      </main>
    </div>
  );
}