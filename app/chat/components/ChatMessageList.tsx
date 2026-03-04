// app/chat/components/ChatMessageList.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted chat message rendering from page.tsx (no behavior change).

"use client";

import React from "react";

import type { ChatItem, Mode, ReviewResult, CasesResult } from "../chat.types";

import ReviewCard from "../cards/ReviewCard";
import CasesTextCard from "../cards/CasesTextCard";
import CasesLegacyCard from "../cards/CasesLegacyCard";

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function looksLikeJson(s: string) {
  const t = String(s ?? "").trimStart();
  return t.startsWith("{") || t.startsWith("[");
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
          ? "Describe a feature. I’ll draft a risk-based approach + test ideas immediately (assumptions included), then ask up to 3 optional clarifications."
          : mode === "review"
            ? "Paste test cases or a test plan. I’ll return a score + breakdown + improvements."
            : "Describe the feature + acceptance criteria. I’ll generate STRICT plain-text Jira/Xray-ready test cases (no JSON)."}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {items.map((it, idx) => {
        if (it.kind === "text") {
          const isUser = it.role === "user";
          const textToShow =
            !isUser && looksLikeJson(it.text) ? tryFormatCoachJson(it.text) ?? it.text : it.text;

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
              <ReviewCard review={it.review as ReviewResult} />
              {it.requestId && (
                <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>
              )}
            </div>
          );
        }

        if (it.kind === "casesText") {
          return (
            <div key={idx} style={{ display: "grid", gap: 10 }}>
              <CasesTextCard text={it.text} />
              {it.requestId && (
                <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>
              )}
            </div>
          );
        }

        if (it.kind === "casesLegacy") {
          return (
            <div key={idx} style={{ display: "grid", gap: 10 }}>
              <CasesLegacyCard cases={it.cases as CasesResult} />
              {it.requestId && (
                <div style={{ fontSize: 10, opacity: 0.6, color: "#fff" }}>requestId: {it.requestId}</div>
              )}
            </div>
          );
        }

        // it.kind === "error"
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
  );
}