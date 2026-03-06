// app/chat/components/StrategyPanel.tsx
// M7 (Locked): StrategyPanel — structured requirement input + pinned refined requirement.
//
// CHANGE (M7.5 UX Polish):
// - tighter spacing and clearer visual hierarchy
// - form block + preview block + pinned requirement block
// - same structured artifact pipeline, no backend contract changes

"use client";

import React, { useMemo, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 950,
        opacity: 0.9,
        marginBottom: 8,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </div>
  );
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

function SmallButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "7px 10px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.18)",
        background: disabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.10)",
        color: disabled ? "rgba(255,255,255,0.55)" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 950, opacity: 0.8 }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "9px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
          outline: "none",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      />
    </div>
  );
}

function Surface({
  children,
  dashed,
}: {
  children: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      style={{
        border: dashed ? "1px dashed rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
        background: dashed ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function ArtifactMiniCard(props: {
  artifact: UseChatSessionReturn["sessionArtifact"];
  artifactUpdatedAt: UseChatSessionReturn["artifactUpdatedAt"];
}) {
  const a = props.artifact;
  if (!a?.refinedRequirement) return null;

  const rr = a.refinedRequirement;
  const updated = props.artifactUpdatedAt ? new Date(props.artifactUpdatedAt).toLocaleString() : null;

  const item: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.92,
    marginTop: 4,
    lineHeight: 1.35,
  };
  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 950,
    opacity: 0.75,
    marginTop: 10,
  };

  return (
    <Surface>
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
    </Surface>
  );
}

function focusChatInputBestEffort() {
  const el = document.querySelector("input:not([disabled]), textarea:not([disabled])") as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;

  if (!el) return;

  el.focus();
  try {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    // ignore
  }
}

export default function StrategyPanel({ chat }: { chat: UseChatSessionReturn }) {
  const isCoachSession = chat.mode === "coach" && chat.activeSessionMode === "coach";
  if (!isCoachSession) return null;

  const hasPinned = !!chat.sessionArtifact?.refinedRequirement;

  const [objective, setObjective] = useState("");
  const [primaryRisk, setPrimaryRisk] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [constraints, setConstraints] = useState("");
  const [scope, setScope] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");

  const generatedStructuredText = useMemo(() => {
    return [
      `Objective: ${objective.trim()}`,
      `Primary Risk: ${primaryRisk.trim()}`,
      `Integrations: ${integrations.trim()}`,
      `Constraints: ${constraints.trim()}`,
      `Scope: ${scope.trim()}`,
      `Success Criteria: ${successCriteria.trim()}`,
    ].join("\n");
  }, [objective, primaryRisk, integrations, constraints, scope, successCriteria]);

  const hasAnyInput = Boolean(
    objective.trim() ||
      primaryRisk.trim() ||
      integrations.trim() ||
      constraints.trim() ||
      scope.trim() ||
      successCriteria.trim()
  );

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 18,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
        color: "#fff",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontWeight: 950 }}>Strategy panel</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Refine the requirement, then pin it into this session.</div>
        </div>
        <Pill>{hasPinned ? "Pinned ✓" : "Not pinned"}</Pill>
      </div>

      <Surface>
        <SectionTitle>Refine requirement</SectionTitle>

        <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45, marginBottom: 10 }}>
          Fill the fields below, then paste them into the main input and send. This will create or update the pinned
          refined requirement.
        </div>

        <div style={{ display: "grid", gap: 9 }}>
          <Field
            label="Objective"
            value={objective}
            onChange={setObjective}
            placeholder="What is the main business or QA objective?"
            rows={2}
          />

          <Field
            label="Primary Risk"
            value={primaryRisk}
            onChange={setPrimaryRisk}
            placeholder="What failure or uncertainty matters most?"
            rows={2}
          />

          <Field
            label="Integrations"
            value={integrations}
            onChange={setIntegrations}
            placeholder="Auth0, email service, API gateway, payment provider..."
            rows={2}
          />

          <Field
            label="Constraints"
            value={constraints}
            onChange={setConstraints}
            placeholder="Environment limits, timeline, non-goals, technical restrictions..."
            rows={2}
          />

          <Field
            label="Scope"
            value={scope}
            onChange={setScope}
            placeholder='Use format like: In: login, MFA challenge / Out: admin portal, audit exports'
            rows={2}
          />

          <Field
            label="Success Criteria"
            value={successCriteria}
            onChange={setSuccessCriteria}
            placeholder="What must be true for this to be considered successful?"
            rows={2}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <SmallButton
            onClick={() => {
              chat.setInput(generatedStructuredText);
              requestAnimationFrame(() => focusChatInputBestEffort());
            }}
            disabled={!hasAnyInput}
            title="Paste structured answers into the main chat input"
          >
            Paste into input
          </SmallButton>

          <SmallButton
            onClick={() => {
              setObjective("");
              setPrimaryRisk("");
              setIntegrations("");
              setConstraints("");
              setScope("");
              setSuccessCriteria("");
            }}
            disabled={!hasAnyInput}
            title="Clear all answers"
          >
            Clear form
          </SmallButton>
        </div>
      </Surface>

      <Surface dashed>
        <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.82, marginBottom: 6 }}>Preview</div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.78,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {generatedStructuredText}
        </div>
      </Surface>

      <div>
        <SectionTitle>Pinned requirement</SectionTitle>
        {hasPinned ? (
          <ArtifactMiniCard artifact={chat.sessionArtifact} artifactUpdatedAt={chat.artifactUpdatedAt} />
        ) : (
          <Surface>
            <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45 }}>
              Nothing pinned yet. Fill the form, click “Paste into input”, then send the message.
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}