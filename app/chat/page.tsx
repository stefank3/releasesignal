// app/chat/page.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGELOG (surgical):
// 1) FIX: correct module paths (chat.types + CasesLegacyCard location)
// 2) FIX: remove inline SuggestedReplies usage; use extracted GuidedSuggestions component instead
// 3) FIX: normalize ChatUI casing import (ChatUI.tsx)
// 4) FIX: type the autofill callback param to avoid implicit any

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import UserBar from "./UserBar";

// ✅ FIX (M7): import shared types from app/chat/chat.types.ts (now included via tsconfig **/*.ts)
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
} from "./chat.types";

// ✅ FIX (M7): normalize casing => ChatUI (NOT ChatUi)
import { Chip, Group, HeaderButton, ModeBadge, Toolbar, clamp } from "./components/ChatUI";

// ✅ FIX (M7): cards live under app/chat/cards
import ReviewCard from "./cards/ReviewCard";
import CasesTextCard from "./cards/CasesTextCard";

// ✅ FIX (M7): CasesLegacyCard is NOT under /cards in your tree; it is app/chat/CasesLegacyCard.tsx
import CasesLegacyCard from "./cards/CasesLegacyCard";

// ✅ FIX (M7): guided UI extracted into its own component file
import GuidedSuggestions from "./GuidedSuggestions";

/** Local storage key (so reload keeps the demo context). */
const STORAGE_KEY = "stefans-mvp-chat-v1";

// M7.2 CHANGE: localStorage key for sidebar collapse persistence.
const SIDEBAR_KEY = "stefans-mvp-sidebar-collapsed-v1";

/**
 * ✅ Scroll helper:
 * Determine if user is already near the bottom of the chat window.
 */
function isNearBottom(el: HTMLDivElement, thresholdPx = 140) {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance <= thresholdPx;
}

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

/**
 * Generate a client-side request id for correlation.
 */
function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * IDP: generate a stable client-side id for new-session creation.
 */
function createSessionClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Fetch helper:
 * - throws on non-2xx responses
 * - detects HTML early
 * - always returns parsed json
 *
 * ✅ CHANGE (M6.1):
 * We now return { status, headers, data } so callers can inspect HTTP status reliably,
 * and still access the structured error payload (e.g., SESSION_MODE_MISMATCH 409).
 */
async function fetchJSONWithMeta<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; data: T }> {
  const res = await fetch(input, init);

  const text = await res.text().catch(() => "");
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  const first = text.trimStart().slice(0, 200).replace(/\s+/g, " ");
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

  // ✅ DO NOT throw on !res.ok. The caller may need status + payload to do UX handling.
  return { status: res.status, headers: res.headers, data: data as T };
}

/**
 * Backward-compatible wrapper:
 * Some call sites only need "happy path" and want exceptions on non-2xx.
 */
async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const { status, data } = await fetchJSONWithMeta<T>(input, init);
  if (status >= 200 && status < 300) return data;

  const err = (data as { error?: string })?.error;
  throw new Error(err || `HTTP ${status}`);
}

/**
 * Attempt to parse a bot message content as a ReviewResult JSON.
 */
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

/**
 * Legacy-only: Attempt to parse a bot message content as a CasesResult JSON.
 * WHY (M5.1): cases is now strict plain text, but old history may still contain JSON.
 */
function tryParseCasesLegacy(text: string): CasesResult | null {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.suiteTitle === "string" && Array.isArray(obj.assumptions) && Array.isArray(obj.testCases)) {
      return obj as CasesResult;
    }
  } catch {
    // ignore
  }
  return null;
}

function looksLikeJson(s: string) {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
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

/**
 * Coach readability fallback:
 * If bot reply is JSON, attempt to show a short readable summary.
 */
function tryFormatCoachJson(text: string): string | null {
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
        lines.push(`- ${id ? `${id} ` : ""}${title}${meta ? ` (${meta})` : ""}`.trim());
      }
      lines.push("");
    } else if (Array.isArray(obj.highSignalApproach?.testIdeas) && obj.highSignalApproach.testIdeas?.length) {
      lines.push("Draft test ideas:");
      for (const t of obj.highSignalApproach.testIdeas.slice(0, 12)) lines.push(`- ${mdSafe(t)}`);
      lines.push("");
    }

    if (Array.isArray(obj.optionalClarifications) && obj.optionalClarifications.length) {
      lines.push("Optional clarifications:");
      for (const q of obj.optionalClarifications.slice(0, 3)) lines.push(`- ${mdSafe(q)}`);
      lines.push("");
    }

    return lines.length ? lines.join("\n").trim() : null;
  } catch {
    return null;
  }
}

function modeLabel(m: Mode) {
  return m === "coach" ? "Coach" : m === "review" ? "Review" : "Cases";
}

// M7.2 CHANGE: derive a stable “initials / glyph” for icon-only session rows.
function sessionGlyph(title: string) {
  const t = (title || "New chat").trim();
  const parts = t.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? "N").toUpperCase();
  const b = (parts[1]?.[0] ?? "").toUpperCase();
  return (a + b).slice(0, 2);
}

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("coach");
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [rate, setRate] = useState<RateMeta | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  // ✅ Milestone 6.1: show deterministic UX guidance on mode mismatch
  const [modeLockMsg, setModeLockMsg] = useState<{
    sessionMode: Mode;
    requestedMode: Mode;
  } | null>(null);

  const [lastPending, setLastPending] = useState<{
    requestId: string;
    text: string;
    mode: Mode;
    sessionId: string | null;
    sessionClientId: string | null;
  } | null>(null);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsCursor, setSessionsCursor] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  /**
   * ✅ Needed to render history correctly.
   */
  const [activeSessionMode, setActiveSessionMode] = useState<Mode>("coach");

  const [pendingSessionClientId, setPendingSessionClientId] = useState<string | null>(null);

  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameSaving, setRenameSaving] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  // M7.4: input ref so GuidedSuggestions can focus textbox after autofill.
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const shouldAutoScrollRef = useRef(true);

  // ✅ hydration-safe (server + first client render match)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

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

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    const onScroll = () => {
      shouldAutoScrollRef.current = isNearBottom(el);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!shouldScrollToBottom) return;

    const el = chatBoxRef.current;
    if (!el) return;

    if (shouldAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }

    setShouldScrollToBottom(false);
  }, [items, shouldScrollToBottom]);

  useEffect(() => {
    void loadSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const DEMO_COACH_LOGIN = `Feature: Login with Auth0, optional MFA

Context:
- Username/password login via Auth0 Universal Login
- MFA optional based on user policy
- Web app + API backend
- Lockout policy: 5 failed attempts -> 15 min lock

Ask:
Help me design a risk-based test strategy and a small set of high-signal tests.`;

  const DEMO_REVIEW_LOGIN = `Feature: Login with Auth0, optional MFA

TC1: Valid login (no MFA) should succeed
Steps: open login page, enter valid creds, submit
Expected: redirected to dashboard

TC2: Invalid password shows error
Steps: enter valid username + wrong password
Expected: error message, no redirect

TC3: MFA required for some users
Steps: login as user with MFA enabled
Expected: MFA challenge shown, on success redirect

TC4: MFA failure
Steps: enter wrong OTP
Expected: error, allow retry, no login`;

  const DEMO_REVIEW_EXPORT = `Feature: Export search results (CSV)

TC1: Export CSV for filtered results
Steps:
1. Apply filters (Market=Austria, Status=Active)
2. Click Export -> CSV
3. Wait for completion
Expected:
- File downloads
- Filename includes timestamp
- Contains headers + correct number of rows

TC2: Export limit is enforced
Steps: Filter to >100k rows, export CSV
Expected: user sees clear error, export not started

TC3: Cancel export
Steps: Start export, click Cancel
Expected: export stops, no file downloaded, status resets`;

  const DEMO_CASES_LOGIN = `Generate test cases for this feature:

Feature: Login with Auth0, optional MFA

Context:
- Username/password login via Auth0 Universal Login
- MFA optional based on user policy
- Lockout policy: 5 failed attempts -> 15 minutes
- Sessions stored in HttpOnly cookies

Acceptance criteria:
- Valid credentials redirect to dashboard
- Invalid credentials show error and do not redirect
- If MFA required, user must complete challenge to login
- After 5 failed attempts, account is locked for 15 minutes`;

  const loadDemo = (demoMode: Mode, text: string) => {
    if (activeSessionId && demoMode !== activeSessionMode) {
      setModeLockMsg({ sessionMode: activeSessionMode, requestedMode: demoMode });
      return;
    }

    setMode(demoMode);
    if (!activeSessionId) setActiveSessionMode(demoMode);
    setInput(text);
  };

  const loadSessions = async (reset: boolean) => {
    if (sessionsLoading) return;

    setSessionsLoading(true);
    try {
      const url = new URL("/api/chat/history", window.location.origin);
      url.searchParams.set("limit", "25");
      if (!reset && sessionsCursor) url.searchParams.set("cursor", sessionsCursor);

      const data = await fetchJSON<{ items: SessionListItem[]; nextCursor: string | null }>(url.toString());

      setSessions((prev) => (reset ? data.items : [...prev, ...data.items]));
      setSessionsCursor(data.nextCursor);
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
      setSessionsLoading(false);
    }
  };

  /**
   * ✅ History loader:
   * - uses sessionMode for correct rendering
   * - upgrades to "cases" if assistant messages strongly look like cases plain text (for mis-labeled older sessions)
   */
  const loadSessionMessages = async (sessionId: string, reset: boolean, sessionMode: Mode) => {
    if (messagesLoading) return;

    setMessagesLoading(true);
    try {
      const url = new URL(`/api/chat/history/${sessionId}`, window.location.origin);
      url.searchParams.set("limit", "120");
      if (!reset && messagesCursor) url.searchParams.set("cursor", messagesCursor);

      const el = chatBoxRef.current;
      const prevScrollHeight = el?.scrollHeight ?? 0;
      const prevScrollTop = el?.scrollTop ?? 0;

      const data = await fetchJSON<{
        items: HistoryMessage[];
        nextCursor: string | null;
        hasMore?: boolean;
        sessionMode?: Mode;
        effectiveMode?: Mode;
      }>(url.toString());

      if (reset) {
        const serverMode = data.effectiveMode ?? data.sessionMode;

        if (serverMode && serverMode !== activeSessionMode) {
          setActiveSessionMode(serverMode);
          setMode(serverMode);
          sessionMode = serverMode;
        }
      }

      let effectiveSessionMode: Mode = sessionMode;
      if (sessionMode !== "cases") {
        const assistantMsgs = data.items.filter((m) => m.role === "assistant").map((m) => m.content);

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
            if (maybeCasesLegacy) return { kind: "casesLegacy", role: "bot", cases: maybeCasesLegacy };

            return { kind: "casesText", role: "bot", text: m.content };
          }

          const maybeReview = tryParseReview(m.content);
          if (maybeReview) return { kind: "review", role: "bot", review: maybeReview };

          return { kind: "text", role: "bot", text: m.content };
        });

      setItems((prev) => (reset ? mapped : [...mapped, ...prev]));
      setMessagesCursor(data.nextCursor);

      requestAnimationFrame(() => {
        const el2 = chatBoxRef.current;
        if (!el2) return;

        if (!reset) {
          const nextScrollHeight = el2.scrollHeight;
          el2.scrollTop = prevScrollTop + (nextScrollHeight - prevScrollHeight);
        } else {
          el2.scrollTop = el2.scrollHeight;
          shouldAutoScrollRef.current = true;
        }
      });
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

    await loadSessionMessages(sessionId, true, sessionMode);
    setShouldScrollToBottom(true);
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

    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: nextTitle } : s)));

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

    const sessionIdForRequest = replay ? lastPending?.sessionId ?? activeSessionId : activeSessionId;

    if (sessionIdForRequest && effectiveMode !== activeSessionMode) {
      setModeLockMsg({ sessionMode: activeSessionMode, requestedMode: effectiveMode });
      return;
    }

    const sessionClientIdForRequest =
      sessionIdForRequest
        ? null
        : (replay ? lastPending?.sessionClientId : pendingSessionClientId) ?? createSessionClientId();

    if (!sessionIdForRequest && !pendingSessionClientId && !replay) {
      setPendingSessionClientId(sessionClientIdForRequest);
    }

    if (!sessionIdForRequest && replay && !pendingSessionClientId && lastPending?.sessionClientId) {
      setPendingSessionClientId(lastPending.sessionClientId);
    }

    if (!replay) {
      setItems((prev) => [...prev, { kind: "text", role: "user", text, requestId }]);
      setInput("");
      shouldAutoScrollRef.current = true;
    }

    setIsSending(true);

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
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
        },
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

      if (status === 409 && data?.error === "SESSION_MODE_MISMATCH" && data.sessionMode && data.requestedMode) {
        setModeLockMsg({ sessionMode: data.sessionMode, requestedMode: data.requestedMode });

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

        setShouldScrollToBottom(true);
        return;
      }

      if (status === 429) {
        setRateLimitMsg(
          `${data?.details ?? "Rate limit reached. Please try again shortly."} (requestId: ${serverRequestId})`,
        );
        setShouldScrollToBottom(true);
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
        setShouldScrollToBottom(true);
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
          { kind: "review", role: "bot", review: data.review as ReviewResult, requestId: serverRequestId },
        ]);
        setShouldScrollToBottom(true);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      if (data?.mode === "cases") {
        const reply = typeof data?.reply === "string" ? data.reply : "";
        setItems((prev) => [
          ...prev,
          { kind: "casesText", role: "bot", text: reply || "No reply returned", requestId: serverRequestId },
        ]);
        setShouldScrollToBottom(true);
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

        setShouldScrollToBottom(true);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      {
        function isRecord(v: unknown): v is Record<string, unknown> {
          return typeof v === "object" && v !== null;
        }

        const rawValue = isRecord(data) && typeof data.raw === "string" ? data.raw : undefined;

        const textToShow = !data?.reply && typeof rawValue === "string" ? rawValue : data?.reply ?? "No reply returned";

        const finalText =
          effectiveMode === "coach" && looksLikeJson(textToShow)
            ? tryFormatCoachJson(textToShow) ?? textToShow
            : textToShow;

        const suggestions = data?.suggestions ?? data?.coach?.suggestions;

        setItems((prev) => [
          ...prev,
          {
            kind: "text",
            role: "bot",
            text: finalText,
            requestId: serverRequestId,
            ...(effectiveMode === "coach" && suggestions ? { suggestions } : {}),
          },
        ]);

        setShouldScrollToBottom(true);
        void loadSessions(true);
        setLastPending(null);
        return;
      }
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
      setShouldScrollToBottom(true);
    } finally {
      setIsSending(false);
    }
  };

  const rateChipText = useMemo(() => {
    if (!rate) return null;
    return `Rate: ${rate.remaining}/${rate.limit} · resets in ${rate.resetSeconds}s`;
  }, [rate]);

  // Pull latest suggestions from the last bot message in coach mode
  const latestCoachSuggestions: CoachSuggestions | null = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "text" && it.role === "bot" && it.suggestions) {
        return it.suggestions;
      }
    }
    return null;
  }, [items]);

  // M7.2: computed sidebar dimensions for smooth transition + stable layout.
  const sidebarWidth = sidebarCollapsed ? 72 : 320;

  const mainStyle: React.CSSProperties = {
    padding: 20,
    maxWidth: 1040,
    margin: "0 auto",
    color: "#fff",
    background: "radial-gradient(900px 360px at 50% -120px, rgba(255,255,255,0.10), rgba(0,0,0,0))",
  };

  const chatBoxStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    height: "52vh",
    overflow: "auto",
    background: "rgba(255,255,255,0.04)",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
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
            onClick={newChat}
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

            const effectiveMode = s.effectiveMode ?? s.mode;

            if (sidebarCollapsed) {
              return (
                <button
                  key={s.id}
                  onClick={() => void selectSession(s.id, effectiveMode)}
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
                  onClick={() => void selectSession(s.id, effectiveMode)}
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
                        onChange={(e) => setRenameValue(e.target.value)}
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
                          if (e.key === "Enter") void renameSession(s.id, renameValue);
                          if (e.key === "Escape") {
                            setRenamingId(null);
                            setRenameValue("");
                          }
                        }}
                      />

                      <button
                        onClick={() => void renameSession(s.id, renameValue)}
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
                          setRenamingId(s.id);
                          setRenameValue(s.title ?? "New chat");
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
                          void deleteSession(s.id);
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
              onClick={() => void loadSessions(false)}
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

      <main style={{ ...mainStyle, flex: 1, overflow: "auto" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand history panel" : "Collapse history panel"}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontWeight: 950,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
              AI-Assisted Quality Review & Coaching
            </h1>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Coach · Review · Cases (mode is session-locked)</div>
          </div>

          <div style={{ flex: "0 0 auto" }}>
            <UserBar />
          </div>
        </div>

        {/* Demo toolbar */}
        <Toolbar
          right={
            <HeaderButton
              onClickAction={() => {
                setItems([]);
                setInput("");
                setRate(null);
                setRateLimitMsg(null);
                setLastRequestId(null);
                setLastPending(null);
                setModeLockMsg(null);
                localStorage.removeItem(STORAGE_KEY);
              }}
              disabled={isSending}
            >
              Clear
            </HeaderButton>
          }
        >
          <Chip>Demo</Chip>
          <HeaderButton onClickAction={() => loadDemo("coach", DEMO_COACH_LOGIN)} disabled={isSending}>
            Login + MFA (Coach)
          </HeaderButton>
          <HeaderButton onClickAction={() => loadDemo("review", DEMO_REVIEW_LOGIN)} disabled={isSending}>
            Login + MFA (Review)
          </HeaderButton>
          <HeaderButton onClickAction={() => loadDemo("review", DEMO_REVIEW_EXPORT)} disabled={isSending}>
            Export CSV (Review)
          </HeaderButton>
          <HeaderButton onClickAction={() => loadDemo("cases", DEMO_CASES_LOGIN)} disabled={isSending}>
            Login + MFA (Cases)
          </HeaderButton>
        </Toolbar>

        <div style={{ height: 10 }} />

        {/* Mode toolbar */}
        <Toolbar>
          <Group>
            <ModeBadge mode={mode} />
            {rateChipText && <Chip>{rateChipText}</Chip>}
            {lastRequestId && <Chip>rid: {lastRequestId.slice(0, 8)}…</Chip>}
            {lastPending && !isSending && <HeaderButton onClickAction={() => void send({ replay: true })}>Retry</HeaderButton>}
          </Group>

          <Group>
            <HeaderButton active={mode === "coach"} onClickAction={() => trySetMode("coach")} disabled={isSending}>
              Coach
            </HeaderButton>

            <HeaderButton active={mode === "review"} onClickAction={() => trySetMode("review")} disabled={isSending}>
              Review
            </HeaderButton>

            <HeaderButton active={mode === "cases"} onClickAction={() => trySetMode("cases")} disabled={isSending}>
              Cases
            </HeaderButton>
          </Group>

          <Group>
            <Chip>New session</Chip>
            <HeaderButton onClickAction={() => startNewSessionInMode("coach")} disabled={isSending}>
              Coach
            </HeaderButton>
            <HeaderButton onClickAction={() => startNewSessionInMode("review")} disabled={isSending}>
              Review
            </HeaderButton>
            <HeaderButton onClickAction={() => startNewSessionInMode("cases")} disabled={isSending}>
              Cases
            </HeaderButton>
          </Group>
        </Toolbar>

        {modeLockMsg && (
          <div
            style={{
              marginTop: 10,
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ lineHeight: 1.35 }}>
              This session is locked to <b>{modeLabel(modeLockMsg.sessionMode)}</b>. To use{" "}
              <b>{modeLabel(modeLockMsg.requestedMode)}</b>, start a new session.
            </div>

            <button
              onClick={() => startNewSessionInMode(modeLockMsg.requestedMode)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              New session in {modeLabel(modeLockMsg.requestedMode)}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, margin: "12px 0 10px", flexWrap: "wrap", alignItems: "center" }}>
          <Chip>{activeSessionId ? `Session: ${activeSessionId.slice(0, 8)}…` : "Session: (new)"}</Chip>

          {activeSessionId ? <ModeBadge mode={activeSessionMode} locked /> : null}

          {activeSessionId && messagesCursor && (
            <HeaderButton
              onClickAction={() => void loadSessionMessages(activeSessionId, false, activeSessionMode)}
              disabled={messagesLoading}
            >
              {messagesLoading ? "Loading…" : "Load older"}
            </HeaderButton>
          )}

          {activeSessionId ? (
            <div style={{ fontSize: 12, opacity: 0.72 }}>Mode is session-locked. Start a new session to switch modes.</div>
          ) : null}
        </div>

        {rateLimitMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {rateLimitMsg}
          </div>
        )}

        {/* Chat messages */}
        <div ref={chatBoxRef} style={chatBoxStyle}>
          {items.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 1.55 }}>
              {mode === "coach"
                ? "Describe a feature. I’ll draft a risk-based approach + test ideas immediately (assumptions included), then ask up to 3 optional clarifications."
                : mode === "review"
                  ? "Paste test cases or a test plan. I’ll return a score + breakdown + improvements."
                  : "Describe the feature + acceptance criteria. I’ll generate STRICT plain-text Jira/Xray-ready test cases (no JSON)."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {items.map((it, idx) => {
                if (it.kind === "text") {
                  const isUser = it.role === "user";
                  const textToShow = !isUser && looksLikeJson(it.text) ? tryFormatCoachJson(it.text) ?? it.text : it.text;

                  return (
                    <div key={idx} style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "78%",
                            border: isUser ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 16,
                            padding: 16,
                            background: isUser ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)",
                            color: isUser ? "#fff" : "#111",
                            whiteSpace: "pre-wrap",
                            fontSize: 13,
                            lineHeight: 1.55,
                            boxShadow: isUser ? "none" : "0 6px 22px rgba(0,0,0,0.08)",
                          }}
                        >
                          {textToShow}
                          {it.requestId && (
                            <div style={{ marginTop: 10, fontSize: 10, opacity: 0.55 }}>
                              requestId: {it.requestId.slice(0, 8)}…
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (it.kind === "review") {
                  return (
                    <div key={idx} style={{ display: "grid", gap: 10 }}>
                      <ReviewCard review={it.review} />
                      {it.requestId && <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>}
                    </div>
                  );
                }

                if (it.kind === "casesText") {
                  return (
                    <div key={idx} style={{ display: "grid", gap: 10 }}>
                      <CasesTextCard text={it.text} />
                      {it.requestId && <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>}
                    </div>
                  );
                }

                if (it.kind === "casesLegacy") {
                  return (
                    <div key={idx} style={{ display: "grid", gap: 10 }}>
                      <CasesLegacyCard cases={it.cases} />
                      {it.requestId && <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #f0b",
                      borderRadius: 16,
                      padding: 16,
                      background: "rgba(255,255,255,0.92)",
                      color: "#111",
                      boxShadow: "0 6px 22px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div style={{ fontWeight: 950, marginBottom: 10 }}>{it.title}</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.45 }}>{it.details}</pre>
                    {it.requestId && (
                      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.75, fontWeight: 800 }}>
                        requestId: <span style={{ fontFamily: "monospace" }}>{it.requestId}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guided suggestions block (always below chat, above input) */}
        {mode === "coach" && activeSessionMode === "coach" && latestCoachSuggestions && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-start" }}>
            {/* ✅ FIX (M7): use extracted component instead of inline SuggestedReplies */}
            <GuidedSuggestions
              suggestions={latestCoachSuggestions}
              // ✅ FIX: type the callback param (avoid implicit any)
              onUseSelectionsAction={(autofillText: string) => {
                setInput(autofillText);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
                });
              }}
            />
          </div>
        )}

        {/* Input row */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "review"
                ? "Paste test cases / test plan…"
                : mode === "cases"
                  ? "Describe feature + acceptance criteria (or user story)…"
                  : "Describe the feature / workflow…"
            }
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.92)",
              color: "#111",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            disabled={isSending}
          />

          <button
            onClick={() => void send()}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontWeight: 950,
              opacity: isSending ? 0.7 : 1,
              cursor: isSending ? "not-allowed" : "pointer",
            }}
            disabled={isSending}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </main>
    </div>
  );
}