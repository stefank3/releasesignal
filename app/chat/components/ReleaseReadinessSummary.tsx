// app/chat/components/ReleaseReadinessSummary.tsx
// M17 Release Readiness:
// Read-only UI summary for deterministic release readiness.
// All readiness logic must stay in lib/server/release-readiness.

import type { ReleaseReadinessSummary as ReleaseReadinessSummaryModel } from "@/lib/server/release-readiness/releaseReadinessTypes";

type ReleaseReadinessSummaryProps = {
  readiness: ReleaseReadinessSummaryModel;
};

const STATUS_LABELS: Record<ReleaseReadinessSummaryModel["status"], string> = {
  insufficient_data: "Insufficient Data",
  not_ready: "Not Ready",
  weak: "Weak Readiness",
  partial: "Partial Readiness",
  ready_with_risk: "Ready With Risk",
  ready: "Ready",
  blocked: "Blocked",
};

const CONFIDENCE_LABELS: Record<
  ReleaseReadinessSummaryModel["confidence"],
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function getStatusTone(status: ReleaseReadinessSummaryModel["status"]): string {
  switch (status) {
    case "ready":
      return "border-emerald-700/40 bg-emerald-950/30 text-emerald-100";
    case "ready_with_risk":
      return "border-amber-700/40 bg-amber-950/30 text-amber-100";
    case "partial":
    case "weak":
      return "border-yellow-700/40 bg-yellow-950/30 text-yellow-100";
    case "not_ready":
    case "blocked":
      return "border-red-700/40 bg-red-950/30 text-red-100";
    case "insufficient_data":
    default:
      return "border-slate-700/50 bg-slate-900/60 text-slate-100";
  }
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function renderList(title: string, items: string[]) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <ul className="space-y-1 text-sm text-slate-200">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="leading-relaxed">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReleaseReadinessSummary({
  readiness,
}: ReleaseReadinessSummaryProps) {
  const factors = readiness.factors;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Release Readiness
          </div>
          <h3 className="text-lg font-semibold text-slate-100">
            {STATUS_LABELS[readiness.status]}
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            {readiness.summary}
          </p>
        </div>

        <div
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(
            readiness.status
          )}`}
        >
          Confidence: {CONFIDENCE_LABELS[readiness.confidence]}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Review Score</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {formatOptionalNumber(factors.reviewScore)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Suite Cases</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {formatOptionalNumber(factors.suiteCaseCount)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Execution Results</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {formatOptionalNumber(factors.executionTotal)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="text-xs text-slate-400">Suite Version</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {formatOptionalNumber(factors.suiteVersion)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Artifact Inputs
          </div>
          <div className="space-y-1 text-sm text-slate-300">
            <div>Requirement: {factors.requirementPresent ? "Present" : "Missing"}</div>
            <div>Test Suite: {factors.suitePresent ? "Present" : "Missing"}</div>
            <div>Review: {factors.reviewPresent ? "Present" : "Missing"}</div>
            <div>
              Execution Evidence:{" "}
              {factors.executionEvidencePresent ? "Present" : "Missing"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Execution Summary
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-300">
            <div>Passed: {formatOptionalNumber(factors.passed)}</div>
            <div>Failed: {formatOptionalNumber(factors.failed)}</div>
            <div>Skipped: {formatOptionalNumber(factors.skipped)}</div>
            <div>Blocked: {formatOptionalNumber(factors.blocked)}</div>
            <div>Timed out: {formatOptionalNumber(factors.timedOut)}</div>
            <div>Unknown: {formatOptionalNumber(factors.unknown)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {renderList("Reasons", readiness.reasons)}
        {renderList("Warnings", readiness.warnings)}
        {renderList("Recommended Actions", readiness.recommendedActions)}
      </div>
    </section>
  );
}