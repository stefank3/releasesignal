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

function formatAccountStatus(me: Extract<MeResponse, { authenticated: true }>) {
  const credits = `${me.creditsRemaining} credits`;

  if (me.planStatus === "trialing") {
    const daysLeft =
      typeof me.trialDaysRemaining === "number"
        ? ` · ${me.trialDaysRemaining} days left`
        : "";

    return `${PRODUCT_PACKAGE_LABELS.trial} · ${credits}${daysLeft}`;
  }

  if (me.planCode === PRODUCT_PLAN_CODES.standardPaid) {
    return `${PRODUCT_PACKAGE_LABELS.basePlan} · ${credits}`;
  }

  return `Credits · ${credits}`;
}

function formatTrialTitle(me: Extract<MeResponse, { authenticated: true }>) {
  if (me.planStatus !== "trialing" || !me.trialEndsAt) return undefined;

  return `Trial ends ${new Date(me.trialEndsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function UserBar() {
  const [me, setMe] = useState<MeResponse | null>(null);

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
        // Degrade into a recoverable unauthenticated shell instead.
        if (!res.ok) {
          setMe({ authenticated: false });
          return;
        }

        const data = (await res.json()) as MeResponse;
        setMe(data);
      } catch {
        // WHY:
        // Network errors should not break the shell UI.
        // Abort during unmount also lands here.
        setMe({ authenticated: false });
      }
    })();

    return () => {
      controller.abort();
    };
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
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <span className="opacity-80">{me.email}</span>

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
