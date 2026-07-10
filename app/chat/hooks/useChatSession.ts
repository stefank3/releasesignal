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
// - add artifact-driven workflow action contract for Review Test Suite
// - expose deterministic action eligibility from artifact state
// - keep UI trigger-only; execution stays in hook
// - return explicit action failure state when no suite/review is produced
//
// M12.9 Phase 2 CHANGE:
// - add artifact-driven workflow action contract for Generate Next Batch
// - require refined requirement + persisted suite for next-batch execution
// - add artifact-driven workflow action contract for Refine Requirement
// - add artifact-driven workflow action contract for Improve / Regenerate Suite
// - keep action execution separate from freeform send() flow
//
// M12.9 Phase 2 FIX:
// - prevent stale history payloads from overwriting a newer saved artifact
// - keep PATCH response as authoritative after editable suite save
// - guard reset-time rehydration using artifactUpdatedAt
// - avoid immediate post-save full history reset reload that can re-pin stale suite state
//
// M12.14 CHANGE:
// - keep classification-aware execution artifact rehydration flowing through the existing artifact path
// - do not introduce client-owned failure-classification logic
// - preserve execution/classification state whenever artifact payloads are accepted
//
// M12.15 CHANGE:
// - keep release-health artifact rehydration flowing through the existing artifact path
// - do not introduce client-owned release-health logic
// - preserve release-health state whenever artifact payloads are accepted
//
// M12.18 CHANGE:
// - current review state must come from persisted artifact only
// - old review chat items must not promote themselves into latest artifact state
// - prune stale review cards from reset-time history mapping when persisted review artifact is absent
// - prune stale review cards immediately in-session when requirement refinement invalidates the persisted review artifact

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { TestCase } from "@/lib/chat/artifact";

import {
  pruneLiveStaleReviewItems,
  pruneStaleReviewItems,
  shouldApplyIncomingArtifact,
} from "./useChatSession.artifacts";

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
const LAST_AUTH0_SUB_KEY = "stefans-mvp-chat-last-auth0-sub-v1";

type MeIdentityResponse =
  | { authenticated: true; auth0Sub: string }
  | { authenticated: false };

type IdentityResolution =
  | { status: "authenticated"; auth0Sub: string }
  | { status: "unauthenticated" }
  | { status: "unknown" };

type WorkflowAction =
  | "generate_tests_from_requirement"
  | "generate_next_batch_of_tests"
  | "review_test_suite"
  | "refine_requirement"
  | "regenerate_suite";

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
  canReviewTestSuite: boolean;
  canGenerateNextBatch: boolean;
  canRefineRequirement: boolean;
  canRegenerateSuite: boolean;

  generateNextBatchOfTests: () => Promise<boolean>;
  refineRequirement: () => Promise<boolean>;
  regenerateSuite: () => Promise<boolean>;

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
  applyExecutionEvidenceUpload: (args: {
    executionIntelligence: NonNullable<SessionArtifact["executionIntelligence"]>;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => void;

  // M12.9 CHANGE:
  // artifact-driven workspace action paths
  generateTestsFromRequirement: () => Promise<boolean>;
  reviewTestSuite: () => Promise<boolean>;

  send: (opts?: { replay?: boolean }) => Promise<boolean>;

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

  const currentSessionArtifactRef = useRef<SessionArtifact | null>(null);
  const currentArtifactUpdatedAtRef = useRef<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    currentSessionArtifactRef.current = sessionArtifact;
  }, [sessionArtifact]);

  useEffect(() => {
    currentArtifactUpdatedAtRef.current = artifactUpdatedAt;
  }, [artifactUpdatedAt]);

  /*
  ---------------------------------------------------------
  LOCAL PERSISTENCE
  ---------------------------------------------------------
  */

  const resetUserScopedWorkspaceState = () => {
    setMode("coach");
    setInput("");
    setItems([]);
    setActiveSessionId(null);
    setActiveSessionMode("coach");
    setPendingSessionClientId(null);
    setMessagesCursor(null);
    setRate(null);
    setRateLimitMsg(null);
    setLastRequestId(null);
    setModeLockMsg(null);
    setLastPending(null);
    setSessions([]);
    setSessionsCursor(null);
    setRenamingId(null);
    setRenameValue("");
    setDeletingId(null);
    setSessionArtifact(null);
    setArtifactUpdatedAt(null);
    setWorkflowActionError(null);
  };

  const resolveCurrentIdentity = async (
    signal: AbortSignal
  ): Promise<IdentityResolution> => {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
        signal,
      });

      if (!res.ok) {
        return { status: "unknown" };
      }

      const me = (await res.json()) as MeIdentityResponse;

      if (me.authenticated) {
        return { status: "authenticated", auth0Sub: me.auth0Sub };
      }

      return { status: "unauthenticated" };
    } catch {
      return { status: "unknown" };
    }
  };

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
    const controller = new AbortController();

    (async () => {
      const identity = await resolveCurrentIdentity(controller.signal);

      if (controller.signal.aborted) return;

      if (identity.status === "unknown") {
        resetUserScopedWorkspaceState();
        return;
      }

      try {
        if (identity.status === "unauthenticated") {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LAST_AUTH0_SUB_KEY);
          resetUserScopedWorkspaceState();
          setIdentityReady(true);
          return;
        }

        const lastSeenAuth0Sub = localStorage.getItem(LAST_AUTH0_SUB_KEY);
        const auth0SubChanged =
          !!lastSeenAuth0Sub && lastSeenAuth0Sub !== identity.auth0Sub;

        if (auth0SubChanged) {
          localStorage.removeItem(STORAGE_KEY);
          resetUserScopedWorkspaceState();
        }

        localStorage.setItem(LAST_AUTH0_SUB_KEY, identity.auth0Sub);

        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed?.mode) setMode(parsed.mode);
      } catch (e) {
        if (!controller.signal.aborted) {
          localStorage.removeItem(STORAGE_KEY);
          resetUserScopedWorkspaceState();
        }
      } finally {
        if (!controller.signal.aborted) {
          setIdentityReady(true);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!identityReady) return;

    try {
      const payload: PersistedState = { mode, items: [], input: "" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [identityReady, mode]);

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
    if (!identityReady) return;

    void loadSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityReady]);

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

      const historyArtifact = data.artifact ?? null;
      const historyArtifactUpdatedAt = data.artifactUpdatedAt ?? null;

      const shouldApplyHistoryArtifact = reset
        ? shouldApplyIncomingArtifact({
            currentArtifactUpdatedAt: currentArtifactUpdatedAtRef.current,
            incomingArtifactUpdatedAt: historyArtifactUpdatedAt,
          })
        : true;

      const effectiveHistoryArtifact =
        reset && !shouldApplyHistoryArtifact
          ? currentSessionArtifactRef.current
          : historyArtifact;

      const effectiveHistoryArtifactUpdatedAt =
        reset && !shouldApplyHistoryArtifact
          ? currentArtifactUpdatedAtRef.current
          : historyArtifactUpdatedAt;

      if (reset) {
        // M12.14 / M12.15:
        // Classification-aware execution state and release-health state stay
        // inside the artifact. Rehydration remains timestamp-guarded and
        // artifact-owned.
        setSessionArtifact(effectiveHistoryArtifact);
        setArtifactUpdatedAt(effectiveHistoryArtifactUpdatedAt);
        setWorkflowActionError(null);
      }

      let nextSessionMode = sessionMode;

      if (reset) {
        const serverMode = data.effectiveMode ?? data.sessionMode;
        if (serverMode) {
          nextSessionMode = serverMode;
        }
      }

      const { mapped } = mapHistoryItems({
        items: data.items,
        sessionMode: nextSessionMode,
        sessionArtifact: effectiveHistoryArtifact,
      });

      const nextMappedItems = reset
        ? pruneStaleReviewItems({
            mapped,
            effectiveHistoryArtifact,
          })
        : mapped;

      if (reset) {
        // BUG FIX (M12.10):
        // Preserve the selected/restored visible mode for the workspace.
        setActiveSessionMode(sessionMode);
        setMode(sessionMode);
      }

      setItems((prev) => (reset ? nextMappedItems : [...nextMappedItems, ...prev]));
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

      // M12.14 / M12.15:
      // Keep existing execution/classification state and release-health state
      // intact when suite edits are saved.
      setSessionArtifact(nextArtifact);
      setArtifactUpdatedAt(nowIso);

      const data = await fetchJSON<{
        ok: boolean;
        artifact?: SessionArtifact | null;
        artifactUpdatedAt?: string | null;
      }>(`/api/chat/history/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact: nextArtifact,
        }),
      });

      if (data?.artifact) {
        setSessionArtifact(data.artifact);
        setArtifactUpdatedAt(data.artifactUpdatedAt ?? nowIso);
      }

      void loadSessions(true);
    } catch (err) {
      console.error("Failed to update test suite", err);
    }
  };

  const applyExecutionEvidenceUpload = (args: {
    executionIntelligence: NonNullable<SessionArtifact["executionIntelligence"]>;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => {
    const nextUpdatedAt = args.artifactUpdatedAt ?? new Date().toISOString();

    setSessionArtifact((prev) => {
      const baseArtifact = args.artifact ?? prev ?? {};
      const { releaseHealth: _staleReleaseHealth, ...artifactWithoutHealth } =
        baseArtifact;

      return {
        ...artifactWithoutHealth,
        executionIntelligence: args.executionIntelligence,
      };
    });
    setArtifactUpdatedAt(nextUpdatedAt);
  };

  /*
  ---------------------------------------------------------
  M12.9: WORKFLOW ACTIONS
  ---------------------------------------------------------
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

  const shouldRefreshCreditsFromResponse = (data: ChatApiResponse) =>
    typeof data?.creditsRemaining === "number";

  const buildCreditAccessErrorMessage = (data: ChatApiResponse) => {
    if (data?.error === "Insufficient credits") {
      return "You do not have enough Release Signal credits to complete this action.";
    }

    if (data?.error === "Account access required") {
      switch (data.reason) {
        case "wallet_missing":
          return "Your Release Signal credit wallet is unavailable. Please try again shortly or contact support.";
        case "insufficient_credits":
          return "You do not have enough Release Signal credits to complete this action.";
        case "trial_expired":
          return "Your Release Signal trial has expired.";
        case "subscription_expired":
          return "Your Release Signal subscription period has expired.";
        case "subscription_inactive":
          return "Your Release Signal subscription is not active.";
        case "subscription_missing":
          return "Your Release Signal account is not ready for billable actions.";
        default:
          return "Your Release Signal account cannot complete this billable action right now.";
      }
    }

    return "You do not have enough Release Signal credits to complete this action.";
  };

  const runWorkflowAction = async (action: WorkflowAction): Promise<boolean> => {
    const requestId = createRequestId();
    if (!requestId) return false;

    setModeLockMsg(null);
    setWorkflowActionError(null);

    if (isSending || isRunningWorkflowAction) {
      appendWorkflowActionError(
        "Workflow action blocked",
        "Another request is already in progress.",
        requestId
      );
      return false;
    }

    if (!activeSessionId) {
      appendWorkflowActionError(
        "Workflow action unavailable",
        "This action requires an existing session with persisted artifacts.",
        requestId
      );
      return false;
    }

    if (
      (action === "generate_tests_from_requirement" ||
        action === "refine_requirement") &&
      !sessionArtifact?.refinedRequirement
    ) {
      appendWorkflowActionError(
        action === "refine_requirement"
          ? "Refine Requirement unavailable"
          : "Generate Tests unavailable",
        "No refined requirement artifact is available for this session.",
        requestId
      );
      return false;
    }

    if (
      (action === "generate_next_batch_of_tests" ||
        action === "regenerate_suite") &&
      !(
        sessionArtifact?.refinedRequirement &&
        sessionArtifact?.testSuite &&
        Array.isArray(sessionArtifact.testSuite.cases) &&
        sessionArtifact.testSuite.cases.length > 0
      )
    ) {
      appendWorkflowActionError(
        action === "regenerate_suite"
          ? "Improve Test Plan unavailable"
          : "Generate Next Batch unavailable",
        "This action requires both a refined requirement artifact and a persisted test suite artifact.",
        requestId
      );
      return false;
    }

    if (
      action === "review_test_suite" &&
      !(
        sessionArtifact?.testSuite &&
        Array.isArray(sessionArtifact.testSuite.cases) &&
        sessionArtifact.testSuite.cases.length > 0
      )
    ) {
      appendWorkflowActionError(
        "Review Test Suite unavailable",
        "No persisted test suite artifact is available for this session.",
        requestId
      );
      return false;
    }

    setIsRunningWorkflowAction(true);

    try {
      const requestedMode: Mode =
        action === "review_test_suite"
          ? "review"
          : action === "refine_requirement"
            ? "coach"
            : "cases";

      const { status, headers, data } = await fetchJSONWithMeta<ChatApiResponse>(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
          body: JSON.stringify({
            action,
            mode: requestedMode,
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
        // M12.14 / M12.15:
        // Classification-aware execution data and release-health data enter
        // client state through the same authoritative artifact response path
        // as all other persisted state.
        setSessionArtifact(artifactPayload.artifact);
        setArtifactUpdatedAt(artifactPayload.artifactUpdatedAt);

        // M12.18:
        // Apply live stale-review cleanup as soon as the authoritative artifact
        // says no persisted review exists.
        setItems((prev) =>
          pruneLiveStaleReviewItems({
            items: prev,
            nextArtifact: artifactPayload.artifact,
          })
        );
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
        return false;
      }

      if (status === 429) {
        const details = `${
          data?.details ?? "Rate limit reached. Please try again shortly."
        } (requestId: ${serverRequestId})`;
        setRateLimitMsg(details);
        setWorkflowActionError(details);
        return false;
      }

      if (status === 401) {
        appendWorkflowActionError(
          "Session expired",
          data?.details ??
            "Your sign-in session expired. Please sign in again and retry.",
          serverRequestId
        );
        return false;
      }

      if (status === 402) {
        appendWorkflowActionError(
          data?.error === "Account access required"
            ? "Release Signal account access required"
            : "Not enough Release Signal credits",
          buildCreditAccessErrorMessage(data),
          serverRequestId
        );
        return false;
      }

      if (!(status >= 200 && status < 300) || data?.ok === false) {
        appendWorkflowActionError(
          `API Error ${status}`,
          JSON.stringify(data, null, 2),
          serverRequestId
        );
        return false;
      }

      const shouldRefreshCredits = shouldRefreshCreditsFromResponse(data);

      if (data?.sessionId && typeof data.sessionId === "string") {
        setActiveSessionId(data.sessionId);
        setPendingSessionClientId(null);
      }

      const reply = typeof data?.reply === "string" ? data.reply : "";

      if (action === "generate_tests_from_requirement") {
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
          return false;
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
        return shouldRefreshCredits;
      }

      if (action === "generate_next_batch_of_tests") {
        const hasSuiteArtifact =
          !!nextArtifact?.testSuite &&
          Array.isArray(nextArtifact.testSuite.cases) &&
          nextArtifact.testSuite.cases.length > 0;

        const shouldRenderAsCasesText =
          hasSuiteArtifact || looksLikePersistedTestSuiteText(reply);

        if (!hasSuiteArtifact && !shouldRenderAsCasesText) {
          appendWorkflowActionError(
            "Generate Next Batch failed",
            "The action completed without producing a persisted test suite artifact or a valid suite response.",
            serverRequestId
          );
          return false;
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
        return shouldRefreshCredits;
      }

      if (action === "regenerate_suite") {
        const hasSuiteArtifact =
          !!nextArtifact?.testSuite &&
          Array.isArray(nextArtifact.testSuite.cases) &&
          nextArtifact.testSuite.cases.length > 0;

        const shouldRenderAsCasesText =
          hasSuiteArtifact || looksLikePersistedTestSuiteText(reply);

        if (!hasSuiteArtifact && !shouldRenderAsCasesText) {
          appendWorkflowActionError(
            "Improve Test Plan failed",
            "The action completed without producing a persisted test suite artifact or a valid suite response.",
            serverRequestId
          );
          return false;
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
        return shouldRefreshCredits;
      }

      if (action === "refine_requirement") {
        const hasRequirementArtifact = !!nextArtifact?.refinedRequirement;
        const shouldRenderAsRequirementText =
          hasRequirementArtifact || looksLikeRefinedRequirementText(reply);

        if (!hasRequirementArtifact && !shouldRenderAsRequirementText) {
          appendWorkflowActionError(
            "Refine Requirement failed",
            "The action completed without producing an updated refined requirement artifact or recognizable requirement output.",
            serverRequestId
          );
          return false;
        }

        setMode("coach");
        setActiveSessionMode("coach");
        setRateLimitMsg(null);

        setItems((prev) => [
          ...prev,
          {
            kind: "text",
            role: "bot",
            text: reply || "No reply returned",
            requestId: serverRequestId,
          } as ChatItem,
        ]);

        await loadSessions(true);
        return shouldRefreshCredits;
      }

      if (action === "review_test_suite") {
        const hasReviewPayload = !!data?.review;
        const hasReviewArtifact = artifactHasReviewSignal(nextArtifact);

        if (!hasReviewPayload && !hasReviewArtifact) {
          appendWorkflowActionError(
            "Review Test Suite failed",
            "The action completed without producing a review result artifact or review payload.",
            serverRequestId
          );
          return false;
        }

        setMode("review");
        setActiveSessionMode("review");
        setRateLimitMsg(null);

        if (hasReviewPayload) {
          setItems((prev) => [
            ...prev,
            {
              kind: "review",
              role: "bot",
              review: data.review as ReviewResult,
              requestId: serverRequestId,
            },
          ]);
        } else {
          setItems((prev) => [
            ...prev,
            {
              kind: "text",
              role: "bot",
              text: reply || "Review completed.",
              requestId: serverRequestId,
            } as ChatItem,
          ]);
        }

        await loadSessions(true);
        return shouldRefreshCredits;
      }

      return false;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      setLastRequestId(requestId);
      appendWorkflowActionError("Workflow action failed", message, requestId);
      return false;
    } finally {
      setIsRunningWorkflowAction(false);
    }
  };

  const generateTestsFromRequirement = async () => {
    return runWorkflowAction("generate_tests_from_requirement");
  };

  const generateNextBatchOfTests = async () => {
    return runWorkflowAction("generate_next_batch_of_tests");
  };

  const refineRequirement = async () => {
    return runWorkflowAction("refine_requirement");
  };

  const regenerateSuite = async () => {
    return runWorkflowAction("regenerate_suite");
  };

  const reviewTestSuite = async () => {
    return runWorkflowAction("review_test_suite");
  };

  /*
  ---------------------------------------------------------
  SEND FLOW
  ---------------------------------------------------------
  */

  const send = async (opts?: { replay?: boolean }): Promise<boolean> => {
    const replay = opts?.replay ?? false;

    const text = replay ? lastPending?.text ?? "" : input.trim();
    if (!text || isSending) return false;

    const requestId = replay
      ? lastPending?.requestId ?? ""
      : createRequestId();
    if (!requestId) return false;

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
      return false;
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
        // M12.14 / M12.15:
        // Reuse the existing authoritative artifact response path so execution
        // classification state and release-health state rehydrate exactly like
        // requirement/suite/review state.
        setSessionArtifact(artifactPayload.artifact);
        setArtifactUpdatedAt(artifactPayload.artifactUpdatedAt);

        // M12.18:
        // Apply live stale-review cleanup for freeform coach refinements too.
        setItems((prev) =>
          pruneLiveStaleReviewItems({
            items: prev,
            nextArtifact: artifactPayload.artifact,
          })
        );
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
        return false;
      }

      if (status === 429) {
        setRateLimitMsg(
          `${
            data?.details ?? "Rate limit reached. Please try again shortly."
          } (requestId: ${serverRequestId})`
        );
        return false;
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
        return false;
      }

      if (status === 402) {
        setItems((prev) => [
          ...prev,
          {
            kind: "error",
            role: "bot",
            title:
              data?.error === "Account access required"
                ? "Release Signal account access required"
                : "Not enough Release Signal credits",
            details: buildCreditAccessErrorMessage(data),
            requestId: serverRequestId,
          },
        ]);
        return false;
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
        return false;
      }

      const shouldRefreshCredits = shouldRefreshCreditsFromResponse(data);

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
        return shouldRefreshCredits;
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
        return shouldRefreshCredits;
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
        return shouldRefreshCredits;
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
      return shouldRefreshCredits;
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
      return false;
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

  // M12.18:
  // Current workspace truth must come from persisted artifact state only.
  // Historical review chat items must not re-create current review state.
  const hasReviewArtifact = artifactHasReviewSignal(sessionArtifact);

  const canGenerateTests =
    !!activeSessionId &&
    hasPinnedRequirement &&
    !isSending &&
    !isRunningWorkflowAction;

  const canGenerateNextBatch =
    !!activeSessionId &&
    hasPinnedRequirement &&
    hasPersistentTestSuite &&
    !isSending &&
    !isRunningWorkflowAction;

  const canRefineRequirement =
    !!activeSessionId &&
    hasPinnedRequirement &&
    !isSending &&
    !isRunningWorkflowAction;

  const canRegenerateSuite =
    !!activeSessionId &&
    hasPinnedRequirement &&
    hasPersistentTestSuite &&
    !isSending &&
    !isRunningWorkflowAction;

  const canReviewTestSuite =
    !!activeSessionId &&
    hasPersistentTestSuite &&
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
    canReviewTestSuite,
    canGenerateNextBatch,
    canRefineRequirement,
    canRegenerateSuite,

    generateNextBatchOfTests,
    refineRequirement,
    regenerateSuite,

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
    applyExecutionEvidenceUpload,
    generateTestsFromRequirement,
    reviewTestSuite,

    send,

    shouldAutoScrollRef,
  };
}
