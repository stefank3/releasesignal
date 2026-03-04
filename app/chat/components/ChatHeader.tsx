// app/chat/components/ChatHeader.tsx
// M7: Extract header row from page.tsx (title + sidebar collapse + UserBar)

"use client";

import React from "react";
import UserBar from "../UserBar";

type Props = {
  sidebarCollapsed: boolean;
  onToggleSidebarAction: () => void;
};

export default function ChatHeader({ sidebarCollapsed, onToggleSidebarAction }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <button
        onClick={onToggleSidebarAction}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Expand history panel" : "Collapse history panel"}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.06)",
          color: "#fff",
          fontWeight: 950,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        {sidebarCollapsed ? "»" : "«"}
      </button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
          AI-Assisted Quality Review & Coaching
        </h1>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Coach · Review · Cases (mode is session-locked)</div>
      </div>

      <div style={{ flex: "0 0 auto" }}>
        <UserBar />
      </div>
    </div>
  );
}