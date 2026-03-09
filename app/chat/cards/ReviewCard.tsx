// app/chat/cards/ReviewCard.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted ReviewCard + helpers from page.tsx (no behavior change).
//
// CHANGE (M8.11 Review Empty State):
// - detect "no tests provided" / empty review scenarios
// - show a guided empty state instead of a misleading scored review card
// - direct the user to paste test cases into the input box
// - keep normal review rendering unchanged for valid reviews

"use client";

import React, { useEffect, useState } from "react";
import type { ReviewResult } from "../chat.types";
import { clamp } from "../components/ChatUI";

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

/** Convert review result to Markdown so it can be pasted into Jira/Confluence. */
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

function reviewToJson(r: ReviewResult) {
  return JSON.stringify(r, null, 2);
}

/** Small button used inside cards (Copy MD / Copy JSON). */
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
 * M8.11:
 * Detects "empty review" scenarios returned by the backend when the user did not
 * actually paste a test suite for evaluation.
 */
function isEmptyReview(review: ReviewResult): boolean {
  const verdict = String(review.verdict ?? "").toLowerCase().trim();

  return (
    review.score === 0 &&
    review.breakdown.businessRelevance === 0 &&
    review.breakdown.riskCoverage === 0 &&
    review.breakdown.designQuality === 0 &&
    review.breakdown.levelAndScope === 0 &&
    review.breakdown.diagnosticValue === 0 &&
    (verdict.includes("no tests provided") || verdict.includes("no test cases provided"))
  );
}

function ReviewEmptyState() {
  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
        boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
        color: "#111",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: 0.2 }}>Paste Test Cases to Review</div>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.5 }}>
          Test Review evaluates an existing test suite and returns a coverage score, risk gaps, anti-patterns, and
          prioritized improvements.
        </div>
      </div>

      <div
        style={{
          border: "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
          background: "#fafafa",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "#333" }}>What to do next</div>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.45 }}>
          • Paste test cases to review (from Test Design or your existing suite)
          <br />
          • Then send the request again to generate the review
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.45 }}>
        Tip: Generate a suite in <strong>Test Design</strong> and paste it here for evaluation.
      </div>
    </div>
  );
}

export default function ReviewCard({ review }: { review: ReviewResult }) {
  if (isEmptyReview(review)) {
    return <ReviewEmptyState />;
  }

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
        border: "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
        boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
        color: "#111",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: 0.2 }}>Review Score</div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.45 }}>{review.verdict}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
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
              padding: "9px 12px",
              background: "#111",
              color: "#fff",
              fontWeight: 950,
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
            marginTop: 12,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #e6e6e6",
            background: "#fff",
            color: "#111",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ marginTop: 16, borderTop: "1px solid #f1f1f1" }} />

      <div
        style={{
          marginTop: 16,
          border: "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
          background: "#fafafa",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "#333" }}>Breakdown</div>
        <BarRow label="Business relevance" value={review.breakdown.businessRelevance} max={25} />
        <BarRow label="Risk coverage" value={review.breakdown.riskCoverage} max={25} />
        <BarRow label="Design quality" value={review.breakdown.designQuality} max={20} />
        <BarRow label="Level & scope" value={review.breakdown.levelAndScope} max={15} />
        <BarRow label="Diagnostic value" value={review.breakdown.diagnosticValue} max={15} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 16 }}>
        <div style={{ border: "1px solid #f0f0f0", borderRadius: 16, padding: 14, background: "#fff" }}>
          <Section title="Top risk gaps" items={review.riskGaps} />
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 16, padding: 14, background: "#fff" }}>
          <Section title="Anti-patterns" items={review.antiPatterns} />
        </div>

        <div style={{ border: "1px solid #f0f0f0", borderRadius: 16, padding: 14, background: "#fff" }}>
          <Section title="Prioritized improvements" items={review.improvements} />
        </div>
      </div>
    </div>
  );
}