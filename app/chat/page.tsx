// app/chat/page.tsx
// CHANGE (M8.1 Workflow Selector Wiring):
// - wires ChatHeader to the existing internal mode state
// - preserves internal modes: coach / cases / review
//
// CHANGE (M8.1 Layout Width Improvement):
// - relaxes the narrow centered container
// - allows Release Signal to use much more horizontal space
// - keeps a controlled max width for readability and UI stability
//
// CHANGE (M10 UI Pass):
// - adds resolved theme wiring for sidebar/header/toolbar/panel
// - supports light / dark / system theme
// - keeps existing chat/session behavior unchanged
//
// CHANGE (M10 Hydration Fix):
// - prevents theme mismatch during SSR/client hydration
// - keeps first render deterministic, then resolves system theme after mount
//
// CHANGE (M12 Step 7A):
// - treat mode switching as a view change on the active workspace/session
// - reload the same active session when mode changes
// - stop sidebar selection from forcing legacy per-session mode behavior

"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";

import { useChatSession } from "./hooks/useChatSession";

import SessionSidebar from "./components/SessionSidebar";
import ChatHeader from "./components/ChatHeader";
import ChatToolbar from "./components/ChatToolbar";
import ChatPanel from "./components/ChatPanel";

type ThemeMode = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ChatPage() {
  const chat = useChatSession();

  // Page-only: optional rerender tick (used to refresh layout-dependent UI state)
  const [, setUiTick] = useState(0);
  const bumpUiTickAction = () => setUiTick((v) => v + 1);

  /*
  ---------------------------------------------------------
  THEME STATE
  ---------------------------------------------------------
  */

  const [themeMode] = useState<ThemeMode>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyThemePreference = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    applyThemePreference();
    mediaQuery.addEventListener("change", applyThemePreference);

    return () => {
      mediaQuery.removeEventListener("change", applyThemePreference);
    };
  }, []);

  const resolvedTheme: "light" | "dark" =
    themeMode === "system" ? systemTheme : themeMode;

  const isDark = resolvedTheme === "dark";

  const handleWorkspaceSelectAction = (id: string) => {
    void (async () => {
      // M12 Step 7A:
      // Selecting an item from history should load the workspace/session
      // into the CURRENT mode view instead of restoring a legacy session-mode pair.
      await chat.selectSession(id, chat.mode);
      bumpUiTickAction();
    })();
  };

  const handleModeChangeAction = (mode: typeof chat.mode) => {
    // BUG FIX (M12 Strategy + History triage):
    // Manual tab switching must change only the visible workspace view.
    // Do NOT reload the active session here, because session restore logic
    // intentionally derives its effective mode from persisted history/artifact state.
    // Re-selecting the session would snap the UI back to the persisted mode
    // and prevent normal Strategy/Test Design/Test Review navigation.
    chat.setMode(mode);
    bumpUiTickAction();
  };

  if (!mounted) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          width: "100%",
          background: "#0f172a",
        }}
      />
    );
  }

  const mainStyle: React.CSSProperties = {
    padding: "20px 24px",
    maxWidth: 1480,
    margin: "0 auto",
    color: isDark ? "#ffffff" : "#0f172a",
    background: isDark
      ? "radial-gradient(900px 360px at 50% -120px, rgba(255,255,255,0.10), rgba(0,0,0,0))"
      : "radial-gradient(900px 360px at 50% -120px, rgba(0,0,0,0.05), rgba(255,255,255,0))",
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
        resolvedTheme={resolvedTheme}
        onNewChatAction={() => {
          chat.newChat();
          bumpUiTickAction();
        }}
        onSelectSessionAction={(id) => {
          handleWorkspaceSelectAction(id);
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
          minWidth: 0,
        }}
      >
        <ChatHeader
          sidebarCollapsed={chat.sidebarCollapsed}
          resolvedTheme={resolvedTheme}
          onToggleSidebarAction={() => chat.setSidebarCollapsed((v) => !v)}
          mode={chat.mode}
          onModeChangeAction={handleModeChangeAction}
        />

        <ChatToolbar
          chat={chat}
          resolvedTheme={resolvedTheme}
          onAfterUiAction={() => {
            bumpUiTickAction();
          }}
        />

        <ChatPanel
          chat={chat}
          resolvedTheme={resolvedTheme}
          onAfterSendAction={() => {
            bumpUiTickAction();
          }}
        />
      </main>
    </div>
  );
}