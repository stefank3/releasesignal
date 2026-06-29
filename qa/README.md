### Prerequisites

Node.js 18+
Release Signal running at http://localhost:3000
Valid test account credentials

This /qa framework is isolated and must not modify Release Signal application source.

### Install

```bash
cd qa
npm install
npx playwright install chromium
```

### Configure

```bash
cp .env.example .env
# Edit .env with your BASE_URL and test credentials
```

### First run — authenticate

The first time any test runs, Playwright logs in through Auth0 and saves the session.
If automated login is blocked, complete login manually in the headed browser.
The session is saved to helpers/auth.json.
Do not commit helpers/auth.json.

Auth0 may require email-first login, a continue step, MFA, bot protection, or cross-origin redirects. The setup handles common email/password flows, then waits for manual completion in the headed browser when automation cannot continue.

### Run smoke suite (fast check, < 3 min)

```bash
npm run smoke
```

### Run production-safe smoke against a future domain

Use `BASE_URL` to point the isolated QA harness at the target deployment:

```bash
BASE_URL=https://<production-domain> npm run smoke:prod
```

On Windows PowerShell:

```powershell
$env:BASE_URL="https://<production-domain>"; npm run smoke:prod
```

Production smoke must use a dedicated test account. Do not use a personal admin account, customer account, or account with unrelated production data.

The production-safe smoke profile avoids AI-spending flows by default. It does not submit prompts to `/api/chat`, run generation, run review, run improvement, request next batches, or submit execution evidence. It checks that the public landing page loads, the Release Signal title/branding is present, authenticated workspace access works when auth is configured, and the readiness surface can render without triggering AI-backed work.

Seeded session IDs are optional and should be configured only in controlled environments. Fixture-dependent checks such as export visibility and reload persistence are skipped by `smoke:prod` unless you intentionally run the broader smoke suite with known safe fixture sessions.

### Run full regression suite

```bash
npm run regression
```

### Run PR #60 beta-readiness regression gate

The PR #60 gate is isolated from the default single-account global auth setup.
It uses explicit Playwright storage-state files for live beta test accounts, and
skips tests with setup guidance when required accounts or opt-ins are missing.
It runs headless by default; set `HEADLESS=false` for headed/manual debugging.
This is a manual beta pre-deploy gate for Vercel deploy readiness, not a CI or
GitHub Actions workflow.

```bash
npm run pr60:list
npm run pr60:gate
```

`npm run pr60:list` verifies that the isolated PR60 Playwright config discovers
the expected PR60 regression tests without executing live Auth0 or AI-backed
flows.

`npm run pr60:gate` executes the isolated PR60 suite. Before dedicated live
test accounts and Playwright storage-state files are configured, the acceptable
result is that all PR60 live checks skip clearly because setup is missing.
Unexpected failures are not acceptable, and skipped output must not be reported
as full live coverage.

Required live-account setup:

- `PR60_TRIAL_AUTH_STATE`: normal trial user storage state.
- `PR60_ADMIN_AUTH_STATE`: Auth0 admin user storage state.
- `PR60_SECOND_USER_AUTH_STATE`: second non-admin user storage state.
- `PR60_OWNER_SESSION_ID_WITH_ARTIFACTS`: seeded session owned by the trial user.
- `PR60_OWNER_UNIQUE_ARTIFACT_TEXT`: optional unique artifact text used for UI leakage checks.

Opt-in live validations:

- `PR60_ENABLE_AUTH0_ROUTE_SMOKE=true`: allows the login route smoke to open the Auth0 authorization flow.
- `PR60_ENABLE_CREDIT_SPEND=true`: allows the normal trial-user chat test to spend one credit.
- `PR60_ENABLE_ADMIN_CHAT_CHECK=true`: allows the admin chat test to call the AI route and verify no credit debit.

Do not use personal, customer, or production admin accounts for PR #60. Use
dedicated beta test accounts and controlled seeded workspaces only. The PR #60
suite does not execute DB cleanup and does not interpret PR #59 DB audit results.

Once dedicated live accounts and storage states are configured, all-skipped PR60
live checks are no longer acceptable for beta release. At that point, skipped
checks must be reviewed individually and treated as either expected setup gaps
or release blockers.

### Manual beta pre-deploy checklist

Release Signal deploys through Vercel. Vercel continues to validate the app
mainly through `npm run build`; the PR60 regression gate remains a manual
pre-deploy discipline for now. Do not add GitHub Actions or CI wiring for this
manual gate.

Level 1 - always required before merge/deploy:

```bash
npx tsc --noEmit
npm run build
git diff --check
cd qa
npx playwright test --list
npm run pr60:list
```

Level 2 - PR60 manual gate before live Auth0 setup:

```bash
cd qa
npm run pr60:gate
```

Before live PR60 accounts exist, 8 discovered PR60 tests with clear setup skips
is acceptable. Do not claim full live coverage from all-skipped output.

Level 3 - PR60 live beta gate:

- Configure dedicated normal trial, second normal, and admin users.
- Create Playwright storage-state files for those users.
- Seed owner/session state when needed for session isolation checks.
- Set explicit Auth0/AI/credit-consuming opt-ins.
- Run `npm run pr60:gate` and treat all-skipped output as unacceptable for beta
  release once the live setup exists.

See `../docs/beta-predeploy-checklist.md` for the full manual checklist and
reporting template.

### Run everything

```bash
npm run test:all
```

### Watch mode / debug

```bash
npm run test:debug
```

### After a code change — what to run

For UI-only changes: npm run smoke
For any logic change: npm run test:all

### Test results and failure reports

Screenshots, traces, and videos saved to: ./test-results/
Open trace viewer: npx playwright show-trace test-results/<trace-file>

### Adding known session IDs

Edit fixtures/sessions.json with session IDs from your running Release Signal instance.
Tests that require specific artifact states will use these.
Without them, those tests will be skipped with a descriptive message.

For production validation, keep fixture sessions empty unless a controlled, non-customer test workspace has been prepared. Do not depend on exact credit values in smoke assertions. The QA harness should treat `/api/me` and the credit badge as server-owned display state and must not use them to spend credits.

### Production smoke safety checklist

- Use `BASE_URL=https://<production-domain>` or the PowerShell equivalent.
- Use a dedicated test account and review Auth0 behavior before running against production.
- Keep `helpers/auth.json` local and uncommitted.
- Keep `.env` local and uncommitted.
- Avoid tests that submit prompts, trigger AI-backed `/api/chat` actions, generate tests, review tests, improve plans, request next batches, or submit execution evidence.
- Keep readiness checks to render-only assertions. Let export, reload, and artifact-specific checks skip unless stable fixture session IDs are intentionally configured.
- Do not add real production URLs, credentials, tokens, Auth0 secrets, or customer data to QA files, PRs, issues, or logs.
