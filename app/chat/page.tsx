// app/chat/page.tsx
// CHANGE (M8.1 Workflow Selector Wiring):
// - wires ChatHeader to the existing internal mode state
// - preserves internal modes: coach / cases / review
//
// CHANGE (M8.1 Layout Width Improvement):
// - relaxes the narrow centered container
// - allows Release Signal to use much more horizontal space
// - keeps a controlled max width for readability and UI stability

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
    // M8.1:
    // Increased horizontal breathing room for workflow-oriented UI.
    padding: "20px 24px",

    // M8.1:
    // Previous value (1040) made the app feel boxed in on large screens.
    // 1480 keeps readability while using much more of the available viewport.
    maxWidth: 1480,

    // Keep the main workspace centered inside the available area.
    margin: "0 auto",

    color: "#fff",
    background:
      "radial-gradient(900px 360px at 50% -120px, rgba(255,255,255,0.10), rgba(0,0,0,0))",

    // Ensures the centered container still expands naturally.
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
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

      <main
        style={{
          ...mainStyle,
          flex: 1,
          overflow: "auto",
          minWidth: 0, // Prevents flex overflow issues on narrower screens.
        }}
      >
        <ChatHeader
          sidebarCollapsed={chat.sidebarCollapsed}
          onToggleSidebarAction={() => chat.setSidebarCollapsed((v) => !v)}
          mode={chat.mode}
          onModeChangeAction={(mode) => {
            chat.setMode(mode);
            bumpUiTickAction();
          }}
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