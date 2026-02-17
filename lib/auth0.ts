// /lib/auth0.ts
import "server-only";

import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { env } from "@/lib/env";

/**
 * Central Auth0 client.
 * - Server-only
 * - Uses validated env config
 * - Routes import { auth0 } from "@/lib/auth0"
 */
export const auth0 = new Auth0Client({
  // REQUIRED in @auth0/nextjs-auth0 v4
  appBaseUrl: env.APP_BASE_URL,

  // Optional: keep authorization params centralized
  authorizationParameters: {
    audience: "https://stefans-mvp-api", // must match Auth0 API Identifier
    scope: "openid profile email",
  },
});
