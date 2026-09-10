"use client";

// app/UserBar.tsx
//
// Purpose:
// Lightweight session/user shell bar for authenticated state,
// admin entry points, and logout.
//
// M11 CHANGE:
// Add a single Admin entry point for internal tools.
// We keep the bar clean by linking to /admin rather than exposing
// every internal page directly in the main shell.

import { useEffect, useState } from "react";
import { PRODUCT_PACKAGE_LABELS, PRODUCT_PLAN_CODES } from "@/lib/product/packageLabels";
import { CREDIT_REFRESH_EVENT } from "./hooks/useChatSession.net";

type MeResponse =
  | {
      authenticated: true;
      auth0Sub: string;
      email: string;
      isAdmin: boolean;
      planCode: string | null;
      planStatus: string | null;
      trialEndsAt: string | null;
      creditsRemaining: number;
      trialDaysRemaining: number | null;
    }
  | { authenticated: false };

type Props = {
  creditRefreshKey?: number;
};

function formatAccountStatus(me: Extract<MeResponse, { authenticated: true }>) {
  const formattedCredits = me.creditsRemaining.toLocaleString();
  const credits = `${formattedCredits} credits left`;

  if (me.isAdmin) {
    return `Admin: ${credits}`;
  }

  if (me.planStatus === "trialing") {
    const daysLeft =
      typeof me.trialDaysRemaining === "number"
        ? `, ${me.trialDaysRemaining} days left`
        : "";

    return `Beta trial: ${credits}${daysLeft}`;
  }

  if (me.planCode === PRODUCT_PLAN_CODES.standardPaid) {
    return `${PRODUCT_PACKAGE_LABELS.basePlan}: ${credits}`;
  }

  return `Credits: ${formattedCredits} left`;
}

function formatTrialTitle(me: Extract<MeResponse, { authenticated: true }>) {
  if (me.planStatus !== "trialing" || !me.trialEndsAt) return undefined;

  return `Trial ends ${new Date(me.trialEndsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function ZeroCreditGuidance({
  me,
}: {
  me: Extract<MeResponse, { authenticated: true }>;
}) {
  if (me.creditsRemaining !== 0) return null;

  const isTrialUser = !me.isAdmin && me.planStatus === "trialing";

  return (
    <span
      role="status"
      aria-live="polite"
      className="max-w-72 text-right text-[11px] leading-4 opacity-80"
    >
      {isTrialUser ? (
        <>
          Beta credits are exhausted. AI-assisted actions are unavailable. For
          beta access questions, contact{" "}
          <a className="underline" href="mailto:contact@releasesignal.io">
            contact@releasesignal.io
          </a>
          .
        </>
      ) : (
        <>AI-assisted actions are unavailable while the credit balance is 0.</>
      )}
    </span>
  );
}

export default function UserBar({ creditRefreshKey = 0 }: Props) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [responseRefreshKey, setResponseRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // WHY:
        // /api/me must reflect the current Auth0 session immediately.
        // We do not want stale cached user/admin state in the shell.
        const res = await fetch("/api/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        // WHY:
        // If the request fails (401/500/etc.), do NOT remove the entire user bar.
        // Keep the last known valid account state on refresh failures so we do
        // not replace real credits with a fabricated fallback.
        if (!res.ok) {
          setMe((current) => current ?? { authenticated: false });
          return;
        }

        const data = (await res.json()) as MeResponse;
        setMe(data);
      } catch {
        // WHY:
        // Network errors should not break the shell UI.
        // Abort during unmount also lands here.
        setMe((current) => current ?? { authenticated: false });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [creditRefreshKey, responseRefreshKey]);

  useEffect(() => {
    const handleCreditRefresh = () => {
      setResponseRefreshKey((current) => current + 1);
    };

    window.addEventListener(CREDIT_REFRESH_EVENT, handleCreditRefresh);
    return () => window.removeEventListener(CREDIT_REFRESH_EVENT, handleCreditRefresh);
  }, []);

  if (!me) {
    return <div className="text-sm opacity-70">Loading…</div>;
  }

  if (!me.authenticated) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="opacity-70">Session unavailable</span>

        <a
          href="/auth/login"
          className="rounded-lg border px-3 py-2 hover:bg-white/10"
        >
          Sign in
        </a>

        <a
          href="/auth/logout"
          className="rounded-lg border px-3 py-2 hover:bg-white/10"
        >
          Logout
        </a>
      </div>
    );
  }

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-3 text-sm">
      <span className="max-w-56 truncate opacity-80" title={me.email}>
        {me.email}
      </span>

      <span
        title={formatTrialTitle(me)}
        className="rounded-lg border px-3 py-2 text-xs font-semibold"
        style={{
          borderColor:
            me.creditsRemaining === 0
              ? "rgba(245,158,11,0.65)"
              : "rgba(148,163,184,0.45)",
          background:
            me.creditsRemaining === 0
              ? "rgba(245,158,11,0.14)"
              : "rgba(148,163,184,0.12)",
        }}
      >
        {formatAccountStatus(me)}
      </span>

      <ZeroCreditGuidance me={me} />

      {me.isAdmin && (
        <>
          {/* M11:
              Single admin entry point for internal tools such as
              Metrics and Telemetry. */}
          <a
            href="/admin"
            className="rounded-lg border px-3 py-2 hover:bg-white/10"
          >
            Admin
          </a>
        </>
      )}

      <a
        href="/auth/logout"
        className="rounded-lg border px-3 py-2 hover:bg-white/10"
      >
        Logout
      </a>
    </div>
  );
}
