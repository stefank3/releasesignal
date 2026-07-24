"use client";

import type { ReactNode } from "react";
import type { UseChatSessionReturn } from "../../../hooks/useChatSession";

function getActivityLabel(item: UseChatSessionReturn["items"][number]): string {
  if (item.kind === "review") return "Review completed";
  if (item.kind === "casesText") return "Test suite generated";
  if (item.kind === "casesLegacy") return "Legacy test suite loaded";
  if (item.kind === "error") return item.title || "Workspace action needs attention";

  if (item.kind === "text") {
    if (item.role === "user") return "Workspace input added";
    const text = String(item.text ?? "");
    if (text.includes("Refined Technical Requirement")) return "Requirement refined";
    if (text.includes("Readiness")) return "Readiness recalculated";
    return "Assistant response added";
  }

  return "Workspace activity";
}

function getActivityDetail(item: UseChatSessionReturn["items"][number]): string {
  if (item.kind === "review") {
    return `Review completed - score ${item.review.score}/100`;
  }

  if (item.kind === "casesText") {
    return "Generated test suite artifact";
  }

  if (item.kind === "casesLegacy") {
    return "Loaded legacy test suite";
  }

  if (item.kind === "error") {
    return item.details || item.title || "Workspace action needs attention";
  }

  if (item.kind === "text") {
    return String(item.text ?? "").replace(/\s+/g, " ").trim();
  }

  return "Workspace activity";
}

function getActivityTimeLabel(index: number): string {
  if (index === 0) return "latest";
  if (index === 1) return "recent";
  return "earlier";
}

export type WorkspaceRecentActivityProps = {
  items: UseChatSessionReturn["items"];
  processingBanner?: ReactNode;
  resolvedTheme: "light" | "dark";
  hiddenItemIndexes?: number[];
};

export function WorkspaceRecentActivity(args: WorkspaceRecentActivityProps) {
  const isDark = args.resolvedTheme === "dark";
  const hiddenItemIndexes = new Set(args.hiddenItemIndexes ?? []);
  const recentItems = args.items
    .filter((_, index) => !hiddenItemIndexes.has(index))
    .slice(-5)
    .reverse();

  return (
    <section
      aria-label="Recent activity"
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        background: isDark ? "rgba(255,255,255,0.032)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        overflow: "hidden",
      }}
    >
        <div
          style={{
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 950 }}>
              Recent activity
            </span>
            <span style={{ fontSize: 11, opacity: 0.62 }}>
              Last 5 events
            </span>
          </div>

          {args.processingBanner}

          <div style={{ display: "grid", gap: 6 }}>
            {recentItems.length ? (
              recentItems.map((item, index) => {
                const detail = getActivityDetail(item);
                const truncated =
                  detail.length > 180 ? `${detail.slice(0, 180)}...` : detail;

                return (
                  <details key={`recent-${index}-${item.kind}`}>
                    <summary
                      style={{
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
                        alignItems: "center",
                        gap: 10,
                        padding: "7px 0",
                        borderTop: isDark
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(15,23,42,0.08)",
                        fontSize: 12,
                        lineHeight: 1.35,
                      }}
                    >
                      <span aria-hidden="true" style={{ opacity: 0.72 }}>
                        •
                      </span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getActivityLabel(item)}
                      </span>
                      <span style={{ opacity: 0.56 }}>
                        {getActivityTimeLabel(index)}
                      </span>
                      <span
                        style={{
                          color: isDark
                            ? "rgba(147,197,253,0.95)"
                            : "rgba(37,99,235,0.90)",
                          fontWeight: 900,
                        }}
                      >
                        View details
                      </span>
                    </summary>
                    <div
                      style={{
                        padding: "4px 0 8px 22px",
                        fontSize: 11,
                        lineHeight: 1.45,
                        opacity: 0.7,
                      }}
                    >
                      {truncated || "No additional detail."}
                    </div>
                  </details>
                );
              })
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                No recent activity yet.
              </div>
            )}
          </div>
        </div>
    </section>
  );
}
