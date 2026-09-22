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

The default config's first run logs in through Auth0 and saves the session.
The isolated PR6, PR8/PR9, PR60, and PR10 configs do not use this global setup.
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
- `PR60_ENABLE_ADMIN_CHAT_CHECK=true`: allows the admin chat test to call the AI route and verify a credit debit without trial conversion.

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
npx tsc --noEmit --incremental false
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

Do not run the root `npm run build` for QA: it invokes `prisma migrate deploy`.
Deployment/build evidence is a separate gate; any direct Next build needs a side-effect review first.

Before live PR60 accounts exist, 11 discovered PR60 tests with clear setup skips
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

### PR10 Gate A harness (disabled until separate live authorization)

Harness scope: five QA files; the complete PR10 scope also includes the Review-access fix
in `app/api/chat/route.ts` and `lib/server/chat/requestGuards.ts`. No new dependencies, wallet edits, exhaustion loop,
automatic account creation, cleanup SQL, or production execution. Missing prerequisites
FAIL; they do not silently skip. A serial failure prevents later dependent tests from
running: those unrun tests are not evidence. No retries. Do not rerun a partially
completed journey with the same fresh candidate. Preserve failure evidence first.

Offline commands from the repository root (installed tools only):

```powershell
node qa/node_modules/@playwright/test/cli.js test --config qa/playwright.pr10.config.ts --list
node qa/node_modules/@playwright/test/cli.js test --config qa/playwright.pr10.config.ts --grep '@offline'
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --target es2020 --module commonjs --moduleResolution node qa/helpers/pr10Gate.ts qa/tests/pr10-beta-account-e2e.spec.ts qa/playwright.pr10.config.ts
node node_modules/eslint/bin/eslint.js qa/helpers/pr10Gate.ts qa/tests/pr10-beta-account-e2e.spec.ts qa/playwright.pr10.config.ts
git diff --check
```

The root TypeScript config excludes QA; the separate command checks the actual harness.
Discovery and `@offline` require no application server, identity, DB, or browser launch.

#### Controlled inventory (future setup, not authorization to create it)

Use six distinct, disposable identities and a separate non-production database.
Confirm the deployment and `PR10_DATABASE_URL` refer to that same database. The URL
allowlist is an operator assertion, not proof that a deployment uses non-production data.
The DB credential should have SELECT-only privileges; helper queries also use read-only
transactions. Never use customer/personal accounts. Keep all identity files external,
private, and uncommitted. No generic `helpers/auth.json` fallback.

| Role | Required starting state | Mutation during authorized run |
| --- | --- | --- |
| fresh | Dedicated Auth0 identity, no signup intent, membership, or previous grant | One trial provisioning via /api/me |
| owner | Existing normal trial, >=10 credits, isolated account | Five workflow calls, one ordinary replay, evidence upload, logout/login |
| zero | Existing normal trial, actual DB balance 0, own persisted suite session | Rejected AI probe and deterministic evidence upload; no wallet adjustment |
| second | Existing normal trial, different organization | Read-only isolation/admin denial checks |
| unentitled | Auth0 identity, no membership or signup intent | Expected rejected /api/me and /api/chat calls |
| admin | Existing application admin, no trial or signup intent | Account and admin boundary reads |

Prepare the fresh state BEFORE Start Trial, after separate authorization:

1. Use an existing dedicated Auth0-only identity; do not run the PR6 signup-intent creator.
2. Open a new headed Playwright context at the approved origin. Block `/chat`, `/api/me`,
   and `/api/chat` browser requests using the PR6 capture convention before navigating.
3. Navigate to `/auth/login?returnTo=/auth/profile` and sign in as that identity.
   Confirm `/auth/profile` returns its expected sub. Do not click Start Trial during setup.
4. Save `context.storageState({ path: '<absolute private fresh.json path>' })` outside
   the repository; close that context. It must contain no `rs_beta_signup` cookie.
5. Reference that state in the inventory. The harness independently queries membership,
   entitlements, subject-linked grant history, sessions, and messages before Start Trial;
   an operator assertion or timestamp is never accepted as proof of unprovisioned state.
PR60 states can supply owner/second/admin if prerequisites match. Never import PR6
creators: they execute live work on import. The zero session must be among its sidebar's
first 25 sessions; absence fails rather than silently selecting a different workspace.

Create a private inventory referencing existing external storage-state files:

```json
{
  "origin": "https://your-approved-preview.example",
  "createdAt": "<ISO timestamp of fresh capture>",
  "accounts": {
    "fresh": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/fresh.json" },
    "owner": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/owner.json" },
    "zero": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/zero.json", "sessionId": "<owned suite session>" },
    "second": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/second.json" },
    "unentitled": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/unentitled.json" },
    "admin": { "subject": "<Auth0 sub>", "state": "C:/private-pr10/admin.json" }
  }
}
```

Inventory age must be <=12 minutes. All six states must begin without a signup intent.
The harness checks /auth/profile identity and DB prerequisites for every role before
starting the journey. Missing or stale authentication is a setup failure, not a skip.
Prepare the zero account through a separately approved process; this harness never
drains credits. Synthetic execution CSV marks controlled test cases passed to exercise
ingestion; it is not evidence that the described password-reset product was tested.

#### Future authorized live run

Start the real application separately. Prefer a reviewed, migration-free production
runtime or an accessible preview; no server is started by this config. Record exact
BASE_URL, feature head, runtime/bundler, DB target verification, and account approval
in private evidence. A Vercel login wall blocks validation; deployment success alone
does not prove browser behavior. Do not bypass access controls.

Set every PR10 opt-in in `.env.example`, an approved credit budget, and `HEADLESS=false`.
Run once with no retries:

```powershell
node qa/node_modules/@playwright/test/cli.js test --config qa/playwright.pr10.config.ts
```

Stay at the browser for the first and last tests. Complete Auth0/MFA as the expected
fresh identity during Start Trial and as the owner during final Sign In (120 seconds each).
Start Trial may show Auth0's signup screen: choose login for the existing dedicated
identity; do not create another identity. The harness observes the real callback,
blocks automatic provisioning requests, rechecks identity and the unprovisioned DB
snapshot, then calls `/api/me`. It checks exact record IDs/cardinality, DB/API balance
and organization, and UTC epoch trial timestamps with 1 ms precision tolerance. It does not claim
Auth0 identity creation coverage. No password is supplied by the harness.

`PR10_CREDIT_BUDGET` accepts integers 1-100. `PR10_INTERNAL_<ROLE>_STATE` variables
are assigned internally from the inventory; operators must never configure them.
All six live/mutation opt-ins and the URL, DB, inventory, budget, and headed-mode inputs
are listed in `.env.example`; no PR10 input falls back to generic auth state.

Restoration selects the real sidebar session and opens persisted artifact documents.
The unique owner marker must exist in the requirement and render for A before checking
its absence for B after the browser history load and network settlement. Responsive checks use actionability-only trials for billable buttons
(no click dispatched), plus a real free JSON export at both widths. Screenshot review
remains manual. The immediate zero-credit snapshot proves observed persisted state
after rejection, not the absence of every theoretical transient database state.

The owner journey permits at most six chat attempts (five workflow calls plus replay).
The credit budget stops subsequent operations and checks observed spending; it is NOT
a server-enforced hard cap on an in-flight model request. Costs are token-dependent.
Replay must return `replay: true` and leave wallet/ledger unchanged. Explicit workflow
actions receive fresh IDs; their intentional replay bypass is not tested as idempotent.
Zero/auth-only denial probes are separately opted in and expected not to debit.
Zero checks cover ordinary chat and Review; Auth0-only rejection explicitly requests Review.
The offline Review regression checks route guards and the real account policy with an
in-memory subscription. It does not prove AI execution, Auth0, or database integration.

#### Complete evidence packet

- PR10: six live tests plus four offline tests. Inspect saved 1440/375 owner and
  zero-state screenshots; layout assertions alone are not a visual review.
- Run unchanged PR8/PR9 through `qa/playwright.pr9.config.ts` separately: 16 tests;
  seven need the real application, eight use the isolated webpack fixture, one is pure
  filtering. Fixture/production bundler differences remain a limitation.
- Reuse PR6 specialized concurrency/replay/existing-Start-Trial/chat-race configs with
  their private fresh fixtures and opt-ins. Do not run provisioning specs wholesale:
  missing-fixture skips and the deferred Redis-outage test are not proof.
- Reuse PR60's 11 checks for its existing boundaries; require configured role states
  and spending opt-ins, and report all skips. PR10 does not silently run these suites.
- The development empty-manifest failure remains unresolved. Record production-runtime
  evidence separately; do not claim the development issue was fixed.
- Record each result as live, offline, mocked, skipped, or manual. Authenticated traces
  and video are disabled. Screenshots/results stay in ignored per-run output; review
  them for private data before sharing. Contexts close even after failure; the externally
  managed application server remains the operator's responsibility.
- Production validation is a separate post-merge, separately authorized step. This
  harness deliberately rejects the known production domain. No Gate A completion or
  merge readiness may be inferred from discovery/offline passes alone.
