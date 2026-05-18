"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const AUTHENTICATED_APP_INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000;
export const INACTIVITY_TIMEOUT_OVERRIDE_STORAGE_KEY =
  "release-signal:inactivity-timeout-ms";

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

function isProtectedAppPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

function readTimeoutMs(): number {
  if (process.env.NODE_ENV === "production") {
    return AUTHENTICATED_APP_INACTIVITY_TIMEOUT_MS;
  }

  const override = window.localStorage.getItem(
    INACTIVITY_TIMEOUT_OVERRIDE_STORAGE_KEY
  );
  const parsed = override ? Number(override) : NaN;

  if (Number.isFinite(parsed) && parsed >= 1000) {
    return parsed;
  }

  return AUTHENTICATED_APP_INACTIVITY_TIMEOUT_MS;
}

export default function AuthenticatedInactivityLogout() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isProtectedAppPath(pathname)) {
      return;
    }

    let timerId: number | null = null;

    const scheduleLogout = () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      timerId = window.setTimeout(() => {
        window.location.assign("/auth/logout");
      }, readTimeoutMs());
    };

    scheduleLogout();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, scheduleLogout, { passive: true });
    }

    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, scheduleLogout);
      }
    };
  }, [pathname]);

  return null;
}
