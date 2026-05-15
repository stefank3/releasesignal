// app/chat/hooks/useChatSession.artifacts.ts
// M18.7b:
// Artifact-safety helper extraction from useChatSession.
// Keep timestamp freshness and stale-review cleanup outside the main hook
// without changing artifact truth, workflow behavior, or persisted contracts.

import type { ChatItem, SessionArtifact } from "../chat.types";
import { artifactHasReviewSignal } from "./useChatSession.helpers";

const STALE_REVIEW_HISTORY_TEXT =
  "Previous review result kept in chat history. It is no longer the current persisted review artifact for this workspace.";

export function shouldApplyIncomingArtifact(args: {
  currentArtifactUpdatedAt: string | null;
  incomingArtifactUpdatedAt: string | null;
}): boolean {
  const { currentArtifactUpdatedAt, incomingArtifactUpdatedAt } = args;

  if (!currentArtifactUpdatedAt) {
    return true;
  }

  if (!incomingArtifactUpdatedAt) {
    return false;
  }

  const currentMs = Date.parse(currentArtifactUpdatedAt);
  const incomingMs = Date.parse(incomingArtifactUpdatedAt);

  if (Number.isNaN(currentMs) || Number.isNaN(incomingMs)) {
    return incomingArtifactUpdatedAt >= currentArtifactUpdatedAt;
  }

  return incomingMs >= currentMs;
}

/**
 * M12.18:
 * Reset-time history replay may still contain old review chat items.
 * Those are valid as history, but when no persisted review artifact exists
 * they must not keep rendering as the current/latest review workspace state.
 *
 * We downgrade them to plain text history items so chat continuity remains
 * visible without letting old review cards impersonate artifact truth.
 */
export function pruneStaleReviewItems(args: {
  mapped: ChatItem[];
  effectiveHistoryArtifact: SessionArtifact | null;
}): ChatItem[] {
  const hasPersistedReviewArtifact = artifactHasReviewSignal(
    args.effectiveHistoryArtifact
  );

  if (hasPersistedReviewArtifact) {
    return args.mapped;
  }

  return args.mapped.map((item) => {
    if (item.kind !== "review" || item.role !== "bot") {
      return item;
    }

    return {
      kind: "text",
      role: "bot",
      text: STALE_REVIEW_HISTORY_TEXT,
      requestId: item.requestId,
    } as ChatItem;
  });
}

/**
 * M12.18:
 * Apply the same stale-review cleanup immediately during live session updates.
 * This prevents the user from needing a refresh before the old review stops
 * appearing as current state after a material requirement change.
 */
export function pruneLiveStaleReviewItems(args: {
  items: ChatItem[];
  nextArtifact: SessionArtifact | null;
}): ChatItem[] {
  const hasPersistedReviewArtifact = artifactHasReviewSignal(args.nextArtifact);

  if (hasPersistedReviewArtifact) {
    return args.items;
  }

  return args.items.map((item) => {
    if (item.kind !== "review" || item.role !== "bot") {
      return item;
    }

    return {
      kind: "text",
      role: "bot",
      text: STALE_REVIEW_HISTORY_TEXT,
      requestId: item.requestId,
    } as ChatItem;
  });
}