// app/chat/components/ChatMessageList.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted chat message rendering from page.tsx (no behavior change).
//
// CHANGE (M8.9 Copy Actions Cleanup):
// - removes duplicate wrapper-level copy buttons
// - relies on card-native copy actions where available
// - keeps rendering behavior clean and consistent
//
// CHANGE (M9):
// - small UI polish for evolving test suite sessions
// - clearer empty-state wording for persistent Cases mode
// - lightweight detection of "Test Suite vX" plain-text responses

"use client";

import React from "react";

import type { ChatItem, Mode, ReviewResult, CasesResult } from "../chat.types";

import ReviewCard from "../cards/ReviewCard";
import CasesTextCard from "../cards/CasesTextCard";
import CasesLegacyCard from "../cards/CasesLegacyCard";
import RequirementCard from "../cards/RequirementCard";

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function looksLikeJson(s: string) {
  const t = String(s ?? "").trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

/**
 * M9 CHANGE:
 * Detect the rendered evolving-suite response shape returned by the backend:
 *
 * Test Suite v2
 * Total test cases: 5
 */
function looksLikePersistedTestSuiteText(s: string): boolean {
  const t = String(s ?? "").trim();
  return /^Test Suite v\d+\s*\nTotal test cases:\s*\d+/i.test(t);
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

export default function ChatMessageList({ items, mode }: { items: ChatItem[]; mode: Mode }) {
  if (items.length === 0) {
    return (
      <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 1.55 }}>
        {mode === "coach"
          ? "Describe a feature. I’ll draft a risk-based approach + test ideas immediately, then refine the requirement as the session evolves."
          : mode === "review"
            ? "Paste test cases or a test plan. I’ll return a score, breakdown, and prioritized improvements."
            : "Describe the feature or use the Refined Requirement. I’ll generate a persistent plain-text test suite that can evolve across this session."}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {items.map((it, idx) => {
        const rolePart =
          it.kind === "text" ||
          it.kind === "review" ||
          it.kind === "casesText" ||
          it.kind === "casesLegacy" ||
          it.kind === "error"
            ? it.role
            : "item";

        const reqPart = it.requestId ?? "no-rid";
        const key = `${it.kind}-${rolePart}-${reqPart}-${idx}`;

        // ---------------- TEXT ----------------
        if (it.kind === "text") {
          const isUser = it.role === "user";

          const textToShow =
            !isUser && mode === "coach" && looksLikeJson(it.text)
              ? tryFormatCoachJson(it.text) ?? it.text
              : it.text;

          const isRequirement =
            !isUser &&
            mode === "coach" &&
            typeof textToShow === "string" &&
            textToShow.startsWith("Refined Technical Requirement");

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                {isRequirement ? (
                  <div style={{ width: "100%", maxWidth: "100%" }}>
                    <RequirementCard text={textToShow} />
                  </div>
                ) : (
                  <div
                    style={{
                      maxWidth: "78%",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      padding: 16,
                      background: isUser ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {textToShow}

                    {it.requestId && (
                      <div style={{ marginTop: 10, fontSize: 10, opacity: 0.55 }}>
                        requestId: {it.requestId.slice(0, 8)}…
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isRequirement && it.requestId ? (
                <div style={{ fontSize: 10, opacity: 0.55, color: "#fff" }}>
                  requestId: {it.requestId.slice(0, 8)}…
                </div>
              ) : null}
            </div>
          );
        }

        // ---------------- REVIEW ----------------
        if (it.kind === "review") {
          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <ReviewCard review={it.review as ReviewResult} />
            </div>
          );
        }

        // ---------------- CASES TEXT ----------------
        if (it.kind === "casesText") {
          const isPersistedSuite = looksLikePersistedTestSuiteText(it.text);

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              {isPersistedSuite ? (
                <div style={{ fontSize: 11, opacity: 0.66, color: "#fff" }}>
                  Persistent suite workspace
                </div>
              ) : null}

              <CasesTextCard text={it.text} />
            </div>
          );
        }

        // ---------------- LEGACY CASES ----------------
        if (it.kind === "casesLegacy") {
          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <CasesLegacyCard cases={it.cases as CasesResult} />
            </div>
          );
        }

        // ---------------- ERROR ----------------
        if (it.kind === "error") {
          return (
            <div
              key={key}
              style={{
                border: "1px solid rgba(255,80,200,0.55)",
                borderRadius: 16,
                padding: 16,
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 10 }}>{it.title}</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.45 }}>
                {it.details}
              </pre>
            </div>
          );
        }

        return (
          <div key={key} style={{ fontSize: 12, opacity: 0.7 }}>
            Unknown message type
          </div>
        );
      })}
    </div>
  );
}