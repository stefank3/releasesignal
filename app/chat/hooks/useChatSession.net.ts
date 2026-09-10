// app/chat/hooks/useChatSession.net.ts
"use client";

import type { SessionArtifact } from "../chat.types";

export const CREDIT_BALANCE_EVENT = "release-signal:credit-balance";

type CreditBalanceEventDetail = {
  creditsRemaining: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function publishAuthoritativeCreditBalance(data: unknown) {
  if (typeof window === "undefined" || !isRecord(data)) return;

  const creditsRemaining = data["creditsRemaining"];
  if (typeof creditsRemaining !== "number" || !Number.isFinite(creditsRemaining)) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CreditBalanceEventDetail>(CREDIT_BALANCE_EVENT, {
      detail: { creditsRemaining: Math.max(0, creditsRemaining) },
    })
  );
}

export function readArtifactFromResponse(
  data: unknown
): { artifact: SessionArtifact | null; artifactUpdatedAt: string | null } | null {
  if (!isRecord(data)) return null;

  const hasArtifactField = "artifact" in data || "artifactUpdatedAt" in data;
  if (!hasArtifactField) return null;

  const artifact = (data["artifact"] ?? null) as SessionArtifact | null;
  const artifactUpdatedAt =
    typeof data["artifactUpdatedAt"] === "string" ? data["artifactUpdatedAt"] : null;

  return { artifact, artifactUpdatedAt };
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createSessionClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function fetchJSONWithMeta<T>(
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

  const looksJson =
    ct.includes("application/json") ||
    first.startsWith("{") ||
    first.startsWith("[");

  if (!looksJson) {
    const hint = looksHtml
      ? "Expected JSON but got HTML (redirect/login/error page)"
      : "Expected JSON but got non-JSON";
    throw new Error(
      `${hint} (HTTP ${res.status}). content-type=${ct || "(none)"} first=${first}`
    );
  }

  const data = text ? (JSON.parse(text) as unknown) : ({} as unknown);

  // PR7:
  // Any chat response that carries a server-owned credit snapshot can refresh
  // the visible account balance immediately. This covers successful charges,
  // insufficient-credit 402 responses from stale tabs, and replay responses.
  // The client never calculates the balance; it only propagates server truth.
  publishAuthoritativeCreditBalance(data);

  return { status: res.status, headers: res.headers, data: data as T };
}

export async function fetchJSON<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const { status, data } = await fetchJSONWithMeta<T>(input, init);
  if (status >= 200 && status < 300) return data;

  const err = (data as { error?: string })?.error;
  throw new Error(err || `HTTP ${status}`);
}
