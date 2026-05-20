# V1 Auth0 Domain Configuration Guide

## Purpose

This document covers the Auth0 application settings needed for Release Signal V1 local development, Vercel preview usage, and production domain usage.

It is a configuration guide only. Use placeholders for values, and do not paste real secrets, client secrets, tenant values, dashboard screenshots, or local environment values into this file, pull requests, issues, or chat threads.

## Required Auth0 Application Settings

Release Signal expects the following Auth0-related configuration to be available through environment variables or provider configuration:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- Auth0 API audience / identifier, if enabled for access-token role claims

Production values must be configured in the deployment provider, not committed to the repository.

## Local Development URLs

For the local development Auth0 application, configure:

- Allowed Callback URL: `http://localhost:3000/auth/callback`
- Allowed Logout URL: `http://localhost:3000`
- Allowed Web Origin: `http://localhost:3000`

Local development URLs should not be mixed into the production Auth0 application unless there is an explicit, approved reason.

## Production Domain URLs

For the production Auth0 application, configure:

- Allowed Callback URL: `https://<production-domain>/auth/callback`
- Allowed Logout URL: `https://<production-domain>`
- Allowed Web Origin: `https://<production-domain>`
- `APP_BASE_URL` must be `https://<production-domain>`

The production domain must match the Vercel production domain selected for launch. Include the `https://` protocol and do not include a trailing path.

## Vercel Preview URL Strategy

Preview deployments need an intentional Auth0 strategy.

Recommended options:

- Explicitly add selected Vercel preview URLs used for QA.
- Use a separate preview/dev Auth0 application where possible.
- Keep the production Auth0 application focused on the production domain.
- Avoid broad wildcard callback URLs unless they are intentionally governed and reviewed.

If preview URLs are not allowed in Auth0, preview builds may deploy successfully but authentication callbacks can fail during QA.

## Public `/` And Protected `/chat` Behavior

Expected route behavior:

- `/` is the public landing page.
- `/chat` requires authentication.
- Public sign-in CTAs use `/auth/login`.
- Logout redirects to the configured logout URL.
- `/api` routes require Auth0/session checks where applicable.
- Authenticated API routes must continue to rely on server-side session and entitlement checks.

Frontend visibility must not be treated as access control. Auth0 session checks and server-side guards remain authoritative.

## Auth0 API Audience Note

Release Signal centralizes Auth0 client setup in `lib/auth0.ts`.

The Auth0 client uses an API audience for access-token behavior. The Auth0 API identifier configured in the Auth0 dashboard must match the production audience value expected by the application.

Use placeholders in documentation. Do not inspect or copy environment files.

Example placeholder:

- Auth0 API audience / identifier: `<auth0-api-identifier>`

If the audience or API identifier does not match, access-token role claims and admin checks may fail even when login succeeds.

## Manual Validation Checklist

Validate these scenarios after production Auth0 and domain configuration:

- `/` opens the public landing page.
- `/chat` redirects an unauthenticated user to Auth0.
- Login returns to `/chat` or the requested app route correctly.
- Logout returns to the production domain root.
- `/api/me` returns authenticated account status after login.
- `/api/me` returns the safe unauthenticated shape or redirects appropriately when logged out.
- Authenticated inactivity logout still works.
- Auth0 callback works on the production domain.
- No localhost URLs remain in the production Auth0 application except if intentionally allowed for a separate dev/test configuration.

## Common Failure Modes

- Callback URL mismatch: Auth0 rejects login callback after authentication.
- Logout URL mismatch: logout fails or redirects to an unexpected location.
- `APP_BASE_URL` mismatch: generated Auth0 URLs point to the wrong host.
- Wrong Auth0 app/client used in Vercel: login works in one environment but fails in another.
- Missing web origin: browser-based auth/session behavior fails.
- Preview URL not allowed: Vercel preview authentication fails even though production works.
- Audience/API identifier mismatch: access-token role claims or admin checks fail.
- Cookie/session issues after domain switch: users appear logged out or session renewal fails after changing domains.

## Out Of Scope

- No code changes.
- No Auth0 dashboard changes performed by Codex.
- No secrets.
- No Vercel environment changes.
- No Cloudflare/DNS changes.
- No Prisma schema changes.
