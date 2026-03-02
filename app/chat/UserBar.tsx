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

        // WHY: If the request fails (401/500/etc.), fall back to unauthenticated UI deterministically.
        if (!res.ok) {
          setMe({ authenticated: false });
          return;
        }

        const data = (await res.json()) as MeResponse;
        setMe(data);
      } catch {
        // WHY: Network errors should not break the shell UI; degrade to "not logged in".
        // Abort is also caught here during unmount—acceptable to treat as unauthenticated for rendering.
        setMe({ authenticated: false });
      }
    })();

    return () => {
      // WHY: Prevent state updates after unmount and stop in-flight request.
      controller.abort();
    };
  }, []);

  if (!me) return <div className="text-sm opacity-70">Loading…</div>;
  if (!me.authenticated) return null;

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

      <a href="/auth/logout" className="rounded-lg border px-3 py-2 hover:bg-white/10">
        Logout
      </a>
    </div>
  );
}