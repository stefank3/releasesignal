"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UserBar from "./UserBar";

/**
 * Chat modes:
 * - coach: model asks clarifying questions + proposes a small, high-signal test approach
 * - review: model returns structured JSON with score/breakdown/gaps/improvements
 */
type Mode = "coach" | "review";

/** Review breakdown component scores (max caps are part of the scoring model). */
type ReviewBreakdown = {
  businessRelevance: number; // 0-25
  riskCoverage: number; // 0-25
  designQuality: number; // 0-20
  levelAndScope: number; // 0-15
  diagnosticValue: number; // 0-15
};

/** Structured output returned by the API in review mode. */
type ReviewResult = {
  score: number; // 0-100
  verdict: string;
  breakdown: ReviewBreakdown;
  riskGaps: string[];
  antiPatterns: string[];
  improvements: string[];
};

/**
 * UI message model:
 * - text: normal user/bot chat messages
 * - review: structured scorecard output
 * - error: API/runtime errors shown to the user
 *
 * requestId is optional metadata used for debugging & correlation with server logs.
 */
type ChatItem =
  | { kind: "text"; role: "user" | "bot"; text: string; requestId?: string }
  | { kind: "review"; role: "bot"; review: ReviewResult; requestId?: string }
  | { kind: "error"; role: "bot"; title: string; details: string; requestId?: string };

type PersistedState = {
  mode: Mode;
  items: ChatItem[];
  input: string;
};

/**
 * Rate limit metadata (returned by the API on success + on 429).
 */
type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * ✅ Chat API response type (kept flexible but avoids "any").
 * Server may return replay=true when it served an idempotent replay.
 */
type ChatApiResponse = {
  ok: boolean;
  mode?: Mode;
  reply?: string;
  review?: ReviewResult;
  raw?: string;
  error?: string;
  details?: string;
  sessionId?: string;
  creditsCharged?: number;
  creditsRemaining?: number;
  rate?: RateMeta;
  replay?: boolean; // ✅ served from DB / idempotent path
};

/**
 * --- Chat History types (API: /api/chat/history) ---
 * Your backend returns:
 * - items[]: sessions list
 * - nextCursor: pagination cursor (sessionId)
 */
type SessionListItem = {
  id: string;
  title: string | null;
  mode: Mode;
  createdAt: string;
  lastActivityAt?: string;
  lastMessage: null | { role: string; content: string; createdAt: string };
};

/**
 * Messages returned by GET /api/chat/history/:sessionId
 * NOTE: Backend uses "role" values: user | assistant | system
 */
type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

/** Local storage key (so reload keeps the demo context). */
const STORAGE_KEY = "stefans-mvp-chat-v1";

/** Clamp helper to keep UI stable even if model returns values out of expected range. */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ Scroll helper:
 * Determine if user is already near the bottom of the chat window.
 * We only auto-scroll when near bottom, to avoid “scroll yanking” while reading history.
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
 * Convert review result to Markdown so it can be pasted into Jira/Confluence.
 * This is the "human-friendly export".
 */
function reviewToMarkdown(r: ReviewResult) {
  const b = r.breakdown;

  const lines: string[] = [];
  lines.push("## QE Review");
  lines.push(`**Score:** ${r.score}/100`);
  lines.push(`**Verdict:** ${mdSafe(r.verdict)}`);
  lines.push("");

  lines.push("### Breakdown");
  lines.push(`- Business relevance: ${b.businessRelevance}/25`);
  lines.push(`- Risk coverage: ${b.riskCoverage}/25`);
  lines.push(`- Design quality: ${b.designQuality}/20`);
  lines.push(`- Level & scope: ${b.levelAndScope}/15`);
  lines.push(`- Diagnostic value: ${b.diagnosticValue}/15`);
  lines.push("");

  const addList = (title: string, items: string[]) => {
    lines.push(`### ${title}`);
    if (!items || items.length === 0) lines.push("- None");
    else for (const it of items) lines.push(`- ${mdSafe(it)}`);
    lines.push("");
  };

  addList("Top risk gaps", r.riskGaps);
  addList("Anti-patterns", r.antiPatterns);
  addList("Prioritized improvements", r.improvements);

  return lines.join("\n");
}

/**
 * Convert review result to JSON (pretty printed).
 * This is the "machine-friendly export" for future integrations.
 */
function reviewToJson(r: ReviewResult) {
  return JSON.stringify(r, null, 2);
}

/**
 * Generate a client-side request id for correlation.
 * Uses crypto.randomUUID() when available, else a small fallback.
 */
function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * IDP: generate a stable client-side id for new-session creation.
 * This must remain stable across retries until server returns a real sessionId.
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
 * - detects HTML early (Auth0 redirect / middleware / error pages)
 * - always returns parsed json
 */
async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);

  const text = await res.text().catch(() => "");
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  const first = text.trimStart().slice(0, 200).replace(/\s+/g, " ");
  const looksHtml =
    ct.includes("text/html") || first.startsWith("<!doctype") || first.startsWith("<html") || first.startsWith("<");

  const looksJson = ct.includes("application/json") || first.startsWith("{") || first.startsWith("[");

  if (!looksJson) {
    const hint = looksHtml ? "Expected JSON but got HTML (redirect/login/error page)" : "Expected JSON but got non-JSON";
    throw new Error(`${hint} (HTTP ${res.status}). content-type=${ct || "(none)"} first=${first}`);
  }

  const data = text ? (JSON.parse(text) as unknown) : ({} as unknown);

  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  }

  return data as T;
}

/**
 * Attempt to parse a bot message content as a ReviewResult JSON.
 * This enables "history replay" to render past review results nicely.
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
    // ignore parse errors
  }
  return null;
}

function looksLikeJson(s: string) {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

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

/** Breakdown row with a progress bar (simple MVP UI, no external libs). */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const safeValue = clamp(Number(value) || 0, 0, max);
  const pct = (safeValue / max) * 100;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 70px", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{label}</div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          border: "1px solid #ddd",
          overflow: "hidden",
          background: "#fafafa",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "#111" }} />
      </div>

      <div style={{ fontSize: 13, textAlign: "right", color: "#111" }}>
        {safeValue}/{max}
      </div>
    </div>
  );
}

/** Small pill label used in header sections (dark background friendly). */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.22)",
        fontSize: 12,
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Header button style for Coach/Review/Clear and demo actions.
 * - active gives a stronger background to show selection.
 */
function HeaderButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.22)",
        background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
        color: "#fff",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

/** Small button used inside review cards (Copy MD / Copy JSON). */
function SmallButton({
  children,
  onClick,
  variant = "light",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: isDark ? "1px solid #111" : "1px solid #ddd",
        background: isDark ? "#111" : "#fff",
        color: isDark ? "#fff" : "#111",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Reusable list section for gaps/anti-patterns/improvements. */
function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#111" }}>{title}</div>

      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#666" }}>None.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.map((x, i) => (
            <li key={i} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.35, color: "#111" }}>
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Review UI card for structured scoring output.
 * Includes Copy MD + Copy JSON with a small toast notification (no alerts).
 */
function ReviewCard({ review }: { review: ReviewResult }) {
  const score = clamp(Number(review.score) || 0, 0, 100);
  const grade =
    score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Weak" : "Poor";

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied ✓`);
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
        boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
        color: "#111",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.2 }}>Review Score</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.35 }}>{review.verdict}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton onClick={() => copyText(reviewToMarkdown(review), "Markdown")}>Copy MD</SmallButton>
            <SmallButton onClick={() => copyText(reviewToJson(review), "JSON")} variant="dark">
              Copy JSON
            </SmallButton>
          </div>

          <div
            style={{
              border: "1px solid #111",
              borderRadius: 999,
              padding: "8px 12px",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            {score}/100
          </div>

          <div style={{ fontSize: 12, color: "#666" }}>{grade}</div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            marginTop: 10,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 12,
          background: "#fafafa",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#333" }}>Breakdown</div>
        <BarRow label="Business relevance" value={review.breakdown.businessRelevance} max={25} />
        <BarRow label="Risk coverage" value={review.breakdown.riskCoverage} max={25} />
        <BarRow label="Design quality" value={review.breakdown.designQuality} max={20} />
        <BarRow label="Level & scope" value={review.breakdown.levelAndScope} max={15} />
        <BarRow label="Diagnostic value" value={review.breakdown.diagnosticValue} max={15} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
          <Section title="Top risk gaps" items={review.riskGaps} />
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
          <Section title="Anti-patterns" items={review.antiPatterns} />
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
          <Section title="Prioritized improvements" items={review.improvements} />
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("coach");
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [rate, setRate] = useState<RateMeta | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

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

  const [pendingSessionClientId, setPendingSessionClientId] = useState<string | null>(null);

  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renameSaving, setRenameSaving] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  const shouldAutoScrollRef = useRef(true);

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

  const loadDemo = (demoMode: Mode, text: string) => {
    setMode(demoMode);
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

  const loadSessionMessages = async (sessionId: string, reset: boolean) => {
    if (messagesLoading) return;

    setMessagesLoading(true);
    try {
      const url = new URL(`/api/chat/history/${sessionId}`, window.location.origin);
      url.searchParams.set("limit", "120");
      if (!reset && messagesCursor) url.searchParams.set("cursor", messagesCursor);

      const el = chatBoxRef.current;
      const prevScrollHeight = el?.scrollHeight ?? 0;
      const prevScrollTop = el?.scrollTop ?? 0;

      const data = await fetchJSON<{ items: HistoryMessage[]; nextCursor: string | null }>(url.toString());

      const mapped: ChatItem[] = data.items
        .filter((m) => m.role !== "system")
        .map((m) => {
          const isUser = m.role === "user";

          if (!isUser) {
            const maybeReview = tryParseReview(m.content);
            if (maybeReview) return { kind: "review", role: "bot", review: maybeReview };
          }

          return { kind: "text", role: isUser ? "user" : "bot", text: m.content };
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

  const selectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setPendingSessionClientId(null);
    setMessagesCursor(null);

    setItems([]);
    setInput("");

    setRate(null);
    setRateLimitMsg(null);
    setLastRequestId(null);

    setLastPending(null);

    await loadSessionMessages(sessionId, true);
    setShouldScrollToBottom(true);
  };

  const newChat = () => {
    setActiveSessionId(null);
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

  const send = async (opts?: { replay?: boolean }) => {
    const replay = opts?.replay ?? false;

    const text = replay ? lastPending?.text ?? "" : input.trim();
    if (!text || isSending) return;

    const requestId = replay ? lastPending?.requestId ?? "" : createRequestId();
    if (!requestId) return;

    const effectiveMode = replay ? lastPending?.mode ?? mode : mode;

    const sessionIdForRequest = replay ? lastPending?.sessionId ?? activeSessionId : activeSessionId;

    const sessionClientIdForRequest =
      sessionIdForRequest ? null : (replay ? lastPending?.sessionClientId : pendingSessionClientId) ?? createSessionClientId();

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
      sessionClientId: sessionIdForRequest ? null : sessionClientIdForRequest,
    });

    try {
      const res = await fetch("/api/chat", {
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

      const data = (await res.json().catch(() => ({}))) as ChatApiResponse;

      const serverRequestId = res.headers.get("x-request-id") || requestId;
      setLastRequestId(serverRequestId);

      if (data?.rate) setRate(data.rate);

      if (res.ok && data?.sessionId && typeof data.sessionId === "string") {
        setActiveSessionId(data.sessionId);
        setPendingSessionClientId(null);
        await loadSessions(true);
      }

      if (res.status === 429) {
        setRateLimitMsg(`${data?.details ?? "Rate limit reached. Please try again shortly."} (requestId: ${serverRequestId})`);
        setShouldScrollToBottom(true);
        return;
      }

      setRateLimitMsg(null);

      if (res.ok && data?.mode === "review" && data?.review) {
        setItems((prev) => [...prev, { kind: "review", role: "bot", review: data.review as ReviewResult, requestId: serverRequestId }]);
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

      if (res.ok) {
        setItems((prev) => [...prev, { kind: "text", role: "bot", text: data?.reply ?? "No reply returned", requestId: serverRequestId }]);
        setShouldScrollToBottom(true);
        void loadSessions(true);
        setLastPending(null);
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          kind: "error",
          role: "bot",
          title: `API Error ${res.status}`,
          details: JSON.stringify(data, null, 2),
          requestId: serverRequestId,
        },
      ]);
      setShouldScrollToBottom(true);
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

  const mainStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 980,
    margin: "0 auto",
    color: "#fff",
    background: "radial-gradient(900px 360px at 50% -120px, rgba(255,255,255,0.12), rgba(0,0,0,0))",
  };

  const chatBoxStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 14,
    padding: 14,
    height: "62vh",
    overflow: "auto",
    background: "#fafafa",
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside
        style={{
          width: 320,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          padding: 14,
          background: "rgba(0,0,0,0.35)",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 900 }}>History</div>

          <button
            onClick={newChat}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            New
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {sessions.map((s) => {
            const active = s.id === activeSessionId;

            const title = s.title ?? "New chat";
            const preview = s.lastMessage?.role === "user" ? s.lastMessage.content.slice(0, 80) : "Open to view";

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
                  onClick={() => void selectSession(s.id)}
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 230,
                      }}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{s.mode}</div>
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
                  )}
                </div>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.45 }}>
              No sessions yet. Send your first message to create one.
            </div>
          )}

          {sessionsCursor && (
            <button
              onClick={() => void loadSessions(false)}
              disabled={sessionsLoading}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontWeight: 900,
                cursor: sessionsLoading ? "not-allowed" : "pointer",
                opacity: sessionsLoading ? 0.6 : 1,
              }}
            >
              {sessionsLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </aside>

      <main style={{ ...mainStyle, flex: 1, overflow: "auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>AI-Assisted Quality Review & Coaching Platform</h1>

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <Chip>Demo</Chip>
          <HeaderButton onClick={() => loadDemo("coach", DEMO_COACH_LOGIN)} disabled={isSending}>
            Coach: Login + MFA
          </HeaderButton>
          <HeaderButton onClick={() => loadDemo("review", DEMO_REVIEW_LOGIN)} disabled={isSending}>
            Review: Login + MFA
          </HeaderButton>
          <HeaderButton onClick={() => loadDemo("review", DEMO_REVIEW_EXPORT)} disabled={isSending}>
            Review: Export CSV
          </HeaderButton>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <Chip>Mode: {mode === "coach" ? "Coach" : "Review"}</Chip>
          {rateChipText && <Chip>{rateChipText}</Chip>}
          {lastRequestId && <Chip>requestId: {lastRequestId.slice(0, 8)}…</Chip>}

          {lastPending && !isSending && <HeaderButton onClick={() => void send({ replay: true })}>Retry last</HeaderButton>}

          <HeaderButton active={mode === "coach"} onClick={() => setMode("coach")} disabled={isSending}>
            Coach
          </HeaderButton>

          <HeaderButton active={mode === "review"} onClick={() => setMode("review")} disabled={isSending}>
            Review
          </HeaderButton>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <UserBar />

            <HeaderButton
              onClick={() => {
                setItems([]);
                setInput("");
                setRate(null);
                setRateLimitMsg(null);
                setLastRequestId(null);
                setLastPending(null);
                localStorage.removeItem(STORAGE_KEY);
              }}
              disabled={isSending}
            >
              Clear
            </HeaderButton>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <Chip>{activeSessionId ? `Session: ${activeSessionId.slice(0, 8)}…` : "Session: (new)"}</Chip>

          {activeSessionId && messagesCursor && (
            <HeaderButton onClick={() => void loadSessionMessages(activeSessionId, false)} disabled={messagesLoading}>
              {messagesLoading ? "Loading…" : "Load older"}
            </HeaderButton>
          )}
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

        <div ref={chatBoxRef} style={chatBoxStyle}>
          {items.length === 0 ? (
            <div style={{ color: "#666", fontSize: 13 }}>
              {mode === "coach"
                ? "Describe a feature. I’ll draft test cases immediately (assumptions included), then ask up to 3 optional clarifications."
                : "Paste test cases or a test plan. I’ll return a score + breakdown + improvements."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((it, idx) => {
                if (it.kind === "text") {
                  const isUser = it.role === "user";
                  const textToShow =
                    !isUser && looksLikeJson(it.text) ? tryFormatCoachJson(it.text) ?? it.text : it.text;

                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                      <div
                        style={{
                          maxWidth: "78%",
                          border: "1px solid #ddd",
                          borderRadius: 12,
                          padding: 12,
                          background: isUser ? "#111" : "#fff",
                          color: isUser ? "#fff" : "#111",
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                          lineHeight: 1.4,
                        }}
                      >
                        {textToShow}
                        {it.requestId && (
                          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
                            requestId: {it.requestId.slice(0, 8)}…
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (it.kind === "review") {
                  return (
                    <div key={idx} style={{ display: "grid", gap: 8 }}>
                      <ReviewCard review={it.review} />
                      {it.requestId && (
                        <div style={{ fontSize: 11, opacity: 0.65, color: "#111" }}>requestId: {it.requestId}</div>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    style={{
                      border: "1px solid #f0c",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                      color: "#111",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>{it.title}</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{it.details}</pre>
                    {it.requestId && (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>
                        requestId: <span style={{ fontFamily: "monospace" }}>{it.requestId}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "review" ? "Paste test cases / test plan…" : "Describe the feature / workflow…"}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fff",
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
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
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
