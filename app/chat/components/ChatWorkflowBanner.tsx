// app/chat/components/ChatWorkflowBanner.tsx
// M12 Step 1:
// Extract workflow progression banner from ChatPanel so the panel stays focused
// on workspace layout and input orchestration.

"use client";

import React from "react";
import type { WorkflowStatus } from "../hooks/useChatSession";

type Props = {
  status: WorkflowStatus;
  resolvedTheme?: "light" | "dark";
};

export default function ChatWorkflowBanner({
  status,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        marginBottom: 10,
        padding: "12px 14px",
        borderRadius: 14,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 950 }}>{status.title}</div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
        {status.description}
      </div>

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
        Next: <strong style={{ fontWeight: 900 }}>{status.nextAction}</strong>
      </div>
    </div>
  );
}