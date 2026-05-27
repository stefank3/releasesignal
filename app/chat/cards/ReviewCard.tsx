// app/chat/cards/ReviewCard.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted ReviewCard + helpers from page.tsx (no behavior change).
//
// CHANGE (M8.11 Review Empty State):
// - detect "no tests provided" / empty review scenarios
// - show a guided empty state instead of a misleading scored review card
// - direct the user to paste test cases into the input box
// - keep normal review rendering unchanged for valid reviews
//
// CHANGE (M10 UI Pass):
// - add theme-aware rendering
// - support light / dark / system theme via resolvedTheme prop
// - keep review visualization structure unchanged
//
// M12.10 CHANGE:
// - separate review actions from score summary and findings
// - make the current review result easier to scan in long sessions
// - align review card structure with requirement and suite cards
// - preserve existing review rendering behavior and empty-state handling

"use client";

import React, { useEffect, useState } from "react";
import type { ReviewResult } from "../chat.types";
import { clamp } from "../components/ChatUI";
import { ArtifactProvenanceLabel } from "../components/workspace/ArtifactProvenanceLabel";

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
  resolvedTheme = "light",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "light" | "dark";
  resolvedTheme?: "light" | "dark";
}) {
  const isDarkTheme = resolvedTheme === "dark";
  const useDarkVariant = variant === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: useDarkVariant
          ? "1px solid #111"
          : isDarkTheme
            ? "1px solid rgba(255,255,255,0.18)"
            : "1px solid #ddd",
        background: useDarkVariant
          ? "#111"
          : isDarkTheme
            ? "rgba(255,255,255,0.06)"
            : "#fff",
        color: useDarkVariant ? "#fff" : isDarkTheme ? "#fff" : "#111",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel(args: {
  title: string;
  description?: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 2,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.2,
          color: isDark ? "#ffffff" : "#0f172a",
          opacity: 0.92,
        }}
      >
        {args.title}
      </div>

      {args.description ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: isDark
              ? "rgba(255,255,255,0.68)"
              : "rgba(15,23,42,0.62)",
          }}
        >
          {args.description}
        </div>
      ) : null}
    </div>
  );
}

/** Breakdown row with a progress bar (simple MVP UI, no external libs). */
function BarRow({
  label,
  value,
  max,
  resolvedTheme = "light",
}: {
  label: string;
  value: number;
  max: number;
  resolvedTheme?: "light" | "dark";
}) {
  const safeValue = clamp(Number(value) || 0, 0, max);
  const pct = (safeValue / max) * 100;
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr 70px",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isDark ? "#fff" : "#111",
        }}
      >
        {label}
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          border: isDark
            ? "1px solid rgba(255,255,255,0.14)"
            : "1px solid #ddd",
          overflow: "hidden",
          background: isDark ? "rgba(255,255,255,0.08)" : "#fafafa",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: isDark ? "#fff" : "#111",
          }}
        />
      </div>

      <div
        style={{
          fontSize: 13,
          textAlign: "right",
          color: isDark ? "#fff" : "#111",
        }}
      >
        {safeValue}/{max}
      </div>
    </div>
  );
}

/** Reusable list section for gaps/anti-patterns/improvements. */
function Section({
  title,
  items,
  resolvedTheme = "light",
}: {
  title: string;
  items: string[];
  resolvedTheme?: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          marginBottom: 8,
          color: isDark ? "#fff" : "#111",
        }}
      >
        {title}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: isDark ? "rgba(255,255,255,0.68)" : "#666",
          }}
        >
          None.
        </div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.map((x, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                marginBottom: 6,
                lineHeight: 1.35,
                color: isDark ? "#fff" : "#111",
              }}
            >
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
    (verdict.includes("no tests provided") ||
      verdict.includes("no test cases provided"))
  );
}

function ReviewEmptyState({
  resolvedTheme = "light",
}: {
  resolvedTheme?: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
        boxShadow: isDark
          ? "0 6px 22px rgba(0,0,0,0.18)"
          : "0 6px 22px rgba(0,0,0,0.06)",
        color: isDark ? "#fff" : "#111",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: 0.2 }}>
          Paste Test Cases to Review
        </div>
        <div
          style={{
            fontSize: 13,
            color: isDark ? "rgba(255,255,255,0.76)" : "#444",
            lineHeight: 1.5,
          }}
        >
          Test Review evaluates an existing test suite and returns a coverage
          score, risk gaps, anti-patterns, and prioritized improvements.
        </div>
      </div>

      <div
        style={{
          border: isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
          background: isDark ? "rgba(255,255,255,0.04)" : "#fafafa",
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: isDark ? "rgba(255,255,255,0.82)" : "#333",
          }}
        >
          What to do next
        </div>
        <div
          style={{
            fontSize: 13,
            color: isDark ? "rgba(255,255,255,0.76)" : "#444",
            lineHeight: 1.45,
          }}
        >
          • Paste test cases to review (from Test Design or your existing suite)
          <br />
          • Then send the request again to generate the review
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: isDark ? "rgba(255,255,255,0.66)" : "#666",
          lineHeight: 1.45,
        }}
      >
        Tip: Generate a suite in <strong>Test Design</strong> and paste it here
        for evaluation.
      </div>
    </div>
  );
}

export default function ReviewCard({
  review,
  resolvedTheme = "light",
  provenanceLabel,
  provenanceDescription,
}: {
  review: ReviewResult;
  resolvedTheme?: "light" | "dark";
  provenanceLabel?: string;
  provenanceDescription?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  if (isEmptyReview(review)) {
    return <ReviewEmptyState resolvedTheme={resolvedTheme} />;
  }

  const score = clamp(Number(review.score) || 0, 0, 100);
  const grade =
    score >= 90
      ? "Excellent"
      : score >= 75
        ? "Good"
        : score >= 60
          ? "Fair"
          : score >= 40
            ? "Weak"
            : "Poor";

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
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
        boxShadow: isDark
          ? "0 6px 22px rgba(0,0,0,0.18)"
          : "0 6px 22px rgba(0,0,0,0.06)",
        color: isDark ? "#fff" : "#111",
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: 0.2 }}>
            Review Score
          </div>
          <div
            style={{
              fontSize: 13,
              color: isDark ? "rgba(255,255,255,0.76)" : "#444",
              lineHeight: 1.45,
            }}
          >
            {review.verdict}
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            padding: "4px 8px",
            borderRadius: 999,
            border: isDark
              ? "1px solid rgba(255,255,255,0.14)"
              : "1px solid rgba(15,23,42,0.12)",
            background: isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(15,23,42,0.04)",
            color: isDark
              ? "rgba(255,255,255,0.82)"
              : "rgba(15,23,42,0.82)",
          }}
        >
          Review artifact
        </div>
      </div>

      {provenanceLabel || provenanceDescription ? (
        <div style={{ display: "grid", gap: 6 }}>
          {provenanceLabel ? (
            <ArtifactProvenanceLabel
              label={provenanceLabel}
              resolvedTheme={resolvedTheme}
            />
          ) : null}

          {provenanceDescription ? (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: isDark ? "rgba(255,255,255,0.72)" : "#555",
              }}
            >
              {provenanceDescription}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <SectionLabel
          title="Review actions"
          description="Copy this review result in markdown or JSON format for external use."
          resolvedTheme={resolvedTheme}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SmallButton
            onClick={() => copyText(reviewToMarkdown(review), "Markdown")}
            resolvedTheme={resolvedTheme}
          >
            Copy MD
          </SmallButton>

          <SmallButton
            onClick={() => copyText(reviewToJson(review), "JSON")}
            variant="dark"
            resolvedTheme={resolvedTheme}
          >
            Copy JSON
          </SmallButton>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          border: isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
          background: isDark ? "rgba(255,255,255,0.04)" : "#fafafa",
        }}
      >
        <SectionLabel
          title="Score summary"
          description="Current persisted review score and grade."
          resolvedTheme={resolvedTheme}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              border: isDark ? "1px solid #fff" : "1px solid #111",
              borderRadius: 999,
              padding: "9px 12px",
              background: isDark ? "#fff" : "#111",
              color: isDark ? "#111" : "#fff",
              fontWeight: 950,
              fontSize: 14,
            }}
          >
            {score}/100
          </div>

          <div
            style={{
              fontSize: 12,
              color: isDark ? "rgba(255,255,255,0.66)" : "#666",
              fontWeight: 800,
            }}
          >
            {grade}
          </div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: isDark
              ? "1px solid rgba(255,255,255,0.14)"
              : "1px solid #e6e6e6",
            background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
            color: isDark ? "#fff" : "#111",
            fontSize: 12,
            fontWeight: 800,
            width: "fit-content",
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          border: isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid #f0f0f0",
          borderRadius: 16,
          padding: 14,
          background: isDark ? "rgba(255,255,255,0.04)" : "#fafafa",
          display: "grid",
          gap: 12,
        }}
      >
        <SectionLabel
          title="Breakdown"
          description="Category-by-category scoring for the current review."
          resolvedTheme={resolvedTheme}
        />

        <BarRow
          label="Business relevance"
          value={review.breakdown.businessRelevance}
          max={25}
          resolvedTheme={resolvedTheme}
        />
        <BarRow
          label="Risk coverage"
          value={review.breakdown.riskCoverage}
          max={25}
          resolvedTheme={resolvedTheme}
        />
        <BarRow
          label="Design quality"
          value={review.breakdown.designQuality}
          max={20}
          resolvedTheme={resolvedTheme}
        />
        <BarRow
          label="Level & scope"
          value={review.breakdown.levelAndScope}
          max={15}
          resolvedTheme={resolvedTheme}
        />
        <BarRow
          label="Diagnostic value"
          value={review.breakdown.diagnosticValue}
          max={15}
          resolvedTheme={resolvedTheme}
        />
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            border: isDark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid #f0f0f0",
            borderRadius: 16,
            padding: 14,
            background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
          }}
        >
          <SectionLabel
            title="Top risk gaps"
            description="Highest-priority coverage gaps identified in the review."
            resolvedTheme={resolvedTheme}
          />
          <Section
            title=""
            items={review.riskGaps}
            resolvedTheme={resolvedTheme}
          />
        </div>

        <div
          style={{
            border: isDark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid #f0f0f0",
            borderRadius: 16,
            padding: 14,
            background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
          }}
        >
          <SectionLabel
            title="Anti-patterns"
            description="Design or structure issues that reduce suite effectiveness."
            resolvedTheme={resolvedTheme}
          />
          <Section
            title=""
            items={review.antiPatterns}
            resolvedTheme={resolvedTheme}
          />
        </div>

        <div
          style={{
            border: isDark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid #f0f0f0",
            borderRadius: 16,
            padding: 14,
            background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
          }}
        >
          <SectionLabel
            title="Prioritized improvements"
            description="Recommended next improvements based on the current review."
            resolvedTheme={resolvedTheme}
          />
          <Section
            title=""
            items={review.improvements}
            resolvedTheme={resolvedTheme}
          />
        </div>
      </div>
    </div>
  );
}
