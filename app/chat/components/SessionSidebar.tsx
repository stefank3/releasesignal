// app/chat/components/SessionSidebar.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extract sidebar UI from page.tsx (no behavior change)

"use client";

import React from "react";
import type { Mode, SessionListItem } from "../chat.types";
import { ModeBadge } from "./ChatUI";

function sessionGlyph(title: string) {
  const t = (title || "New chat").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? "N").toUpperCase();
  const b = (parts[1]?.[0] ?? "").toUpperCase();
  return (a + b).slice(0, 2);
}

type Props = {
  sidebarWidth: number;
  sidebarCollapsed: boolean;

  sessions: SessionListItem[];
  sessionsCursor: string | null;
  sessionsLoading: boolean;
  activeSessionId: string | null;

  renamingId: string | null;
  renameValue: string;
  renameSaving: boolean;

  deletingId: string | null;
  deleteBusy: boolean;

  // Actions (name ends with Action to avoid Next TS warnings in some setups)
  onNewChatAction: () => void;
  onSelectSessionAction: (sessionId: string, sessionMode: Mode) => void;
  onLoadMoreSessionsAction: () => void;

  onStartRenameAction: (sessionId: string, currentTitle: string) => void;
  onRenameValueChangeAction: (value: string) => void;
  onSaveRenameAction: (sessionId: string, value: string) => void;
  onCancelRenameAction: () => void;

  onDeleteSessionAction: (sessionId: string) => void;
};

export default function SessionSidebar({
  sidebarWidth,
  sidebarCollapsed,

  sessions,
  sessionsCursor,
  sessionsLoading,
  activeSessionId,

  renamingId,
  renameValue,
  renameSaving,

  deletingId,
  deleteBusy,

  onNewChatAction,
  onSelectSessionAction,
  onLoadMoreSessionsAction,

  onStartRenameAction,
  onRenameValueChangeAction,
  onSaveRenameAction,
  onCancelRenameAction,

  onDeleteSessionAction,
}: Props) {
  return (
    <aside
      style={{
        width: sidebarWidth,
        transition: "width 180ms ease",
        borderRight: "1px solid rgba(255,255,255,0.12)",
        padding: sidebarCollapsed ? 10 : 14,
        background: "rgba(0,0,0,0.35)",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        {!sidebarCollapsed ? <div style={{ color: "#fff", fontWeight: 900 }}>History</div> : <div />}

        <button
          onClick={onNewChatAction}
          title="New chat"
          style={{
            padding: sidebarCollapsed ? "8px 10px" : "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 950,
            cursor: "pointer",
            width: sidebarCollapsed ? 44 : "auto",
          }}
        >
          {sidebarCollapsed ? "＋" : "New"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sessions.map((s) => {
          const active = s.id === activeSessionId;

          const title = s.title ?? "New chat";
          const preview = s.lastMessage?.role === "user" ? s.lastMessage.content.slice(0, 80) : "Open to view";

          const effectiveMode = (s.effectiveMode ?? s.mode) as Mode;

          if (sidebarCollapsed) {
            return (
              <button
                key={s.id}
                onClick={() => onSelectSessionAction(s.id, effectiveMode)}
                title={`${title} • ${effectiveMode.toUpperCase()}`}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: active ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(255,255,255,0.18)",
                  background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  cursor: "pointer",
                  padding: 10,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.08)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 950,
                    letterSpacing: 0.4,
                    fontSize: 12,
                  }}
                >
                  {sessionGlyph(title)}
                </div>
              </button>
            );
          }

          return (
            <div
              key={s.id}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => onSelectSessionAction(s.id, effectiveMode)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 10,
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                }}
                title={s.id}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 220,
                    }}
                  >
                    {title}
                  </div>

                  <ModeBadge mode={effectiveMode} compact />
                </div>

                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6, lineHeight: 1.35 }}>{preview}</div>
              </button>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 10px",
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {renamingId === s.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => onRenameValueChangeAction(e.target.value)}
                      placeholder="New title…"
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(255,255,255,0.08)",
                        color: "#fff",
                        outline: "none",
                        fontSize: 12,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSaveRenameAction(s.id, renameValue);
                        if (e.key === "Escape") onCancelRenameAction();
                      }}
                    />

                    <button
                      onClick={() => onSaveRenameAction(s.id, renameValue)}
                      disabled={renameSaving}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(255,255,255,0.14)",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: renameSaving ? "not-allowed" : "pointer",
                        opacity: renameSaving ? 0.6 : 1,
                        fontSize: 12,
                      }}
                    >
                      {renameSaving ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartRenameAction(s.id, s.title ?? "New chat");
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Rename
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSessionAction(s.id);
                      }}
                      disabled={deleteBusy}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: deleteBusy ? "not-allowed" : "pointer",
                        opacity: deleteBusy ? 0.6 : 1,
                        fontSize: 12,
                      }}
                      title="Delete session"
                    >
                      {deletingId === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {sessions.length === 0 && !sidebarCollapsed && (
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.45 }}>
            No sessions yet. Send your first message to create one.
          </div>
        )}

        {sessionsCursor && (
          <button
            onClick={onLoadMoreSessionsAction}
            disabled={sessionsLoading}
            title="Load more sessions"
            style={{
              padding: sidebarCollapsed ? "10px 10px" : "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontWeight: 950,
              cursor: sessionsLoading ? "not-allowed" : "pointer",
              opacity: sessionsLoading ? 0.6 : 1,
              width: sidebarCollapsed ? "100%" : "auto",
            }}
          >
            {sessionsLoading ? (sidebarCollapsed ? "…" : "Loading…") : sidebarCollapsed ? "↓" : "Load more"}
          </button>
        )}
      </div>
    </aside>
  );
}