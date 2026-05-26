import type { ReleaseReadinessFactors } from "@/lib/release-readiness/releaseReadinessTypes";

type ExecutionBucket = {
  key: "passed" | "failed" | "blocked" | "skipped" | "timedOut" | "unknown";
  label: string;
  value: number;
  barClassName: string;
  dotClassName: string;
};

type Props = {
  factors: ReleaseReadinessFactors;
};

function count(value: number | undefined): number {
  return Math.max(0, Number(value ?? 0));
}

export function ExecutionResultsBreakdown({ factors }: Props) {
  const total = count(factors.executionTotal);

  if (!factors.executionEvidencePresent || total === 0) {
    return null;
  }

  const buckets: ExecutionBucket[] = [
    {
      key: "passed",
      label: "Passed",
      value: count(factors.passed),
      barClassName: "bg-emerald-500",
      dotClassName: "bg-emerald-400",
    },
    {
      key: "failed",
      label: "Failed",
      value: count(factors.failed),
      barClassName: "bg-red-500",
      dotClassName: "bg-red-400",
    },
    {
      key: "blocked",
      label: "Blocked",
      value: count(factors.blocked),
      barClassName: "bg-orange-500",
      dotClassName: "bg-orange-400",
    },
    {
      key: "skipped",
      label: "Skipped",
      value: count(factors.skipped),
      barClassName: "bg-amber-400",
      dotClassName: "bg-amber-300",
    },
    {
      key: "timedOut",
      label: "Timed out",
      value: count(factors.timedOut),
      barClassName: "bg-fuchsia-500",
      dotClassName: "bg-fuchsia-400",
    },
    {
      key: "unknown",
      label: "Unknown",
      value: count(factors.unknown),
      barClassName: "bg-slate-500",
      dotClassName: "bg-slate-400",
    },
  ];

  return (
    <section
      className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
      aria-labelledby="execution-results-breakdown-title"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div
            id="execution-results-breakdown-title"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Execution Results Breakdown
          </div>
          <p className="mt-1 text-sm text-slate-300">
            {total} uploaded result{total === 1 ? "" : "s"} from the current
            execution evidence.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-400">
          Total: {total}
        </div>
      </div>

      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-800"
        role="img"
        aria-label={`Execution results: ${buckets
          .map((bucket) => `${bucket.label} ${bucket.value}`)
          .join(", ")}`}
      >
        {buckets
          .filter((bucket) => bucket.value > 0)
          .map((bucket) => (
            <div
              key={bucket.key}
              className={bucket.barClassName}
              style={{ width: `${(bucket.value / total) * 100}%` }}
              aria-hidden="true"
            />
          ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${bucket.dotClassName}`}
                aria-hidden="true"
              />
              <span className="truncate text-sm text-slate-300">
                {bucket.label}
              </span>
            </div>
            <span className="text-sm font-semibold text-slate-100">
              {bucket.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
