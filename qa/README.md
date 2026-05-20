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
