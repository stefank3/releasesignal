"use client";

import { useEffect, useState } from "react";

type MeResponse =
  | { authenticated: true; email: string; isAdmin: boolean }
  | { authenticated: false };

export default function UserBar() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        // WHY: /api/me must reflect the *current* Auth0 session immediately (no stale cache).
        const res = await fetch("/api/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        // WHY:
        // If the request fails (401/500/etc.), do NOT remove the entire user bar.
        // We degrade into a recoverable unauthenticated shell instead.
        if (!res.ok) {
          setMe({ authenticated: false });
          return;
        }

        const data = (await res.json()) as MeResponse;
        setMe(data);
      } catch {
        // WHY:
        // Network errors should not break the shell UI.
        // Abort is also caught here during unmount.
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
    <div className="flex items-center gap-3 text-sm">
      <span className="opacity-80">{me.email}</span>

      {me.isAdmin && (
        <a
          href="/admin/metrics"
          className="rounded-lg border px-3 py-2 hover:bg-white/10"
        >
          Metrics
        </a>
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