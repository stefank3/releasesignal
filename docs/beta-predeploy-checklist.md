# Beta Pre-Deploy Regression Checklist

This checklist standardizes the manual beta pre-deploy validation process for
Release Signal.

Release Signal deploys through Vercel. For now, Vercel validates the app mainly
through `npm run build`; the PR #60 Playwright regression gate is a manual
pre-deploy discipline, not a GitHub Actions or CI workflow.

Do not use this checklist to change runtime behavior, Auth0 behavior, billing
semantics, trial/admin logic, Prisma schema, prompt behavior, artifact
contracts, database cleanup, GitHub Actions, CI, or Vercel deployment behavior.

## Level 1: Always Required Before Merge/Deploy

Run these commands before human merge review and before a beta deploy:

```bash
npx tsc --noEmit
npm run build
git diff --check
cd qa
npx playwright test --list
npm run pr60:list
```

Expected result:

- TypeScript passes.
- Build passes.
- `git diff --check` reports no whitespace errors.
- Playwright discovery succeeds.
- `npm run pr60:list` lists the 8 PR #60 regression gate tests.

Stop before merge/deploy if any Level 1 command fails unexpectedly.

## Level 2: PR60 Manual Gate Before Live Auth0 Setup

Until dedicated PR60 live test accounts and storage-state files exist, run:

```bash
cd qa
npm run pr60:gate
```

Current acceptable result before live test accounts exist:

- 8 PR60 tests are discovered/listed.
- Tests clearly skip because live Auth0/storage-state/test-account setup is
  missing.
- There are no unexpected failures.
- The validation report does not claim full live coverage.

All-skipped PR60 output is acceptable only in this pre-live-account phase.

If Playwright worker startup fails locally with sandbox `spawn EPERM`, rerun the
same command outside the sandbox when available and document both results.

## Level 3: PR60 Live Beta Gate

Once dedicated live beta setup exists, the PR60 gate must execute live checks
instead of being treated as acceptable when everything skips.

Required live setup:

- Dedicated normal trial user.
- Dedicated second normal user.
- Dedicated admin user.
- Seeded owner/session state when needed for session isolation checks.
- Playwright storage-state files for each dedicated account.
- Explicit opt-ins for Auth0, AI, and credit-consuming checks.

Required environment variables are documented in `qa/.env.example` and
`qa/README.md`.

Important rule:

Once dedicated live accounts and storage states are configured, all-skipped PR60
live checks must no longer be treated as acceptable for beta release. Skips must
be reviewed individually and explained as either expected setup gaps or release
blockers.

## Manual Reporting Template

Record the result before merge/deploy:

```text
Branch:
Head SHA:

Level 1:
- npx tsc --noEmit:
- npm run build:
- git diff --check:
- cd qa && npx playwright test --list:
- cd qa && npm run pr60:list:

Level 2 or 3:
- cd qa && npm run pr60:gate:
- PR60 tests skipped:
- Skips expected under current setup:
- Live accounts/storage states configured:

Notes:
- Unexpected failures:
- Known manual follow-up:
- Confirmation: no DB cleanup executed.
- Confirmation: no runtime/Auth0/billing/trial/prompt/artifact behavior changed.
```
