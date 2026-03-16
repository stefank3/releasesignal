// app/chat/hooks/useChatSession.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  ChatApiResponse,
  ChatItem,
  CoachSuggestions,
  HistoryMessage,
  Mode,
  PersistedState,
  RateMeta,
  ReviewResult,
  SessionArtifact,
  SessionListItem,
  WorkflowStatus,
} from "../chat.types";

import {
  artifactHasReviewSignal,
  buildOversizedInputMessage,
  deriveWorkflowStatus,
  extractCoachSuggestions,
  getDisplayReplyText,
  hasSuggestions,
  isNearBottom,
  mapHistoryItems,
  MAX_MESSAGE_CHARS,
  modeLabel,
} from "./useChatSession.helpers";

import {
  createRequestId,
  createSessionClientId,
  fetchJSON,
  fetchJSONWithMeta,
  readArtifactFromResponse,
} from "./useChatSession.net";

const STORAGE_KEY = "stefans-mvp-chat-v1";
const SIDEBAR_KEY = "stefans-mvp-sidebar-collapsed-v1";

export type LastPending = {
  requestId: string;
  text: string;
  mode: Mode;
  sessionId: string | null;
  sessionClientId: string | null;
};

export type UseChatSessionReturn = {
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

  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAt: string | null;

  isStrategySession: boolean;
  isTestDesignSession: boolean;
  isTestReviewSession: boolean;
  hasPinnedRequirement: boolean;
  hasPersistentTestSuite: boolean;

  hasReviewArtifact: boolean;
  workflowStatus: WorkflowStatus;

  latestCoachSuggestions: CoachSuggestions | null;
  modeLabel: (m: Mode) => string;

  loadSessions: (reset: boolean) => Promise<void>;
  loadSessionMessages: (
    sessionId: string,
    reset: boolean,
    sessionMode: Mode
  ) => Promise<void>;
  selectSession: (sessionId: string, sessionMode: Mode) => Promise<void>;

  newChat: () => void;
  startNewSessionInMode: (m: Mode) => void;
  trySetMode: (next: Mode) => void;

  renameSession: (sessionId: string, title: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  send: (opts?: { replay?: boolean }) => Promise<void>;

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

  const shouldAutoScrollRef = useRef(true);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const sidebarWidth = sidebarCollapsed ? 72 : 320;

  const [sessionArtifact, setSessionArtifact] = useState<SessionArtifact | null>(null);
  const [artifactUpdatedAt, setArtifactUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_KEY);
      setSidebarCollapsed(raw === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {}
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

  const loadSessionMessages = async (
    sessionId: string,
    reset: boolean,
    sessionMode: Mode
  ) => {
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
        artifact?: SessionArtifact | null;
        artifactUpdatedAt?: string | null;
      }>(url.toString());

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

      const { mapped } = mapHistoryItems({
        items: data.items,
        sessionMode,
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

    setLastPending({
      requestId,
      text,
      mode: effectiveMode,
      sessionId: sessionIdForRequest ?? null,
      sessionClientId: sessionClientIdForRequest,
    });

    try {
      const { status, headers, data } = await fetchJSONWithMeta<ChatApiResponse>(
        "/api/chat",
        {
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
        }
      );

      const serverRequestId = headers.get("x-request-id") || requestId;
      setLastRequestId(serverRequestId);

      if (data?.rate) setRate(data.rate);

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
            details:
              data?.details ?? "Your sign-in session expired. Please sign in again and retry.",
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

      const finalText = getDisplayReplyText({
        data,
        effectiveMode,
      });

      const suggestions = extractCoachSuggestions(data);

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

  const latestCoachSuggestions: CoachSuggestions | null = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "text" && it.role === "bot" && hasSuggestions(it)) {
        return it.suggestions;
      }
    }
    return null;
  }, [items]);

  const isStrategySession = mode === "coach" && activeSessionMode === "coach";
  const isTestDesignSession = mode === "cases" && activeSessionMode === "cases";
  const isTestReviewSession = mode === "review" && activeSessionMode === "review";
  const hasPinnedRequirement = !!sessionArtifact?.refinedRequirement;

  const hasPersistentTestSuite =
    !!sessionArtifact?.testSuite && Array.isArray(sessionArtifact.testSuite.cases);

  const hasReviewArtifact =
    artifactHasReviewSignal(sessionArtifact) ||
    items.some((it) => it.kind === "review" && it.role === "bot");

  const workflowStatus = useMemo(
    () =>
      deriveWorkflowStatus({
        mode,
        activeSessionMode,
        hasRequirement: hasPinnedRequirement,
        hasTestSuite: hasPersistentTestSuite,
        hasReview: hasReviewArtifact,
      }),
    [
      mode,
      activeSessionMode,
      hasPinnedRequirement,
      hasPersistentTestSuite,
      hasReviewArtifact,
    ]
  );

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

    sessionArtifact,
    artifactUpdatedAt,

    isStrategySession,
    isTestDesignSession,
    isTestReviewSession,
    hasPinnedRequirement,
    hasPersistentTestSuite,

    hasReviewArtifact,
    workflowStatus,

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