# V1 Production Environment Readiness Checklist

## Purpose

This checklist must be completed before Release Signal is exposed through a public production domain.

V1 production readiness depends on correctly separated production infrastructure, reviewed deployment settings, and verified rollback procedures. This document uses placeholder names only. Do not copy local `.env` values, real secrets, dashboard screenshots, or provider tokens into this document, pull requests, issues, or chat threads.

## Required Vercel Production Environment Variables

Configure these variables in the Vercel production environment:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `OPENAI_API_KEY`

Use provider-managed secret storage only. Values must never be committed to the repository.

## Environment Separation Checklist

- Production database is separate from development and preview databases.
- Production Redis instance is separate from development and preview Redis instances.
- Production Auth0 uses a separate tenant or a clearly separated Auth0 application.
- Production OpenAI usage uses a production-specific project and key.
- `APP_BASE_URL` matches the final production domain exactly, including protocol.
- Preview environment variables are configured separately from production values.
- Local `.env` values are not copied into docs, PR descriptions, comments, screenshots, or issue threads.

## Vercel Setup Checklist

- Production environment variables are configured in the Vercel dashboard.
- Preview environment variables are configured separately in the Vercel dashboard.
- The build command behavior is understood: `npm run build` runs `prisma migrate deploy && next build`.
- Node version compatibility is confirmed against `package.json`.
- Latest `master` builds successfully before domain cutover.
- The production deployment selected for domain cutover is recorded as the current release candidate.

## Prisma Migration Policy

- Current build behavior runs `prisma migrate deploy` before `next build`.
- Every migration must be reviewed before production deployment.
- Destructive migrations require explicit human approval before deployment.
- Risky schema changes require a rollback plan before merge.
- Rollback planning must include database state, not only Git state.
- Do not rely only on Git rollback if migrations have already changed production data or schema.

## Database Backup / Rollback Checklist

- Supabase/Postgres automated backups are enabled and verified.
- Restore process is documented and tested or confirmed with the provider.
- Last known good Vercel deployment is recorded before production cutover.
- The team knows how to rollback to a previous Vercel deployment.
- Database restore ownership and approval path are clear before launch.
- For risky migrations, define how to restore or repair production database state before deployment.

## Redis / Rate-Limit Checklist

- Production Redis is configured and reachable from Vercel production.
- Redis credentials are production-specific and stored only in Vercel environment variables.
- `REDIS_PREFIX` behavior is understood: runtime environment prefixing isolates production, preview, and development keys.
- App-level rate limits are verified after deployment.
- Redis outage behavior is tracked as future hardening where needed.
- Cloudflare or edge protection complements Redis-backed app limits; it does not replace them.

## OpenAI Cost Protection Checklist

- Provider-side spend limits are configured externally in the OpenAI project/account.
- Production OpenAI key is isolated from development and preview usage.
- App-level credit enforcement is enabled for AI-backed `/api/chat` requests.
- App-level rate limits are enabled for AI-backed and sensitive endpoints.
- Provider spend caps remain required defense-in-depth even when app-level protections are active.
- Production usage should be monitored during and after launch.

## Auth0 Dependency Note

Detailed Auth0 callback, logout, and web-origin URL requirements belong in the next production readiness document:

- `docs/v1-auth0-domain-config.md`

This checklist only records that Auth0 production configuration must be separated and aligned with the production domain before cutover.

## Pre-Domain Validation Checklist

- `npm run build` passes on latest `master`.
- `cd qa && npx playwright test --list` completes and discovers the expected test set.
- Vercel production deployment is green.
- `/` loads the public landing page.
- `/chat` requires authentication.
- `/api/chat` requires authentication and valid credits.
- `/api/me` returns safe account state for an authenticated user.
- Trial/credit badge is visible after login for an account with initialized V1 trial state.
- No secret values are present in committed docs, PRs, or logs.

## Launch Blocker Categories

### Must Fix Before Public Domain

- Production Vercel environment variables configured.
- Production database, Redis, Auth0, and OpenAI resources separated from development and preview.
- `APP_BASE_URL` set to the production domain.
- Auth0 production callback, logout, and web-origin URLs configured.
- Latest `master` build validated.
- Database backup and rollback path confirmed.

### Should Fix Before External Users

- Provider-side OpenAI spend limits confirmed.
- Production smoke validation completed against the production domain.
- Cloudflare or equivalent edge protection plan approved.
- Admin access and operational ownership confirmed.
- Auth0 logout/login behavior manually verified on production domain.

### Can Defer After Private Beta

- Broader SEO polish.
- Public sitemap and indexing expansion.
- More detailed observability dashboards.
- Additional automated production smoke coverage.
- Advanced deployment runbooks for larger team operations.

## Out Of Scope

- No code changes.
- No secret values.
- No Auth0 dashboard changes.
- No Vercel dashboard changes.
- No Cloudflare changes.
- No Prisma schema changes.
