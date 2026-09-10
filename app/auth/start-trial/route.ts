export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { auth0 } from "@/lib/auth0";
import {
  buildSignupIntentCallbackMarker,
  createPendingSignupIntent,
  deletePendingSignupIntent,
} from "@/lib/auth/signupIntent";
import { getRequestId } from "@/lib/server/apiErrorResponse";
import { enforceRouteRateLimit } from "@/lib/server/rateLimit";

function getClientRateLimitIdentifier(req: Request): string {
  // Vercel supplies this separately from proxy-overridable x-forwarded-for.
  // Missing or malformed platform metadata shares a fail-closed fallback bucket.
  const vercelClientIp = req.headers.get("x-vercel-forwarded-for")?.trim();
  const clientIp = vercelClientIp && isIP(vercelClientIp) ? vercelClientIp : "unknown";
  return `ip:${clientIp}`;
}

export async function GET(req: Request) {
  let nonce: string | null = null;

  try {
    const rateLimit = await enforceRouteRateLimit({
      policy: "startTrial",
      identifier: getClientRateLimitIdentifier(req),
      requestId: getRequestId(req),
    });

    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    nonce = await createPendingSignupIntent();

    return await auth0.startInteractiveLogin({
      authorizationParameters: {
        screen_hint: "signup",
      },
      returnTo: buildSignupIntentCallbackMarker(nonce),
    });
  } catch {
    if (nonce) {
      await deletePendingSignupIntent(nonce);
    }

    return NextResponse.json(
      { error: "account_provisioning_unavailable" },
      { status: 503 }
    );
  }
}
