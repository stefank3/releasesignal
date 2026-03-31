// app/chat/components/SessionSidebar.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extract sidebar UI from page.tsx (no behavior change)
//
// CHANGE (M7.5 UX Polish):
// - tighter session card density
// - lighter action row
// - more compact pinned badge/timestamp layout
// - better visual rhythm with ChatPanel + StrategyPanel
//
// CHANGE (M9):
// - sidebar is now ready to surface persistent test-suite metadata
// - keeps backward compatibility if history API does not yet return suite fields
// - adds a compact suite badge when available
//
// CHANGE (M10 UI Pass):
// - add theme-aware sidebar rendering
// - remove dark-only styling assumptions
// - fix washed-out / shadowed appearance in light mode
//
// CHANGE (M12 Strategy + History triage):
// - render sidebar entries as workspace cards, not stage-specific cards
// - stage is now informational only
// - avoid implying separate Strategy/Test Design/Test Review sessions

"use client";

import React from "react";
import type { Mode, SessionListItem } from "../chat.types";

function sessionGlyph(title: string) {
  const t = (title || "New chat").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? "N").toUpperCase();
  const b = (parts[1]?.[0] ?? "").toUpperCase();
  return (a + b).slice(0, 2);
}

function getStageLabel(mode: Mode): string {
  if (mode === "review") return "Current stage: Test Review";
  if (mode === "cases") return "Current stage: Test Design";
  return "Current stage: Strategy";
}

function PinnedBadge({
  updatedAt,
  resolvedTheme = "dark",
}: {
  updatedAt?: string | null;
  resolvedTheme?: "light" | "dark";
}) {
  const ts =
    typeof updatedAt === "string" && updatedAt
      ? new Date(updatedAt).toLocaleString()
      : null;

  const isDark = resolvedTheme === "dark";

  return (
    <span
      title={ts ? `Pinned requirement updated: ${ts}` : "Pinned requirement exists"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.16)"
          : "1px solid rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#fff" : "#0f172a",
        fontSize: 10,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">📌</span>
      Pinned
    </span>
  );
}

/**
 * M9 CHANGE:
 * Future-safe suite badge support.
 * This component stays backward-compatible even before SessionListItem is formally extended.
 */
function getSuiteMeta(
  session: SessionListItem
): { hasSuite: boolean; version: number | null; totalCases: number | null } {
  const raw = session as unknown as Record<string, unknown>;

  const hasSuite = raw["hasPersistentTestSuite"] === true;
  const version =
    typeof raw["testSuiteVersion"] === "number"
      ? (raw["testSuiteVersion"] as number)
      : null;
  const totalCases =
    typeof raw["testSuiteCount"] === "number"
      ? (raw["testSuiteCount"] as number)
      : null;

  return { hasSuite, version, totalCases };
}

function SuiteBadge({
  version,
  totalCases,
  resolvedTheme = "dark",
}: {
  version?: number | null;
  totalCases?: number | null;
  resolvedTheme?: "light" | "dark";
}) {
  const title =
    typeof version === "number" || typeof totalCases === "number"
      ? `Persistent test suite${typeof version === "number" ? ` v${version}` : ""}${
          typeof totalCases === "number" ? ` • ${totalCases} cases` : ""
        }`
      : "Persistent test suite exists";

  const isDark = resolvedTheme === "dark";

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.16)"
          : "1px solid rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#fff" : "#0f172a",
        fontSize: 10,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true">🧪</span>
      {typeof version === "number" ? `Suite v${version}` : "Suite"}
      {typeof totalCases === "number" ? ` · ${totalCases}` : ""}
    </span>
  );
}

function WorkspaceBadge({
  resolvedTheme = "dark",
}: {
  resolvedTheme?: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.16)"
          : "1px solid rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#fff" : "#0f172a",
        fontSize: 10,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
      title="Shared QA workspace session"
    >
      Workspace
    </span>
  );
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

  onNewChatAction: () => void;
  onSelectSessionAction: (sessionId: string, sessionMode: Mode) => void;
  onLoadMoreSessionsAction: () => void;

  onStartRenameAction: (sessionId: string, currentTitle: string) => void;
  onRenameValueChangeAction: (value: string) => void;
  onSaveRenameAction: (sessionId: string, value: string) => void;
  onCancelRenameAction: () => void;

  onDeleteSessionAction: (sessionId: string) => void;
  resolvedTheme?: "light" | "dark";
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
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  const sidebarText = isDark ? "#fff" : "#0f172a";
  const subtleText = isDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.68)";

  return (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        transition: "width 180ms ease",
        borderRight: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        padding: sidebarCollapsed ? 10 : 12,
        background: isDark ? "rgba(0,0,0,0.35)" : "rgba(15,23,42,0.04)",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        {!sidebarCollapsed ? (
          <div style={{ color: sidebarText, fontWeight: 900, fontSize: 14 }}>
            Workspaces
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={onNewChatAction}
          title="New chat"
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: isDark
              ? "1px solid rgba(255,255,255,0.20)"
              : "1px solid rgba(15,23,42,0.16)",
            background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
            color: sidebarText,
            fontWeight: 950,
            cursor: "pointer",
            width: sidebarCollapsed ? 44 : "auto",
            boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
          }}
        >
          {sidebarCollapsed ? "＋" : "New"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {sessions.map((s) => {
          const active = s.id === activeSessionId;
          const title = s.title ?? "New chat";
          const preview =
            s.lastMessage?.role === "user"
              ? s.lastMessage.content.slice(0, 80)
              : "Open workspace";
          const effectiveMode = (s.effectiveMode ?? s.mode) as Mode;
          const hasPinned = !!s.hasPinnedRequirement;

          const suiteMeta = getSuiteMeta(s);
          const hasSuite = suiteMeta.hasSuite;

          if (sidebarCollapsed) {
            return (
              <button
                key={s.id}
                onClick={() => onSelectSessionAction(s.id, effectiveMode)}
                title={`${title}${hasPinned ? " • PINNED" : ""}${hasSuite ? " • SUITE" : ""}`}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: active
                    ? isDark
                      ? "1px solid rgba(255,255,255,0.28)"
                      : "1px solid rgba(15,23,42,0.20)"
                    : isDark
                      ? "1px solid rgba(255,255,255,0.14)"
                      : "1px solid rgba(15,23,42,0.10)",
                  background: active
                    ? isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(15,23,42,0.08)"
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.72)",
                  color: sidebarText,
                  cursor: "pointer",
                  padding: 9,
                  display: "grid",
                  placeItems: "center",
                  boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.04)",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 13,
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.16)"
                      : "1px solid rgba(15,23,42,0.12)",
                    background: isDark
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(15,23,42,0.04)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 950,
                    letterSpacing: 0.4,
                    fontSize: 12,
                  }}
                >
                  {sessionGlyph(title)}
                </div>

                <div
                  style={{
                    marginTop: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    opacity: 0.85,
                  }}
                >
                  {hasPinned ? <span title="Pinned requirement">📌</span> : null}
                  {hasSuite ? <span title="Persistent test suite">🧪</span> : null}
                </div>
              </button>
            );
          }

          return (
            <div
              key={s.id}
              style={{
                borderRadius: 12,
                border: active
                  ? isDark
                    ? "1px solid rgba(255,255,255,0.22)"
                    : "1px solid rgba(15,23,42,0.16)"
                  : isDark
                    ? "1px solid rgba(255,255,255,0.14)"
                    : "1px solid rgba(15,23,42,0.10)",
                background: active
                  ? isDark
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(15,23,42,0.07)"
                  : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.78)",
                overflow: "hidden",
                boxShadow: isDark ? "none" : "0 6px 14px rgba(15,23,42,0.04)",
              }}
            >
              <button
                onClick={() => onSelectSessionAction(s.id, effectiveMode)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px 9px",
                  border: "none",
                  background: "transparent",
                  color: sidebarText,
                  cursor: "pointer",
                }}
                title={s.id}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 210,
                    }}
                  >
                    {title}
                  </div>

                  <WorkspaceBadge resolvedTheme={resolvedTheme} />
                </div>

                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.68,
                    marginTop: 5,
                    lineHeight: 1.35,
                    color: sidebarText,
                  }}
                >
                  {getStageLabel(effectiveMode)}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.72,
                    marginTop: 5,
                    lineHeight: 1.3,
                    minHeight: 28,
                    color: sidebarText,
                  }}
                >
                  {preview}
                </div>

                {hasPinned || hasSuite ? (
                  <div
                    style={{
                      marginTop: 7,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {hasPinned ? (
                      <PinnedBadge
                        updatedAt={s.artifactUpdatedAt ?? null}
                        resolvedTheme={resolvedTheme}
                      />
                    ) : null}

                    {hasSuite ? (
                      <SuiteBadge
                        version={suiteMeta.version}
                        totalCases={suiteMeta.totalCases}
                        resolvedTheme={resolvedTheme}
                      />
                    ) : null}

                    {s.artifactUpdatedAt ? (
                      <span style={{ fontSize: 10, opacity: 0.68, color: sidebarText }}>
                        {new Date(s.artifactUpdatedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </button>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "7px 10px",
                  borderTop: isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(15,23,42,0.08)",
                  alignItems: "center",
                  flexWrap: "wrap",
                  background: isDark ? "rgba(0,0,0,0.10)" : "rgba(15,23,42,0.03)",
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
                        minWidth: 120,
                        padding: "6px 8px",
                        borderRadius: 10,
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid rgba(15,23,42,0.16)",
                        background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
                        color: sidebarText,
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
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.20)"
                          : "1px solid rgba(15,23,42,0.16)",
                        background: isDark ? "rgba(255,255,255,0.12)" : "#fff",
                        color: sidebarText,
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
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid rgba(15,23,42,0.14)",
                        background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                        color: sidebarText,
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
                        border: isDark
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid rgba(15,23,42,0.14)",
                        background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                        color: sidebarText,
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
          <div style={{ color: subtleText, fontSize: 12, lineHeight: 1.45 }}>
            No workspaces yet. Send your first message to create one.
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
              border: isDark
                ? "1px solid rgba(255,255,255,0.16)"
                : "1px solid rgba(15,23,42,0.14)",
              background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
              color: sidebarText,
              fontWeight: 950,
              cursor: sessionsLoading ? "not-allowed" : "pointer",
              opacity: sessionsLoading ? 0.6 : 1,
              width: sidebarCollapsed ? "100%" : "auto",
            }}
          >
            {sessionsLoading
              ? sidebarCollapsed
                ? "…"
                : "Loading…"
              : sidebarCollapsed
                ? "↓"
                : "Load more"}
          </button>
        )}
      </div>
    </aside>
  );
}