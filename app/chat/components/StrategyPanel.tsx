// app/chat/components/StrategyPanel.tsx
// M7 (Locked): StrategyPanel — guided stepper + pinned refined requirement in one place.
//
// Surgical fixes:
// 1) Correctness: pinning only occurs when the user sends a guided-template message
//    containing the expected headings (Objective / Primary Risk / Integrations / Constraints / Scope / Success Criteria).
// 2) UX: add a "Paste template" fallback so the user can always produce a pinnable message.
// 3) UX: after autofill, focus the input (best-effort) to keep flow tight.

"use client";

import React from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

import GuidedSuggestions from "../GuidedSuggestions";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.9, marginBottom: 8 }}>{children}</div>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// CHANGE (M7 Locked): this template guarantees the headings needed for artifact pinning.
// IMPORTANT: your server heuristic checks for these exact-ish prefixes.
const PINNABLE_TEMPLATE = `Objective:
Primary Risk:
Integrations:
Constraints:
Scope:
Success Criteria:`;

// Best-effort focus helper (no refs passed down to StrategyPanel).
function focusChatInputBestEffort() {
  // ChatInput is an <input> (per your ChatPanel ref typing); target the first enabled input.
  const el = document.querySelector('input:not([disabled])') as HTMLInputElement | null;
  if (el) {
    el.focus();
    // Ensure it's visible if the page is scrolled.
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      // ignore
    }
  }
}

function ArtifactMiniCard(props: {
  artifact: UseChatSessionReturn["sessionArtifact"];
  artifactUpdatedAt: UseChatSessionReturn["artifactUpdatedAt"];
}) {
  const a = props.artifact;
  if (!a?.refinedRequirement) return null;

  const rr = a.refinedRequirement;
  const updated = props.artifactUpdatedAt ? new Date(props.artifactUpdatedAt).toLocaleString() : null;

  const wrapStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.05)",
  };

  const item: React.CSSProperties = { fontSize: 12, opacity: 0.92, marginTop: 4, lineHeight: 1.35 };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 950, opacity: 0.75, marginTop: 10 };

  return (
    <div style={wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 950, fontSize: 12 }}>Pinned requirement</div>
        <span style={{ fontSize: 11, opacity: 0.72 }}>{updated ? `Updated ${updated}` : "Pinned"}</span>
      </div>

      {rr.objective ? (
        <>
          <div style={label}>Objective</div>
          <div style={item}>{rr.objective}</div>
        </>
      ) : null}

      {rr.context ? (
        <>
          <div style={label}>Context / constraints</div>
          <div style={item}>{rr.context}</div>
        </>
      ) : null}

      {rr.integrations?.length ? (
        <>
          <div style={label}>Integrations</div>
          <div style={item}>{rr.integrations.slice(0, 12).join(", ")}</div>
        </>
      ) : null}

      {rr.riskFocus?.length ? (
        <>
          <div style={label}>Risk focus</div>
          <div style={item}>{rr.riskFocus.slice(0, 12).join(", ")}</div>
        </>
      ) : null}

      {rr.inScope?.length ? (
        <>
          <div style={label}>In scope</div>
          {rr.inScope.slice(0, 8).map((s, i) => (
            <div key={`inscope-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      ) : null}

      {rr.outOfScope?.length ? (
        <>
          <div style={label}>Out of scope</div>
          {rr.outOfScope.slice(0, 6).map((s, i) => (
            <div key={`outscope-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      ) : null}

      {rr.acceptanceCriteria?.length ? (
        <>
          <div style={label}>Acceptance criteria</div>
          {rr.acceptanceCriteria.slice(0, 8).map((s, i) => (
            <div key={`ac-${i}`} style={item}>
              • {s}
            </div>
          ))}
        </>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.72, lineHeight: 1.35 }}>
        Cases mode will use this pinned requirement as context for aligned TC-001…TC-012 output.
      </div>
    </div>
  );
}

export default function StrategyPanel({ chat }: { chat: UseChatSessionReturn }) {
  const isCoachSession = chat.mode === "coach" && chat.activeSessionMode === "coach";
  if (!isCoachSession) return null;

  const hasPinned = !!chat.sessionArtifact?.refinedRequirement;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        padding: 14,
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 950 }}>Strategy panel</div>
        <Pill>{hasPinned ? "Pinned ✓" : "Not pinned"}</Pill>
      </div>

      {/* CHANGE: copy must be true. Pin happens only when the sent message matches server headings heuristic. */}
      <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45, marginBottom: 12 }}>
        Use guided selections to fill the input template. <b>To pin</b>, send a message that includes the headings:{" "}
        <span style={{ opacity: 0.95 }}>Objective / Primary Risk / Integrations / Constraints / Scope / Success Criteria</span>.
      </div>

      {/* CHANGE: always-available fallback template (prevents “why didn’t it pin?” confusion). */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          onClick={() => {
            // If input already has content, append with spacing instead of nuking it.
            const base = (chat.input ?? "").trim();
            const next = base ? `${base}\n\n${PINNABLE_TEMPLATE}` : PINNABLE_TEMPLATE;
            chat.setInput(next);
            focusChatInputBestEffort();
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.10)",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title="Paste a pinnable template into the input (does not auto-send)"
        >
          Paste template
        </button>

        <span style={{ fontSize: 11, opacity: 0.7, alignSelf: "center" }}>
          Tip: fill Scope as “In: … Out: …” for best parsing.
        </span>
      </div>

      <SectionTitle>Guided setup</SectionTitle>
      {chat.latestCoachSuggestions ? (
        <GuidedSuggestions
          suggestions={chat.latestCoachSuggestions}
          onUseSelectionsAction={(autofillText: string) => {
            chat.setInput(autofillText);
            // CHANGE: keep the user moving → focus the input after autofill
            requestAnimationFrame(() => focusChatInputBestEffort());
          }}
        />
      ) : (
        <div style={{ fontSize: 12, opacity: 0.72 }}>
          No guided suggestions yet. Ask for a test strategy, and I’ll provide quick selectable options.
        </div>
      )}

      <div style={{ height: 12 }} />

      <SectionTitle>Pinned requirement</SectionTitle>
      {hasPinned ? (
        <ArtifactMiniCard artifact={chat.sessionArtifact} artifactUpdatedAt={chat.artifactUpdatedAt} />
      ) : (
        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45 }}>
          Nothing pinned yet. Use “Finish &amp; paste” or “Paste template”, add scope + success criteria in the input, then send.
        </div>
      )}
    </div>
  );
}