/**
 * RBAC helpers (Auth0 access token roles claim).
 * We read roles ONLY from the Access Token because in Auth0 Next.js SDK v4
 * session.user may not include namespaced custom claims.
 */

import { auth0 } from "@/lib/auth0";

export const RBAC = {
  ROLES_CLAIM: "https://stefans-mvp/claims/roles",
  ADMIN_ROLE: "admin",
} as const;

/**
 * Decode JWT payload without verifying signature.
 * Safe here because token is retrieved server-side from Auth0 session.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read roles from Access Token custom claim.
 *
 * M11 closeout:
 * If the access token is expired or unavailable, degrade gracefully and
 * return an empty role list instead of throwing. This keeps shell UI such
 * as /api/me stable even when re-authentication is needed.
 */
export async function getRolesFromAccessToken(): Promise<string[]> {
  try {
    const tokenResult = await auth0.getAccessToken();
    const token = tokenResult?.token;

    if (!token) return [];

    const claims = decodeJwtPayload(token);
    const rolesValue = claims?.[RBAC.ROLES_CLAIM];

    return Array.isArray(rolesValue) ? (rolesValue as string[]) : [];
  } catch (error) {
    // Graceful degradation for expired/missing refresh-token situations.
    // We do not throw here because role checks should not crash shell-level UI.
    const message = error instanceof Error ? error.message : "";

    if (
      /access token has expired|refresh token was not provided|missing_refresh_token/i.test(
        message
      )
    ) {
      return [];
    }

    // For any other unexpected error, also degrade safely.
    // RBAC checks should remain fail-closed rather than crash the UI.
    return [];
  }
}

/** Convenience helper: admin check. */
export async function isAdminFromAccessToken(): Promise<boolean> {
  const roles = await getRolesFromAccessToken();
  return roles.includes(RBAC.ADMIN_ROLE);
}