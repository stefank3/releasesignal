// app/chat/hooks/useChatSession.ts
// M7 Phase 2 (Structural Refactor)
// CHANGE: Extract state + orchestration out of page.tsx into a reusable hook.
// GOAL: page.tsx becomes mostly UI composition.
//
// ✅ FIXES INCLUDED (surgical):
// 1) FIX: Expose `lastPending` in UseChatSessionReturn + return value (unblocks Retry button in page.tsx)
// 2) FIX: Remove `React.*` namespace types (was not imported) -> use `Dispatch/SetStateAction/MutableRefObject` types
// 3) IMPROVE: Type-narrow coach suggestions without `any` when possible (still safe if ChatItem union doesn't include suggestions)
//
// CHANGE (M7.7):
// 4) ADD: sessionArtifact + artifactUpdatedAt in state + return type
// 5) ADD: hydrate artifact from /api/chat response + /api/chat/history/:sessionId response
// 6) ADD: reset artifact on newChat / startNewSessionInMode
//
// CHANGE (M8.6 Continuity Groundwork):
// 7) ALIGN: visible workflow labels now use Strategy / Test Design / Test Review
// 8) ADD: derived flags for strategy/design continuity-aware UI behavior
// 9) KEEP: no backend contract change here; actual advisor continuity will be implemented in /api/chat/route.ts
//
// CHANGE (M9):
// 10) ADD: derived flag for persisted test suite presence
// 11) KEEP: artifact hydration logic unchanged; expanded SessionArtifact now carries testSuite automatically
// 12) ADD: graceful client-side oversized-input handling before hitting /api/chat

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  Mode,
  ReviewResult,
  CasesResult,
  ChatItem,
  PersistedState,
  RateMeta,
  ChatApiResponse,
  SessionListItem,
  HistoryMessage,
  CoachSuggestions,
  SessionArtifact,
} from "../chat.types";

const STORAGE_KEY = "stefans-mvp-chat-v1";
const SIDEBAR_KEY = "stefans-mvp-sidebar-collapsed-v1";

// M9 CHANGE: match backend hard limit so we can fail gracefully in the client first.
const MAX_MESSAGE_CHARS = 8000;

/** Determine if user is already near the bottom of the chat window. */
export function isNearBottom(el: HTMLDivElement, thresholdPx = 140) {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance <= thresholdPx;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readArtifactFromResponse(
  data: unknown
): { artifact: SessionArtifact | null; artifactUpdatedAt: string | null } | null {
  if (!isRecord(data)) return null;

  // Only hydrate when the server actually included these fields.
  const hasArtifactField = "artifact" in data || "artifactUpdatedAt" in data;
  if (!hasArtifactField) return null;

  const artifact = (data["artifact"] ?? null) as SessionArtifact | null;
  const artifactUpdatedAt =
    typeof data["artifactUpdatedAt"] === "string" ? data["artifactUpdatedAt"] : null;

  return { artifact, artifactUpdatedAt };
}

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

/** Generate a client-side request id for correlation. */
function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** IDP: generate a stable client-side id for new-session creation. */
function createSessionClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * M9 CHANGE:
 * Graceful UX for oversized single-pass requests.
 * This is especially helpful for Review mode and very large pasted suites.
 */
function buildOversizedInputMessage(args: { mode: Mode; actualLength: number }): string {
  const overBy = Math.max(0, args.actualLength - MAX_MESSAGE_CHARS);

  if (args.mode === "review") {
    return [
      `This review input is too large for a single pass right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
      "",
      "Try one of these:",
      "- review a smaller section of the suite",
      "- split the suite into parts",
      "- review the highest-risk area first",
      "",
      `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
      "",
      "Large-suite review will be expanded in a later milestone.",
    ].join("\n");
  }

  if (args.mode === "cases") {
    return [
      `This test-design input is too large for a single request right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
      "",
      "Try one of these:",
      "- generate tests from a smaller requirement section",
      "- paste only the core scope and constraints",
      "- extend the suite incrementally in follow-up prompts",
      "",
      `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
    ].join("\n");
  }

  return [
    `This Strategy input is too large for a single request right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
    "",
    "Try one of these:",
    "- shorten the description to the essential scope",
    "- split the requirement into smaller parts",
    "- start with the core workflow first",
    "",
    `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
  ].join("\n");
}

/**
 * Fetch helper:
 * - throws on non-JSON responses
 * - returns { status, headers, data } always
 */
async function fetchJSONWithMeta<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ status: number; headers: Headers; data: T }> {
  const res = await fetch(input, init);

  const text = await res.text().catch(() => "");
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  const first = text
    .trimStart()
    .slice(0, 200)
    .replace(/\s+/g, " ");
  const looksHtml =
    ct.includes("text/html") ||
    first.startsWith("<!doctype") ||
    first.startsWith("<html") ||
    first.startsWith("<");

  const looksJson = ct.includes("application/json") || first.startsWith("{") || first.startsWith("[");

  if (!looksJson) {
    const hint = looksHtml
      ? "Expected JSON but got HTML (redirect/login/error page)"
      : "Expected JSON but got non-JSON";
    throw new Error(`${hint} (HTTP ${res.status}). content-type=${ct || "(none)"} first=${first}`);
  }

  const data = text ? (JSON.parse(text) as unknown) : ({} as unknown);
  return { status: res.status, headers: res.headers, data: data as T };
}

/** Wrapper that throws on non-2xx. */
async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const { status, data } = await fetchJSONWithMeta<T>(input, init);
  if (status >= 200 && status < 300) return data;
  const err = (data as { error?: string })?.error;
  throw new Error(err || `HTTP ${status}`);
}

/** Parse ReviewResult JSON in assistant messages. */
function tryParseReview(text: string): ReviewResult | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj.score === "number" &&
      obj.breakdown &&
      typeof obj.breakdown.businessRelevance === "number" &&
      Array.isArray(obj.riskGaps) &&
      Array.isArray(obj.antiPatterns) &&
      Array.isArray(obj.improvements)
    ) {
      return obj as ReviewResult;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Legacy-only: old history might contain JSON CasesResult. */
function tryParseCasesLegacy(text: string): CasesResult | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj.suiteTitle === "string" &&
      Array.isArray(obj.assumptions) &&
      Array.isArray(obj.testCases)
    ) {
      return obj as CasesResult;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * ✅ Heuristic:
 * Some older sessions might have mode stored as coach/review, but the assistant content is clearly cases plain text.
 */
function looksLikeCasesPlainText(text: string): boolean {
  const t = String(text ?? "").replace(/\r/g, "");

  const tcCount = (t.match(/^TC-\d{1,4}\b.*$/gim) || []).length;
  const hasMarkers =
    /(^|\n)\s*Preconditions\s*:/i.test(t) ||
    /(^|\n)\s*Test Steps\s*:/i.test(t) ||
    /(^|\n)\s*Steps\s*:/i.test(t) ||
    /(^|\n)\s*Expected Result(s)?\s*:/i.test(t) ||
    /(^|\n)\s*Priority\s*:/i.test(t) ||
    /(^|\n)\s*Type\s*:/i.test(t);

  if (tcCount >= 1 && hasMarkers) return true;
  if (tcCount >= 2) return true;
  return false;
}

/** Optional: make coach JSON readable if needed (keeps your existing behavior). */
function looksLikeJson(s: string) {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

export function tryFormatCoachJson(text: string): string | null {
  try {
    const obj = JSON.parse(text) as {
      assumptions?: string[];
      riskMatrix?: { risk?: string; likelihood?: string; impact?: string }[];
      highSignalApproach?: { testIdeas?: string[] };
      testCases?: { id?: string; title?: string; priority?: string; level?: string }[];
      optionalClarifications?: string[];
    };

    const lines: string[] = [];

    if (Array.isArray(obj.assumptions) && obj.assumptions.length) {
      lines.push("Assumptions:");
      for (const a of obj.assumptions.slice(0, 6)) lines.push(`- ${mdSafe(a)}`);
      lines.push("");
    }

    if (Array.isArray(obj.riskMatrix) && obj.riskMatrix.length) {
      lines.push("Top risks:");
      for (const r of obj.riskMatrix.slice(0, 5)) {
        const risk = mdSafe(r.risk ?? "Risk");
        const li = mdSafe(r.likelihood ?? "");
        const im = mdSafe(r.impact ?? "");
        lines.push(`- ${risk}${li || im ? ` (${li}/${im})` : ""}`);
      }
      lines.push("");
    }

    if (Array.isArray(obj.testCases) && obj.testCases.length) {
      lines.push("Draft test cases:");
      for (const tc of obj.testCases.slice(0, 12)) {
        const id = mdSafe(tc.id ?? "");
        const title = mdSafe(tc.title ?? "");
        const meta = [tc.priority, tc.level].filter(Boolean).join(" · ");
        lines.push(
          `- ${id ? `${id} ` : ""}${title}${meta ? ` (${meta})` : ""}`.trim()
        );
      }
      lines.push("");
    } else if (
      Array.isArray(obj.highSignalApproach?.testIdeas) &&
      obj.highSignalApproach.testIdeas?.length
    ) {
      lines.push("Draft test ideas:");
      for (const t of obj.highSignalApproach.testIdeas.slice(0, 12)) {
        lines.push(`- ${mdSafe(t)}`);
      }
      lines.push("");
    }

    if (Array.isArray(obj.optionalClarifications) && obj.optionalClarifications.length) {
      lines.push("Optional clarifications:");
      for (const q of obj.optionalClarifications.slice(0, 3)) {
        lines.push(`- ${mdSafe(q)}`);
      }
      lines.push("");
    }

    return lines.length ? lines.join("\n").trim() : null;
  } catch {
    return null;
  }
}

function modeLabel(m: Mode) {
  return m === "coach" ? "Strategy" : m === "review" ? "Test Review" : "Test Design";
}

/** Track the last request payload needed to “Retry” safely. */
export type LastPending = {
  requestId: string;
  text: string;
  mode: Mode;
  sessionId: string | null;
  sessionClientId: string | null;
};

export type UseChatSessionReturn = {
  // state
  mode: Mode;
  setMode: (m: Mode) => void;

  input: string;
  setInput: (v: string) => void;

  items: ChatItem[];
  setItems: Dispatch<SetStateAction<ChatItem[]>>;

  isSending: boolean;

  rateLimitMsg: string | null;
  rate: RateMeta | null;
  lastRequestId: string | null;

  modeLockMsg: { sessionMode: Mode; requestedMode: Mode } | null;

  lastPending: LastPending | null;

  sessions: SessionListItem[];
  sessionsCursor: string | null;
  sessionsLoading: boolean;

  activeSessionId: string | null;
  activeSessionMode: Mode;

  pendingSessionClientId: string | null;

  messagesCursor: string | null;
  messagesLoading: boolean;

  renamingId: string | null;
  setRenamingId: (v: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renameSaving: boolean;

  deletingId: string | null;
  deleteBusy: boolean;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;

  // M7.7: session artifact
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAt: string | null;

  // M8.6: derived continuity/workflow flags
  isStrategySession: boolean;
  isTestDesignSession: boolean;
  isTestReviewSession: boolean;
  hasPinnedRequirement: boolean;

  // M9 CHANGE: derived persistent suite flag
  hasPersistentTestSuite: boolean;

  // derived
  latestCoachSuggestions: CoachSuggestions | null;
  modeLabel: (m: Mode) => string;

  // actions
  loadSessions: (reset: boolean) => Promise<void>;
  loadSessionMessages: (sessionId: string, reset: boolean, sessionMode: Mode) => Promise<void>;
  selectSession: (sessionId: string, sessionMode: Mode) => Promise<void>;

  newChat: () => void;
  startNewSessionInMode: (m: Mode) => void;
  trySetMode: (next: Mode) => void;

  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  send: (opts?: { replay?: boolean }) => Promise<void>;

  // scroll helper flag (so page can keep its scroll logic)
  shouldAutoScrollRef: MutableRefObject<boolean>;
};

export function useChatSession(): UseChatSessionReturn {
  const [mode, setMode] = useState<Mode>("coach");
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [rate, setRate] = useState<RateMeta | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const [modeLockMsg, setModeLockMsg] = useState<{
    sessionMode: Mode;
    requestedMode: Mode;
  } | null>(null);

  const [lastPending, setLastPending] = useState<LastPending | null>(null);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsCursor, setSessionsCursor] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionMode, setActiveSessionMode] = useState<Mode>("coach");

  const [pendingSessionClientId, setPendingSessionClientId] = useState<string | null>(null);

  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameSaving, setRenameSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Scroll preference should remain stable even if UI re-renders.
  const shouldAutoScrollRef = useRef(true);

  // Hydration-safe.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const sidebarWidth = sidebarCollapsed ? 72 : 320;

  // M7.7: artifact state
  const [sessionArtifact, setSessionArtifact] = useState<SessionArtifact | null>(null);
  const [artifactUpdatedAt, setArtifactUpdatedAt] = useState<string | null>(null);

  // Load sidebar collapse state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_KEY);
      setSidebarCollapsed(raw === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // Load persisted chat (mode/items/input).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed?.mode) setMode(parsed.mode);
      if (Array.isArray(parsed.items)) setItems(parsed.items);
      if (typeof parsed.input === "string") setInput(parsed.input);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedState = { mode, items, input };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [mode, items, input]);

  useEffect(() => {
    if (!rateLimitMsg) return;
    const t = setTimeout(() => setRateLimitMsg(null), 4000);
    return () => clearTimeout(t);
  }, [rateLimitMsg]);

  useEffect(() => {
    if (!modeLockMsg) return;
    const t = setTimeout(() => setModeLockMsg(null), 6000);
    return () => clearTimeout(t);
  }, [modeLockMsg]);

  const loadSessions = async (reset: boolean) => {
    if (sessionsLoading) return;

    setSessionsLoading(true);
    try {
      const url = new URL("/api/chat/history", window.location.origin);
      url.searchParams.set("limit", "25");
      if (!reset && sessionsCursor) url.searchParams.set("cursor", sessionsCursor);

      const data = await fetchJSON<{ items: SessionListItem[]; nextCursor: string | null }>(
        url.toString()
      );

      setSessions((prev) => (reset ? data.items : [...prev, ...data.items]));
      setSessionsCursor(data.nextCursor);
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessionMessages = async (sessionId: string, reset: boolean, sessionMode: Mode) => {
    if (messagesLoading) return;

    setMessagesLoading(true);
    try {
      const url = new URL(`/api/chat/history/${sessionId}`, window.location.origin);
      url.searchParams.set("limit", "120");
      if (!reset && messagesCursor) url.searchParams.set("cursor", messagesCursor);

      const data = await fetchJSON<{
        items: HistoryMessage[];
        nextCursor: string | null;
        hasMore?: boolean;
        sessionMode?: Mode;
        effectiveMode?: Mode;

        // M7.7: artifact hydration from history GET
        artifact?: SessionArtifact | null;
        artifactUpdatedAt?: string | null;
      }>(url.toString());

      // M7.7 / M9:
      // hydrate artifact on reset (select session).
      if (reset) {
        setSessionArtifact(data.artifact ?? null);
        setArtifactUpdatedAt(data.artifactUpdatedAt ?? null);
      }

      if (reset) {
        const serverMode = data.effectiveMode ?? data.sessionMode;
        if (serverMode && serverMode !== activeSessionMode) {
          setActiveSessionMode(serverMode);
          setMode(serverMode);
          sessionMode = serverMode;
        }
      }

      // Upgrade mis-labeled sessions to cases if content strongly suggests it.
      let effectiveSessionMode: Mode = sessionMode;
      if (sessionMode !== "cases") {
        const assistantMsgs = data.items
          .filter((m) => m.role === "assistant")
          .map((m) => m.content);

        const anyReviewJson = assistantMsgs.some((t) => !!tryParseReview(t));
        const anyLegacyCasesJson = assistantMsgs.some((t) => !!tryParseCasesLegacy(t));
        const anyCasesText = assistantMsgs.some((t) => !!looksLikeCasesPlainText(t));

        if (!anyReviewJson && (anyLegacyCasesJson || anyCasesText)) {
          effectiveSessionMode = "cases";
        }
      }

      const mapped: ChatItem[] = data.items
        .filter((m) => m.role !== "system")
        .map((m) => {
          const isUser = m.role === "user";
          if (isUser) return { kind: "text", role: "user", text: m.content };

          if (effectiveSessionMode === "cases") {
            const maybeCasesLegacy = tryParseCasesLegacy(m.content);
            if (maybeCasesLegacy) {
              return { kind: "casesLegacy", role: "bot", cases: maybeCasesLegacy };
            }
            return { kind: "casesText", role: "bot", text: m.content };
          }

          const maybeReview = tryParseReview(m.content);
          if (maybeReview) return { kind: "review", role: "bot", review: maybeReview };

          return { kind: "text", role: "bot", text: m.content };
        });

      setItems((prev) => (reset ? mapped : [...mapped, ...prev]));
      setMessagesCursor(data.nextCursor);
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const selectSession = async (sessionId: string, sessionMode: Mode) => {
    setModeLockMsg(null);

    setActiveSessionId(sessionId);
    setActiveSessionMode(sessionMode);
    setMode(sessionMode);

    setPendingSessionClientId(null);
    setMessagesCursor(null);

    setItems([]);
    setInput("");

    setRate(null);
    setRateLimitMsg(null);
    setLastRequestId(null);

    setLastPending(null);

    // M7.7 / M9: artifact will be hydrated by loadSessionMessages(reset=true).
    setSessionArtifact(null);
    setArtifactUpdatedAt(null);

    await loadSessionMessages(sessionId, true, sessionMode);
  };

  const newChat = () => {
    setModeLockMsg(null);

    setActiveSessionId(null);
    setActiveSessionMode(mode);
    setPendingSessionClientId(createSessionClientId());
    setMessagesCursor(null);

    setItems([]);
    setInput("");

    setRate(null);
    setRateLimitMsg(null);
    setLastRequestId(null);

    setRenamingId(null);
    setRenameValue("");

    setLastPending(null);

    // M7.7 / M9: new chat has no artifact until the server returns one.
    setSessionArtifact(null);
    setArtifactUpdatedAt(null);

    shouldAutoScrollRef.current = true;
  };

  const startNewSessionInMode = (m: Mode) => {
    setModeLockMsg(null);

    setMode(m);
    setActiveSessionMode(m);
    setActiveSessionId(null);
    setPendingSessionClientId(createSessionClientId());

    setItems([]);
    setInput("");
    setMessagesCursor(null);

    setRate(null);
    setRateLimitMsg(null);
    setLastRequestId(null);
    setLastPending(null);

    // M7.7 / M9
    setSessionArtifact(null);
    setArtifactUpdatedAt(null);

    shouldAutoScrollRef.current = true;
  };

  const trySetMode = (next: Mode) => {
    if (activeSessionId && next !== activeSessionMode) {
      setModeLockMsg({ sessionMode: activeSessionMode, requestedMode: next });
      return;
    }
    setMode(next);
    if (!activeSessionId) setActiveSessionMode(next);
  };

  const renameSession = async (sessionId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle.length > 80) return;

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: nextTitle } : s))
    );

    try {
      setRenameSaving(true);
      await fetchJSON(`/api/chat/history/${sessionId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
    } catch (err) {
      console.error("Rename failed", err);
      await loadSessions(true);
    } finally {
      setRenameSaving(false);
      setRenamingId(null);
    }
  };

  const deleteSession = async (sessionId: string) => {
    const ok = window.confirm("Delete this session? This cannot be undone.");
    if (!ok) return;

    setDeleteBusy(true);
    setDeletingId(sessionId);

    try {
      await fetchJSON(`/api/chat/history/${sessionId}`, { method: "DELETE" });

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setItems([]);
        setInput("");
        setMessagesCursor(null);
        setRate(null);
        setRateLimitMsg(null);
        setLastRequestId(null);
        setLastPending(null);

        // M7.7 / M9
        setSessionArtifact(null);
        setArtifactUpdatedAt(null);
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      await loadSessions(true);
    } catch (err) {
      console.error("Delete failed", err);
      await loadSessions(true);
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  };

  const send = async (opts?: { replay?: boolean }) => {
    const replay = opts?.replay ?? false;

    const text = replay ? lastPending?.text ?? "" : input.trim();
    if (!text || isSending) return;

    const requestId = replay ? lastPending?.requestId ?? "" : createRequestId();
    if (!requestId) return;

    const effectiveMode = replay ? lastPending?.mode ?? mode : mode;

    // M9 CHANGE: graceful client-side oversized-input handling.
    // We stop before creating a server error and explain how to proceed.
    if (text.length > MAX_MESSAGE_CHARS) {
      setLastRequestId(requestId);
      setItems((prev) => [
        ...prev,
        {
          kind: "error",
          role: "bot",
          title: "Input too large for a single request",
          details: buildOversizedInputMessage({
            mode: effectiveMode,
            actualLength: text.length,
          }),
          requestId,
        },
      ]);
      return;
    }

    const sessionIdForRequest = replay
      ? lastPending?.sessionId ?? activeSessionId
      : activeSessionId;

    if (sessionIdForRequest && effectiveMode !== activeSessionMode) {
      setModeLockMsg({ sessionMode: activeSessionMode, requestedMode: effectiveMode });
      return;
    }

    const sessionClientIdForRequest =
      sessionIdForRequest
        ? null
        : (replay ? lastPending?.sessionClientId : pendingSessionClientId) ??
          createSessionClientId();

    if (!sessionIdForRequest && !pendingSessionClientId && !replay) {
      setPendingSessionClientId(sessionClientIdForRequest);
    }

    if (
      !sessionIdForRequest &&
      replay &&
      !pendingSessionClientId &&
      lastPending?.sessionClientId
    ) {
      setPendingSessionClientId(lastPending.sessionClientId);
    }

    if (!replay) {
      setItems((prev) => [...prev, { kind: "text", role: "user", text, requestId }]);
      setInput("");
      shouldAutoScrollRef.current = true;
    }

    setIsSending(true);

    // ✅ this is what Retry reuses.
    setLastPending({
      requestId,
      text,
      mode: effectiveMode,
      sessionId: sessionIdForRequest ?? null,
      sessionClientId: sessionClientIdForRequest,
    });

    try {
      const { status, headers, data } = await fetchJSONWithMeta<ChatApiResponse>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-request-id": requestId },
        body: JSON.stringify({
          message: text,
          mode: effectiveMode,
          sessionId: sessionIdForRequest ?? undefined,
          sessionClientId: sessionClientIdForRequest ?? undefined,
        }),
      });

      const serverRequestId = headers.get("x-request-id") || requestId;
      setLastRequestId(serverRequestId);

      if (data?.rate) setRate(data.rate);

      // M7.7 / M9:
      // hydrate artifact from /api/chat response (success or replay).
      // Expanded SessionArtifact now carries refinedRequirement + optional testSuite.
      const artifactPayload = readArtifactFromResponse(data);
      if (artifactPayload) {
        setSessionArtifact(artifactPayload.artifact);
        setArtifactUpdatedAt(artifactPayload.artifactUpdatedAt);
      }

      if (
        status === 409 &&
        data?.error === "SESSION_MODE_MISMATCH" &&
        data.sessionMode &&
        data.requestedMode
      ) {
        setModeLockMsg({
          sessionMode: data.sessionMode,
          requestedMode: data.requestedMode,
        });
        setItems((prev) => [
          ...prev,
          {
            kind: "error",
            role: "bot",
            title: "Session mode mismatch",
            details: `This session is locked to "${data.sessionMode}". Start a new session to use "${data.requestedMode}".`,
            requestId: serverRequestId,
          },
        ]);
        return;
      }
      if (status === 429) {
        setRateLimitMsg(
          `${data?.details ?? "Rate limit reached. Please try again shortly."} (requestId: ${serverRequestId})`
        );
        return;
      }

      if (status === 401) {
        setItems((prev) => [
          ...prev,
          {
            kind: "error",
            role: "bot",
            title: "Session expired",
            details: data?.details ?? "Your sign-in session expired. Please sign in again and retry.",
            requestId: serverRequestId,
          },
        ]);
        return;
      }

      if (!(status >= 200 && status < 300) || data?.ok === false) {
        setItems((prev) => [
          ...prev,
          {
            kind: "error",
            role: "bot",
            title: `API Error ${status}`,
            details: JSON.stringify(data, null, 2),
            requestId: serverRequestId,
          },
        ]);
        return;
      }

      if (data?.sessionId && typeof data.sessionId === "string") {
        setActiveSessionId(data.sessionId);
        setActiveSessionMode(effectiveMode);
        setPendingSessionClientId(null);
        await loadSessions(true);
      }

      setRateLimitMsg(null);

      if (data?.mode === "review" && data?.review) {
        setItems((prev) => [
          ...prev,
          {
            kind: "review",
            role: "bot",
            review: data.review as ReviewResult,
            requestId: serverRequestId,
          },
        ]);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      if (data?.mode === "cases") {
        const reply = typeof data?.reply === "string" ? data.reply : "";
        setItems((prev) => [
          ...prev,
          {
            kind: "casesText",
            role: "bot",
            text: reply || "No reply returned",
            requestId: serverRequestId,
          },
        ]);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      if (data?.mode === "review" && data?.raw) {
        setItems((prev) => [
          ...prev,
          {
            kind: "error",
            role: "bot",
            title: data?.error ?? "Review parsing issue",
            details: String(data.raw),
            requestId: serverRequestId,
          },
        ]);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      // Default text reply (coach mode can include suggestions).
      const rawValue =
        isRecord(data) && typeof data["raw"] === "string"
          ? (data["raw"] as string)
          : undefined;

      const textToShow =
        !data?.reply && typeof rawValue === "string"
          ? rawValue
          : data?.reply ?? "No reply returned";

      const finalText =
        effectiveMode === "coach" && looksLikeJson(textToShow)
          ? tryFormatCoachJson(textToShow) ?? textToShow
          : textToShow;

      let suggestions: CoachSuggestions | null = null;
      if (isRecord(data)) {
        if (data["suggestions"]) {
          suggestions = data["suggestions"] as CoachSuggestions;
        } else if (
          isRecord(data["coach"]) &&
          (data["coach"] as Record<string, unknown>)["suggestions"]
        ) {
          suggestions = (data["coach"] as Record<string, unknown>)["suggestions"] as CoachSuggestions;
        }
      }

      setItems((prev) => [
        ...prev,
        {
          kind: "text",
          role: "bot",
          text: finalText,
          requestId: serverRequestId,
          ...(effectiveMode === "coach" && suggestions ? { suggestions } : {}),
        } as ChatItem,
      ]);

      void loadSessions(true);
      setLastPending(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      setLastRequestId(requestId);
      setItems((prev) => [
        ...prev,
        {
          kind: "error",
          role: "bot",
          title: "Network/Client error",
          details: message,
          requestId,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // ✅ CHANGE (BUGFIX): these MUST be defined at hook scope, not inside send()
  function hasSuggestions(v: unknown): v is { suggestions: CoachSuggestions } {
    if (!v || typeof v !== "object") return false;
    return "suggestions" in v && !!(v as { suggestions?: unknown }).suggestions;
  }

  // ✅ Derived: grab suggestions from the latest assistant message (coach mode only)
  const latestCoachSuggestions: CoachSuggestions | null = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "text" && it.role === "bot" && hasSuggestions(it)) {
        return it.suggestions;
      }
    }
    return null;
  }, [items]);

  // M8.6: lightweight workflow/continuity flags for UI components.
  const isStrategySession = mode === "coach" && activeSessionMode === "coach";
  const isTestDesignSession = mode === "cases" && activeSessionMode === "cases";
  const isTestReviewSession = mode === "review" && activeSessionMode === "review";
  const hasPinnedRequirement = !!sessionArtifact?.refinedRequirement;

  // M9 CHANGE: derived suite flag for evolving test suite UI.
  const hasPersistentTestSuite =
    !!sessionArtifact?.testSuite && Array.isArray(sessionArtifact.testSuite.cases);

  return {
    mode,
    setMode,

    input,
    setInput,

    items,
    setItems,

    isSending,

    rateLimitMsg,
    rate,
    lastRequestId,

    modeLockMsg,

    lastPending,

    sessions,
    sessionsCursor,
    sessionsLoading,

    activeSessionId,
    activeSessionMode,

    pendingSessionClientId,

    messagesCursor,
    messagesLoading,

    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    renameSaving,

    deletingId,
    deleteBusy,

    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,

    // M7.7
    sessionArtifact,
    artifactUpdatedAt,

    // M8.6
    isStrategySession,
    isTestDesignSession,
    isTestReviewSession,
    hasPinnedRequirement,

    // M9
    hasPersistentTestSuite,

    latestCoachSuggestions,
    modeLabel,

    loadSessions,
    loadSessionMessages,
    selectSession,

    newChat,
    startNewSessionInMode,
    trySetMode,

    renameSession,
    deleteSession,

    send,

    shouldAutoScrollRef,
  };
}