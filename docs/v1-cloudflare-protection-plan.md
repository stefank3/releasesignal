# V1 Cloudflare Protection Plan

## Purpose

This document defines the recommended Cloudflare protection plan for Release Signal V1 before public domain exposure.

Cloudflare is defense-in-depth. It can reduce abusive traffic before requests reach Vercel and the application, but it does not replace Auth0, server-side credit enforcement, organization ownership checks, or app-level Redis rate limits.

Use placeholders only. Do not paste real DNS records, account identifiers, API keys, provider tokens, dashboard screenshots, or origin details into this file, pull requests, issues, or chat threads.

## Recommended Setup Order

1. Confirm the production Vercel custom domain is configured and SSL is healthy.
2. Configure DNS for the selected domain through Cloudflare.
3. Enable Cloudflare proxying only after confirming it is compatible with the Vercel domain setup.
4. Apply WAF, bot, and edge rate-limit rules in a conservative order.
5. Run smoke checks against the public domain after every meaningful Cloudflare change.

Do not use Cloudflare changes to compensate for missing application authorization, credit enforcement, or ownership checks.

## DNS And Proxy Checklist

- Decide the canonical host before cutover: apex domain, `www`, or another approved production hostname.
- Prefer one canonical public URL and redirect the non-canonical host to it.
- Verify the production domain in Vercel before routing public traffic through Cloudflare.
- Use `https://<production-domain>` consistently with Auth0, Vercel, and `APP_BASE_URL`.
- Use an SSL/TLS mode that preserves end-to-end HTTPS between the browser, Cloudflare, and Vercel.
- Enforce HTTPS for public traffic.
- Use placeholder DNS guidance only:
  - Apex record: `<apex-domain>` -> `<vercel-target-or-provider-record>`
  - `www` record: `<www-domain>` -> `<vercel-target-or-provider-record>`
- Avoid exposing raw origin details where the platform setup allows it.
- Record all DNS and proxy changes outside the repository in the launch runbook or deployment notes.

## Cloudflare WAF Recommendations

Enable managed protections conservatively, then tighten based on observed traffic:

- Cloudflare Managed Rules.
- OWASP Core Ruleset, if available on the selected Cloudflare plan.
- Bot Fight Mode or Bot Management, depending on the selected Cloudflare plan.
- Challenge suspicious automated traffic instead of immediately blocking when the expected behavior is uncertain.
- Block obvious malicious patterns such as common injection attempts, path traversal attempts, and clearly abusive scanners.
- Review WAF events after launch and tune rules based on real false-positive and abuse signals.

## Sensitive Path Protection

Recommended protection levels:

- `/api/chat`: strictest edge protection because it can trigger AI-backed work. Cloudflare should complement Auth0, pre-AI account access enforcement, app-level rate limits, and credit checks.
- `/api/admin/*`: strict protection. Admin routes should remain authenticated and admin-authorized in the app; edge rules should reduce brute-force and automated probing.
- `/api/execution-evidence`: moderate protection. Preserve valid authenticated submissions while reducing spam and repeated abuse.
- `/api/test-suites/export`: moderate protection. Protect export generation and download pressure without breaking normal user workflows.
- `/api/me`: generous protection. This endpoint supports normal authenticated UI polling and should not be aggressively challenged under typical use.
- `/auth/*`: careful protection. Auth0 login, logout, and callback flows must not be broken by challenges, redirects, or blocked cookies.
- `/`: minimal protection unless abused. The public landing page should remain easy to load, with managed rules and bot protections watching for clear abuse.

For `/auth/*`, validate callback and logout behavior after every Cloudflare rule change.

## Rate-Limit Recommendations

Edge-level limits should complement app-level Redis limits, not replace them.

Suggested V1 posture:

- `/api/chat`: stricter edge protection for repeated requests and suspicious automation.
- `/api/admin/*`: stricter edge protection for repeated access attempts and unusual traffic.
- `/api/execution-evidence`: moderate edge protection for bursty submissions.
- `/api/test-suites/export`: moderate edge protection for repeated export generation.
- `/api/me`: generous edge protection to avoid breaking normal UI refresh and account-status reads.
- `/`: minimal edge protection unless the landing page receives abusive traffic.

Use Cloudflare plan features where available. Do not assume a specific Cloudflare product tier; configure equivalent WAF, bot, and rate controls based on the active plan.

## Bot Protection Strategy

- Challenge suspicious automated traffic before blocking aggressively.
- Protect login and auth paths carefully so valid Auth0 redirects continue to work.
- Avoid rules that interfere with Auth0 callback handling, session cookies, logout redirects, or Vercel routing.
- Monitor traffic and WAF events before moving uncertain rules from monitor/challenge to block.
- Allow expected Vercel and Auth0 behavior.
- Re-test authentication whenever bot or challenge settings change.

## Cost Protection Relationship

Release Signal already has app-level protections that remain authoritative:

- Trial credits.
- `/api/me` account status.
- Credit status UI.
- Pre-AI `/api/chat` account access enforcement.
- App-level rate limits for AI-backed and sensitive endpoints.

Cloudflare reduces traffic pressure before requests reach Vercel and the app. It does not decide account entitlement, credit balance, organization ownership, or whether an AI-backed action is allowed.

OpenAI provider-side spend caps are still required separately as defense-in-depth.

## Manual Validation Checklist

Run these checks after Cloudflare DNS, proxy, WAF, bot, or rate-limit changes:

- `/` loads the public landing page.
- `/chat` redirects unauthenticated users to login and loads correctly after authentication.
- Auth0 callback works on the production domain.
- Logout returns to the expected production root.
- `/api/me` works after login.
- `/api/chat` still works for a valid authenticated user with credits.
- Blocked or rate-limited paths return the expected app responses where the application owns the response.
- Admin pages and admin API routes still work for an authorized admin user.
- No redirect loop is introduced.
- No broken cookies or session behavior appears after domain or proxy changes.

Avoid validation that spends real credits unnecessarily. Use the smallest safe smoke path available for AI-backed checks.

## Monitoring And Rollback

- Enable and review Cloudflare analytics and security events after launch.
- Start uncertain protections in monitor or challenge mode before moving to hard block.
- Record every external Cloudflare, DNS, Vercel, or Auth0 change in deployment notes.
- Keep a rollback path ready:
  - Temporarily disable Cloudflare proxying if proxy behavior causes production issues.
  - Loosen or disable the specific WAF rule causing false positives.
  - Revert DNS or proxy mode if routing becomes unhealthy.
  - Roll back the Vercel deployment if the issue is caused by app behavior rather than edge configuration.
- Confirm who owns the decision to loosen edge protection during an incident.

## Out Of Scope

- No code changes.
- No real DNS values.
- No Cloudflare account secrets.
- No Vercel dashboard changes by Codex.
- No Auth0 dashboard changes by Codex.
- No Cloudflare dashboard changes by Codex.
- No Prisma schema changes.
- No app route changes.
