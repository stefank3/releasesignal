// app/chat/hooks/useChatSession.ts
// M12 Step 4B:
// - add explicit test suite update path
// - allow editable suite UI to persist changes into SessionArtifact.testSuite
// - keep send() flow unchanged
// - keep hook as orchestration layer
//
// M12 Step 7A CHANGE:
// - remove legacy mode-lock behavior in hook
// - allow one workspace session to operate across coach / cases / review
// - classify cases responses by artifact/content, not current tab alone
//
// M12 Step 7B CHANGE:
// - history replay now passes artifact into mapHistoryItems(...)
// - effective session mode for replay is derived from artifact/content
// - avoid restoring stale mode assumptions from caller state
// - keep hook orchestration-only
//
// M12.9 CHANGE:
// - add artifact-driven workflow action contract for Generate Tests
// - expose deterministic action eligibility from artifact state
// - keep UI trigger-only; execution stays in hook
// - return explicit action failure state when no suite is produced

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { TestCase } from "@/lib/chat/artifact";

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

type WorkflowAction = "generate_tests_from_requirement";

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

  // M12.9 CHANGE:
  // explicit action execution state for artifact-driven workspace actions
  isRunningWorkflowAction: boolean;
  workflowActionError: string | null;
  canGenerateTests: boolean;

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

  // M12 Step 4B:
  // explicit editable-suite persistence path
  updateTestSuite: (cases: TestCase[]) => Promise<void>;

  // M12.9 CHANGE:
  // artifact-driven workspace action path
  generateTestsFromRequirement: () => Promise<void>;

  send: (opts?: { replay?: boolean }) => Promise<void>;

  shouldAutoScrollRef: MutableRefObject<boolean>;
};

function looksLikePersistedTestSuiteText(text: string): boolean {
  return /^Test Suite v\d+\s*\nTotal test cases:\s*\d+/i.test(
    String(text ?? "").trim()
  );
}

function looksLikeRefinedRequirementText(text: string): boolean {
  const t = String(text ?? "").trim();
  return (
    t.startsWith("Refined Technical Requirement") ||
    t.startsWith("Objective:") ||
    t.includes("Context / Constraints:") ||
    t.includes("Risk Focus:")
  );
}

export function useChatSession(): UseChatSessionReturn {
  const [mode, setMode] = useState<Mode>("coach");
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isSending, setIsSending] = useState(false);

  // M12.9 CHANGE:
  // separate workspace action execution state from freeform send() state
  const [isRunningWorkflowAction, setIsRunningWorkflowAction] = useState(false);
  const [workflowActionError, setWorkflowActionError] = useState<string | null>(
    null
  );

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
  const [pendingSessionClientId, setPendingSessionClientId] = useState<
    string | null
  >(null);

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

  const [sessionArtifact, setSessionArtifact] = useState<SessionArtifact | null>(
    null
  );
  const [artifactUpdatedAt, setArtifactUpdatedAt] = useState<string | null>(
    null
  );

  /*
  ---------------------------------------------------------
  LOCAL PERSISTENCE
  ---------------------------------------------------------
  */

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

  /*
  ---------------------------------------------------------
  TRANSIENT UI MESSAGES
  ---------------------------------------------------------
  */

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

  /*
  ---------------------------------------------------------
  SESSION LIST
  ---------------------------------------------------------
  */

  const loadSessions = async (reset: boolean) => {
    if (sessionsLoading) return;

    setSessionsLoading(true);
    try {
      const url = new URL("/api/chat/history", window.location.origin);
      url.searchParams.set("limit", "25");
      if (!reset && sessionsCursor) {
        url.searchParams.set("cursor", sessionsCursor);
      }

      const data = await fetchJSON<{
        items: SessionListItem[];
        nextCursor: string | null;
      }>(url.toString());

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

  /*
  ---------------------------------------------------------
  SESSION HISTORY
  ---------------------------------------------------------
  */

  const loadSessionMessages = async (
    sessionId: string,
    reset: boolean,
    sessionMode: Mode
  ) => {
    if (messagesLoading) return;

    setMessagesLoading(true);
    try {
      const url = new URL(
        `/api/chat/history/${sessionId}`,
        window.location.origin
      );
      url.searchParams.set("limit", "120");
      if (!reset && messagesCursor) {
        url.searchParams.set("cursor", messagesCursor);
      }

      const data = await fetchJSON<{
        items: HistoryMessage[];
        nextCursor: string | null;
        hasMore?: boolean;
        sessionMode?: Mode;
        effectiveMode?: Mode;
        artifact?: SessionArtifact | null;
        artifactUpdatedAt?: string | null;
      }>(url.toString());

      // CHANGE (M12 Step 7B):
      // Always use the freshest artifact returned by the history endpoint
      // for replay classification on reset. This avoids stale local artifact
      // affecting how assistant history is rendered.
      const historyArtifact = data.artifact ?? null;

      if (reset) {
        setSessionArtifact(historyArtifact);
        setArtifactUpdatedAt(data.artifactUpdatedAt ?? null);
        setWorkflowActionError(null);
      }

      let nextSessionMode = sessionMode;

      // CHANGE (M12 Step 7B):
      // Server mode remains informational, but mapped history now derives
      // its effective mode from artifact/content rather than trusting this
      // value alone.
      if (reset) {
        const serverMode = data.effectiveMode ?? data.sessionMode;
        if (serverMode) {
          nextSessionMode = serverMode;
        }
      }

      const { mapped, effectiveSessionMode } = mapHistoryItems({
        items: data.items,
        sessionMode: nextSessionMode,
        sessionArtifact: historyArtifact,
      });

      // BUG FIX (M12 Step 7D / Strategy+History triage):
      // History selection must restore the effective session mode into BOTH:
      // - activeSessionMode (workspace state)
      // - mode (visible rendered panel state)
      // Otherwise a Strategy session can be opened inside the Test Review shell.
      if (reset) {
        setActiveSessionMode(effectiveSessionMode);
        setMode(effectiveSessionMode);
      }

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
    setWorkflowActionError(null);

    setActiveSessionId(sessionId);

    // BUG FIX (M12 Step 7D / Strategy+History triage):
    // Do not force the caller-provided mode into visible UI state here.
    // The correct mode must be restored from persisted history/artifact state
    // inside loadSessionMessages(...).
    setActiveSessionMode(sessionMode);

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

  /*
  ---------------------------------------------------------
  SESSION CREATION / MODE CONTROL
  ---------------------------------------------------------
  */

  const newChat = () => {
    setModeLockMsg(null);
    setWorkflowActionError(null);

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
    setWorkflowActionError(null);

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
    setModeLockMsg(null);
    setMode(next);

    if (!activeSessionId) {
      setActiveSessionMode(next);
    }
  };

  /*
  ---------------------------------------------------------
  SESSION TITLE / DELETE
  ---------------------------------------------------------
  */

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
        setWorkflowActionError(null);
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

  /*
  ---------------------------------------------------------
  M12 STEP 4B: EDITABLE TEST SUITE PERSISTENCE
  ---------------------------------------------------------
  This provides a controlled mutation path for suite edits.
  UI components should call this method instead of mutating artifact state
  directly. The hook remains the orchestration layer.
  */

  const updateTestSuite = async (cases: TestCase[]) => {
    if (!activeSessionId) return;

    try {
      const nowIso = new Date().toISOString();

      const nextArtifact: SessionArtifact = {
        ...(sessionArtifact ?? {}),
        testSuite: {
          ...(sessionArtifact?.testSuite ?? {
            version: 1,
            createdAt: nowIso,
          }),
          cases,
          lastUpdatedAt: nowIso,
        },
      };

      // Optimistic local update so the workspace feels immediate.
      setSessionArtifact(nextArtifact);
      setArtifactUpdatedAt(nowIso);

      // BUG FIX (M12 Test Design triage):
      // Persist artifact updates to the existing session PATCH route.
      // There is no /artifact sub-route; using it causes HTML 404/login responses.
      await fetchJSON(`/api/chat/history/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact: nextArtifact,
        }),
      });

      // Refresh sidebar/session metadata after suite mutation.
      void loadSessions(true);
    } catch (err) {
      console.error("Failed to update test suite", err);
    }
  };

  /*
  ---------------------------------------------------------
  M12.9: WORKFLOW ACTIONS
  ---------------------------------------------------------
  Artifact-driven action entry points live here so the UI remains trigger-only.
  No freeform prompt reconstruction is allowed in this path.
  */

  const appendWorkflowActionError = (
    title: string,
    details: string,
    requestId: string
  ) => {
    setWorkflowActionError(details);
    setItems((prev) => [
      ...prev,
      {
        kind: "error",
        role: "bot",
        title,
        details,
        requestId,
      },
    ]);
  };

  const runWorkflowAction = async (action: WorkflowAction) => {
    const requestId = createRequestId();
    if (!requestId) return;

    setModeLockMsg(null);
    setWorkflowActionError(null);

    if (isSending || isRunningWorkflowAction) {
      appendWorkflowActionError(
        "Workflow action blocked",
        "Another request is already in progress.",
        requestId
      );
      return;
    }

    if (!activeSessionId) {
      appendWorkflowActionError(
        "Workflow action unavailable",
        "This action requires an existing session with persisted artifacts.",
        requestId
      );
      return;
    }

    if (action === "generate_tests_from_requirement" && !sessionArtifact?.refinedRequirement) {
      appendWorkflowActionError(
        "Generate Tests unavailable",
        "No refined requirement artifact is available for this session.",
        requestId
      );
      return;
    }

    setIsRunningWorkflowAction(true);

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
            // M12.9 CHANGE:
            // explicit artifact-driven action contract
            action,
            mode: "cases",
            sessionId: activeSessionId,
          }),
        }
      );

      const serverRequestId = headers.get("x-request-id") || requestId;
      setLastRequestId(serverRequestId);

      if (data?.rate) {
        setRate(data.rate);
      }

      const artifactPayload = readArtifactFromResponse(data);
      const nextArtifact = artifactPayload?.artifact ?? null;

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
        appendWorkflowActionError(
          "Session mode mismatch",
          `The backend rejected this request because it expected "${data.sessionMode}" but received "${data.requestedMode}".`,
          serverRequestId
        );
        return;
      }

      if (status === 429) {
        const details = `${
          data?.details ?? "Rate limit reached. Please try again shortly."
        } (requestId: ${serverRequestId})`;
        setRateLimitMsg(details);
        setWorkflowActionError(details);
        return;
      }

      if (status === 401) {
        appendWorkflowActionError(
          "Session expired",
          data?.details ??
            "Your sign-in session expired. Please sign in again and retry.",
          serverRequestId
        );
        return;
      }

      if (!(status >= 200 && status < 300) || data?.ok === false) {
        appendWorkflowActionError(
          `API Error ${status}`,
          JSON.stringify(data, null, 2),
          serverRequestId
        );
        return;
      }

      if (data?.sessionId && typeof data.sessionId === "string") {
        setActiveSessionId(data.sessionId);
        setPendingSessionClientId(null);
      }

      // M12.9 CHANGE:
      // Generate Tests must either produce a valid suite artifact,
      // or return an explicit system-level failure state.
      const reply = typeof data?.reply === "string" ? data.reply : "";
      const hasSuiteArtifact =
        !!nextArtifact?.testSuite &&
        Array.isArray(nextArtifact.testSuite.cases) &&
        nextArtifact.testSuite.cases.length > 0;

      const shouldRenderAsCasesText =
        hasSuiteArtifact || looksLikePersistedTestSuiteText(reply);

      if (!hasSuiteArtifact && !shouldRenderAsCasesText) {
        appendWorkflowActionError(
          "Generate Tests failed",
          "The action completed without producing a persisted test suite artifact or a valid suite response.",
          serverRequestId
        );
        return;
      }

      setMode("cases");
      setActiveSessionMode("cases");
      setRateLimitMsg(null);

      setItems((prev) => [
        ...prev,
        shouldRenderAsCasesText
          ? ({
              kind: "casesText",
              role: "bot",
              text: reply || "No reply returned",
              requestId: serverRequestId,
              ...(data?.workflowGuidance
                ? { workflowGuidance: data.workflowGuidance }
                : {}),
            } as ChatItem)
          : ({
              kind: "text",
              role: "bot",
              text: reply || "No reply returned",
              requestId: serverRequestId,
            } as ChatItem),
      ]);

      await loadSessions(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      setLastRequestId(requestId);
      appendWorkflowActionError(
        "Workflow action failed",
        message,
        requestId
      );
    } finally {
      setIsRunningWorkflowAction(false);
    }
  };

  const generateTestsFromRequirement = async () => {
    await runWorkflowAction("generate_tests_from_requirement");
  };

  /*
  ---------------------------------------------------------
  SEND FLOW
  ---------------------------------------------------------
  */

  const send = async (opts?: { replay?: boolean }) => {
    const replay = opts?.replay ?? false;

    const text = replay ? lastPending?.text ?? "" : input.trim();
    if (!text || isSending) return;

    const requestId = replay
      ? lastPending?.requestId ?? ""
      : createRequestId();
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

    const sessionClientIdForRequest = sessionIdForRequest
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
      setItems((prev) => [
        ...prev,
        { kind: "text", role: "user", text, requestId },
      ]);
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

      if (data?.rate) {
        setRate(data.rate);
      }

      const artifactPayload = readArtifactFromResponse(data);
      const nextArtifact = artifactPayload?.artifact ?? null;

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
            details:
              `The backend rejected this request because it expected "${data.sessionMode}" ` +
              `but received "${data.requestedMode}". Refresh the workspace state or start a new session if needed.`,
            requestId: serverRequestId,
          },
        ]);
        return;
      }

      if (status === 429) {
        setRateLimitMsg(
          `${
            data?.details ?? "Rate limit reached. Please try again shortly."
          } (requestId: ${serverRequestId})`
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
              data?.details ??
              "Your sign-in session expired. Please sign in again and retry.",
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
        const hasSuiteArtifact =
          !!nextArtifact?.testSuite &&
          Array.isArray(nextArtifact.testSuite.cases) &&
          nextArtifact.testSuite.cases.length > 0;

        const shouldRenderAsCasesText =
          hasSuiteArtifact || looksLikePersistedTestSuiteText(reply);

        setItems((prev) => [
          ...prev,
          shouldRenderAsCasesText
            ? ({
                kind: "casesText",
                role: "bot",
                text: reply || "No reply returned",
                requestId: serverRequestId,
                ...(data?.workflowGuidance
                  ? { workflowGuidance: data.workflowGuidance }
                  : {}),
              } as ChatItem)
            : ({
                kind: "text",
                role: "bot",
                text: reply || "No reply returned",
                requestId: serverRequestId,
              } as ChatItem),
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
          ...(effectiveMode === "coach" && suggestions
            ? { suggestions }
            : {}),
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

  /*
  ---------------------------------------------------------
  DERIVED SESSION STATE
  ---------------------------------------------------------
  */

  const latestCoachSuggestions: CoachSuggestions | null = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "text" && it.role === "bot" && hasSuggestions(it)) {
        return it.suggestions;
      }
    }
    return null;
  }, [items]);

  const isStrategySession = mode === "coach" && !!activeSessionId;
  const isTestDesignSession = mode === "cases" && !!activeSessionId;
  const isTestReviewSession = mode === "review" && !!activeSessionId;

  const hasPinnedRequirement = !!sessionArtifact?.refinedRequirement;

  const hasPersistentTestSuite =
    !!sessionArtifact?.testSuite &&
    Array.isArray(sessionArtifact.testSuite.cases);

  const hasReviewArtifact =
    artifactHasReviewSignal(sessionArtifact) ||
    items.some((it) => it.kind === "review" && it.role === "bot");

  // M12.9 CHANGE:
  // eligibility comes only from persisted artifact state + active session state
  const canGenerateTests =
    !!activeSessionId &&
    hasPinnedRequirement &&
    !isSending &&
    !isRunningWorkflowAction;

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

    isRunningWorkflowAction,
    workflowActionError,
    canGenerateTests,

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

    updateTestSuite,
    generateTestsFromRequirement,

    send,

    shouldAutoScrollRef,
  };
}