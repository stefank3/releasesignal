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
import { ReviewToDesignActions } from "./review/ReviewToDesignActions";

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
  resolvedTheme = "light",
}: {
  children: React.ReactNode;
  onClick: () => void;
  resolvedTheme?: "light" | "dark";
}) {
  const isDarkTheme = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 11px",
        borderRadius: 8,
        border: isDarkTheme ? "1px solid #4A4739" : "1px solid #C4BCA7",
        background: isDarkTheme ? "#35332C" : "#F1EDE2",
        color: isDarkTheme ? "#EDEAE3" : "#262521",
        fontSize: 12,
        fontWeight: 800,
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
        gridTemplateColumns: "minmax(120px, 160px) minmax(100px, 1fr) auto",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: isDark ? "#EDEAE3" : "#262521",
        }}
      >
        {label}
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
          overflow: "hidden",
          background: isDark ? "#21201C" : "#EDEAE0",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: isDark ? "#7CC08A" : "#2F7A44",
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          textAlign: "right",
          color: isDark ? "#EDEAE3" : "#262521",
          fontWeight: 800,
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
      {title ? (
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
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: isDark ? "rgba(255,255,255,0.68)" : "#666",
          }}
        >
          None found in this review.
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
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 14,
        padding: 14,
        background: isDark ? "#262521" : "#F6F4ED",
        color: isDark ? "#EDEAE3" : "#262521",
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
          border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
          borderRadius: 12,
          padding: 14,
          background: isDark ? "#21201C" : "#FFFFFF",
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
  onImproveTestPlanAction,
  canImproveTestPlan = false,
  isImprovingTestPlan = false,
  onGenerateFromGapsAction,
  canGenerateFromGaps = false,
  isGeneratingFromGaps = false,
  lineageStatus,
  lineageLabels = [],
  lineageReasons = [],
}: {
  review: ReviewResult;
  resolvedTheme?: "light" | "dark";
  provenanceLabel?: string;
  provenanceDescription?: string;
  onImproveTestPlanAction?: () => void;
  canImproveTestPlan?: boolean;
  isImprovingTestPlan?: boolean;
  onGenerateFromGapsAction?: () => void;
  canGenerateFromGaps?: boolean;
  isGeneratingFromGaps?: boolean;
  lineageStatus?: "current" | "stale" | "unknown";
  lineageLabels?: string[];
  lineageReasons?: string[];
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
  const coverageFindingWithoutGrade = String(review.verdict ?? "")
    .replace(/^(excellent|good|fair|weak|poor)\s*[-\u2013\u2014:]\s*/i, "")
    .trim();
  const coverageFinding = coverageFindingWithoutGrade
    ? `${coverageFindingWithoutGrade.charAt(0).toUpperCase()}${coverageFindingWithoutGrade.slice(1)}`
    : review.verdict;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied ✓`);
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  const lineageTone =
    lineageStatus === "current"
      ? {
          border: isDark ? "1px solid #3B5745" : "1px solid #BFD5BD",
          background: isDark ? "#26332B" : "#E2ECE0",
          color: isDark ? "#7CC08A" : "#2F7A44",
        }
      : lineageStatus === "stale"
        ? {
            border: isDark ? "1px solid #57482A" : "1px solid #DCC791",
            background: isDark ? "#342C1B" : "#F4E8CB",
            color: isDark ? "#E0AE5A" : "#96690F",
          }
        : {
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            background: isDark ? "#302F2A" : "#EDEAE0",
            color: isDark ? "#A39F92" : "#6F6A5C",
          };

  return (
    <section
      aria-label="Review Result"
      style={{
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        borderRadius: 14,
        padding: 14,
        background: isDark ? "#262521" : "#F6F4ED",
        color: isDark ? "#EDEAE3" : "#262521",
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: 0.1 }}>
              Review Result
            </div>
            <span
              style={{
                ...lineageTone,
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: 900,
                textTransform: "capitalize",
              }}
            >
              {lineageStatus ? `Review artifact · ${lineageStatus}` : "Review artifact"}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: isDark ? "#A39F92" : "#6F6A5C",
              lineHeight: 1.45,
              maxWidth: 760,
            }}
          >
            <strong style={{ color: isDark ? "#EDEAE3" : "#262521" }}>
              Coverage finding
            </strong>
            <br />
            {coverageFinding}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              border: isDark ? "1px solid #3B5745" : "1px solid #BFD5BD",
              borderRadius: 999,
              padding: "8px 11px",
              background: isDark ? "#26332B" : "#E2ECE0",
              color: isDark ? "#7CC08A" : "#2F7A44",
              fontWeight: 950,
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 10, marginRight: 6, opacity: 0.78 }}>
              Review Score
            </span>
            {score}/100
          </div>
          <span style={{ fontSize: 12, fontWeight: 900 }}>
            Suite grade: {grade}
          </span>
          <SmallButton
            onClick={() => copyText(reviewToMarkdown(review), "Markdown")}
            resolvedTheme={resolvedTheme}
          >
            Copy MD
          </SmallButton>
          <SmallButton
            onClick={() => copyText(reviewToJson(review), "JSON")}
            resolvedTheme={resolvedTheme}
          >
            Copy JSON
          </SmallButton>
        </div>
      </div>

      {lineageLabels.length > 0 || provenanceLabel || provenanceDescription ? (
        <div style={{ display: "grid", gap: 6 }}>
          {lineageLabels.length > 0 ? (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {lineageLabels.map((label) => (
                <span
                  key={label}
                  style={{
                    border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
                    borderRadius: 999,
                    padding: "4px 8px",
                    background: isDark ? "#302F2A" : "#FFFFFF",
                    color: isDark ? "#A39F92" : "#6F6A5C",
                    fontSize: 10.5,
                    fontWeight: 800,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : provenanceLabel ? (
            <ArtifactProvenanceLabel
              label={provenanceLabel}
              resolvedTheme={resolvedTheme}
            />
          ) : null}

          {provenanceDescription ? (
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.45,
                color: isDark ? "#A39F92" : "#6F6A5C",
              }}
            >
              {provenanceDescription}
            </div>
          ) : null}
        </div>
      ) : null}

      {lineageReasons.length > 0 ? (
        <div
          style={{
            border: lineageTone.border,
            borderRadius: 10,
            padding: "8px 10px",
            background: lineageTone.background,
            color: lineageTone.color,
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {lineageReasons.join(" ")}
        </div>
      ) : null}

      <div
        style={{
          border: isDark ? "1px solid #394957" : "1px solid #C6D4DE",
          borderRadius: 10,
          padding: "9px 11px",
          background: isDark ? "#20282E" : "#EAF0F4",
          color: isDark ? "#B7C7D3" : "#405766",
          fontSize: 11,
          lineHeight: 1.45,
          fontWeight: 700,
        }}
      >
        Review Score assesses the quality and coverage of the saved test suite.
        It is not release approval. Release Readiness is calculated separately
        from requirement, suite, review, and execution evidence.
      </div>

      <ReviewToDesignActions
        gapCount={review.riskGaps.length}
        improvementCount={review.improvements.length}
        resolvedTheme={resolvedTheme}
        onImproveTestPlanAction={onImproveTestPlanAction}
        canImproveTestPlan={canImproveTestPlan}
        isImprovingTestPlan={isImprovingTestPlan}
        onGenerateFromGapsAction={onGenerateFromGapsAction}
        canGenerateFromGaps={canGenerateFromGaps}
        isGeneratingFromGaps={isGeneratingFromGaps}
      />

      {toast && (
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            background: isDark ? "#302F2A" : "#FFFFFF",
            color: isDark ? "#EDEAE3" : "#262521",
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
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
        }}
      >
        <div
          style={{
            border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
            borderRadius: 12,
            padding: 14,
            background: isDark ? "#21201C" : "#FFFFFF",
            display: "grid",
            gap: 10,
            alignContent: "start",
          }}
        >
          <SectionLabel
            title="Score summary"
            description="Current saved review score and derived grade."
            resolvedTheme={resolvedTheme}
          />
          <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1 }}>
            {score}<span style={{ fontSize: 12, color: isDark ? "#A39F92" : "#6F6A5C" }}>/100</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{grade}</div>
        </div>

        <div
          style={{
            border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
            borderRadius: 12,
            padding: 14,
            background: isDark ? "#21201C" : "#FFFFFF",
            display: "grid",
            gap: 11,
          }}
        >
          <SectionLabel
            title="Breakdown"
            description="Category-by-category scoring for the current review."
            resolvedTheme={resolvedTheme}
          />
          <BarRow label="Business relevance" value={review.breakdown.businessRelevance} max={25} resolvedTheme={resolvedTheme} />
          <BarRow label="Risk coverage" value={review.breakdown.riskCoverage} max={25} resolvedTheme={resolvedTheme} />
          <BarRow label="Design quality" value={review.breakdown.designQuality} max={20} resolvedTheme={resolvedTheme} />
          <BarRow label="Level & scope" value={review.breakdown.levelAndScope} max={15} resolvedTheme={resolvedTheme} />
          <BarRow label="Diagnostic value" value={review.breakdown.diagnosticValue} max={15} resolvedTheme={resolvedTheme} />
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <SectionLabel
          title="Findings"
          description="Coverage gaps, design issues, and prioritized improvement areas from this review."
          resolvedTheme={resolvedTheme}
        />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {[
            {
              title: "Risk gaps",
              description: "Highest-priority coverage gaps identified in the review.",
              items: review.riskGaps,
            },
            {
              title: "Anti-patterns",
              description: "Test-design issues that reduce suite effectiveness.",
              items: review.antiPatterns,
            },
            {
              title: "Improvements",
              description: "Prioritized improvements for the current test design.",
              items: review.improvements,
            },
          ].map((finding) => (
            <div
              key={finding.title}
              style={{
                border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
                borderRadius: 12,
                padding: 12,
                background: isDark ? "#21201C" : "#FFFFFF",
              }}
            >
              <SectionLabel
                title={`${finding.title} · ${finding.items.length}`}
                description={finding.description}
                resolvedTheme={resolvedTheme}
              />
              <Section title="" items={finding.items} resolvedTheme={resolvedTheme} />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
          paddingTop: 10,
          color: isDark ? "#A39F92" : "#6F6A5C",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        AI-assisted review — inspect the structured findings and saved artifacts
        before relying on them.
      </div>
    </section>
  );
}
