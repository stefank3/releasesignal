# Environment and Deployment Safety

## Document control

| Field | Value |
|---|---|
| Scope | PR #76 — Environment and Deployment Safety |
| Status | Repository audit, environment contract, and manual setup plan |
| Protected baseline | `master` at `dfabf485ca4177487667d91898ca0d92a644aafb` |
| Production branch | `master` |
| Predecessor | PR #75 — Commercial Beta Launch Readiness Plan |
| Architecture rule | AI → parsed → structured artifacts → deterministic system logic → UI |
| Final deployment authority | Stefan |

This document establishes the environment contract that must exist before
payment-sensitive implementation begins. It does not prove provider-dashboard
configuration that is not represented in the repository. External setup remains
`manual setup required` until an authorised human records evidence.

## 1. Purpose and protected boundary

The deployment model is:

```text
master
→ production

pull-request previews
→ bounded review deployments

staging
→ isolated integration and commercial validation
```

Critical rule:

```text
Staging and previews must never modify production users,
subscriptions, credits, billing records, webhook records,
account state, or owner-commercial data.
```

PR #76 does not implement payment, checkout, webhooks, subscriptions, paid
credits, Auth0 changes, Prisma schema changes, owner surfaces, notifications,
product UI, onboarding, trust-page changes, Review Score, or Release Readiness.
The current product behaviour remains protected.

## 2. Status vocabulary

Every environment control uses one of these evidence states:

| Status | Meaning |
|---|---|
| `implemented` | The repository contains a control that was inspected and can be validated locally |
| `manual setup required` | The control belongs in Vercel or a provider dashboard and needs human configuration plus evidence |
| `blocked by external provider` | The control depends on a provider account, approval, product, credential, or capability not yet available |
| `deferred with explicit risk` | The gap is understood and accepted temporarily with a named boundary and later resolution point |

Documentation is not evidence that a dashboard control is configured.

## 3. Repository inspection summary

### Deployment configuration

- `master` is the production branch by approved commercial decision.
- No committed `vercel.json` exists.
- No local `.vercel` project metadata was present during the PR #76 audit.
- The repository therefore cannot prove the Vercel project, production-branch
  setting, staging project, environment-variable scopes, deployment protection,
  or preview-secret policy.
- `package.json` defines:

  ```text
  npm run build
  → prisma migrate deploy && next build
  ```

- Every Vercel build with a usable `DATABASE_URL` can therefore attempt pending
  database migrations before the Next.js build.
- A preview with production database credentials would create a production
  schema risk even if no preview user opens the application.

Classification: `manual setup required`.

### Current environment loading

- `lib/env.ts` is server-only and requires the current application variables.
- Missing required variables fail fast when the module is imported.
- `lib/auth0.ts`, `lib/openai.ts`, `lib/redis.ts`, and `lib/prisma.ts` consume
  central server-only configuration.
- `prisma.config.ts` loads `DATABASE_URL` directly for Prisma commands.
- Logging and internal cost estimation read optional server-side variables
  directly.
- No committed application reference to `NEXT_PUBLIC_*` was found.
- No current Lemon Squeezy environment variable or runtime integration exists.
- `NODE_ENV` and `VERCEL_ENV` are platform/runtime metadata, not sufficient
  proof of provider-resource identity.

Classification: required-variable validation is `implemented`; cross-provider
identity validation is `manual setup required`.

### Local environment files and template

- `.env` and `.env.local` exist locally and are ignored.
- The broad `.env*` ignore rule previously also ignored `.env.example`.
- PR #76 adds a narrow `!.env.example` exception and a placeholder-only root
  template.
- Real values remain ignored and must not be copied into the template, docs,
  logs, screenshots, issues, or pull requests.

Classification: `implemented`.

### Redis isolation

- Rate-limit keys derive an environment prefix from `VERCEL_ENV`.
- The current stages are `prod`, `preview`, and `dev`; there is no distinct
  runtime `staging` stage.
- Chat-metric buckets and the admin metric reader currently use unprefixed
  metric keys.
- A shared Redis resource could therefore mix metric data even though
  rate-limit keys are prefixed.
- Separate Redis resources and credentials are required for staging and
  production. Prefixes are defense in depth, not permission to share.

Classification: separate resources are `manual setup required`; unprefixed
metric-bucket hardening is `deferred with explicit risk`.

The deferred metric risk affects operational telemetry only. It does not change
billing, credits, account state, workflow state, or user entitlement. It must be
reviewed before any decision to share a Redis resource, which is not the target
model.

### Production URL assumptions

- `APP_BASE_URL` is required centrally and is passed to the Auth0 client.
- Auth0 audience and role-claim namespaces are currently fixed server code.
- Public marketing contains the approved public contact domain, but no runtime
  production origin replaces `APP_BASE_URL`.
- QA configuration defaults to local host and accepts an explicit `BASE_URL`.
- No committed Vercel preview URL or production deployment URL was found.

Classification: application URL configuration is `implemented`; provider
callback/origin alignment is `manual setup required`.

### What the repository cannot prove

The repository cannot verify whether:

- Vercel Production variables are excluded from Preview;
- a dedicated staging Vercel project or environment exists;
- production and staging Auth0 applications are separate;
- production and staging Supabase/Postgres resources are separate;
- preview builds have production database write access;
- Upstash and OpenAI credentials are environment-specific;
- production secret rotation and break-glass access are configured; or
- Lemon Squeezy test/live resources and notification channels exist.

Until evidence is recorded, these are not assumed safe.

## 4. Target environment matrix

| Concern | Preview | Staging | Production | Current evidence status |
|---|---|---|---|---|
| Deployment | PR preview, short-lived and bounded | Dedicated stable staging project/environment | `master` production deployment | Vercel mapping: `manual setup required` |
| Environment identity | `preview` | Explicit `staging` identity | Explicit `production` identity | Preview/prod Vercel metadata partially available at runtime; staging identity `manual setup required` |
| Auth0 | No production authority; selected non-production client only | Dedicated staging client/tenant | Dedicated production client/tenant | `manual setup required` |
| Database | No production write credentials; disposable/isolated data only | Dedicated staging database | Production database | `manual setup required` |
| Prisma migration | Must not target production; disabled by missing DB credentials or isolated DB | Staging migrations only after review | Production migrations through approved `master` release | Build behavior `implemented`; safe scopes `manual setup required` |
| Redis | Preview-safe isolated resource, or no resource | Dedicated staging resource | Dedicated production resource | Prefixing partial; resource separation `manual setup required` |
| OpenAI | No production key; disabled or preview-specific low-budget project | Staging project/key and spend cap | Production project/key and spend cap | `manual setup required` |
| Lemon Squeezy | No live credentials or IDs; test mode only when explicitly trusted | Test-mode API key, product/variant IDs, webhook secret and endpoint | Live-mode API key, product/variant IDs, webhook secret and endpoint | `blocked by external provider` |
| Webhook | Disabled by default; temporary test endpoint only when approved | Stable staging/test endpoint | Stable production/live endpoint | No implementation; `blocked by external provider` |
| Notifications | Disabled or non-production sink, visibly test-labelled | Test recipient/channel and test-labelled content | Approved owner production channel | No implementation; `blocked by external provider` |
| Secrets | Restricted; never inherit Production values | Staging-scoped | Production-scoped | Repository discipline `implemented`; Vercel scopes `manual setup required` |
| Product IDs | Test-only if explicitly needed | Test IDs | Live IDs | `blocked by external provider` |
| URLs | Exact preview domain only for bounded QA | Stable staging domain | `https://releasesignal.io` or approved production origin | Domains/provider settings `manual setup required` |
| Owner-commercial data | No access | Staging test data only | Production owner-authorised data | Future owner implementation; isolation `manual setup required` |

Staging must not be implemented as an unrestricted PR preview that inherits
Preview variables. It needs a stable identity and isolated provider resources.

## 5. Environment-variable inventory

No values are recorded here.

### Current application variables

| Variable | Purpose | Visibility | Production | Staging | Preview policy | Secret | Expected owner | Rotation | Missing behavior |
|---|---|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | Runtime Postgres connection and current Prisma command connection | Server only | Required, production DB | Required, staging DB | No production value; isolated preview DB only when explicitly needed | Yes | Database/operator | On exposure, role change, or scheduled policy | `lib/env.ts` fails; Prisma command fails |
| `DIRECT_URL` | Direct Postgres connection required by current server environment contract | Server only | Required by current app config | Staging-specific | No production value | Yes | Database/operator | With database credentials | `lib/env.ts` fails when imported |
| `AUTH0_DOMAIN` | Auth0 tenant/application domain | Server only | Production tenant/app | Staging tenant/app | Selected non-production app only | Configuration-sensitive | Identity/operator | On tenant/app migration | `lib/env.ts` fails |
| `AUTH0_CLIENT_ID` | Auth0 application identifier | Server only | Production client | Staging client | Non-production client only | Treat as sensitive configuration | Identity/operator | On app replacement | `lib/env.ts` fails |
| `AUTH0_CLIENT_SECRET` | Auth0 application secret | Server only | Production secret | Staging secret | Never production; omit unless trusted auth preview | Yes | Identity/operator | Immediate on exposure; provider policy | `lib/env.ts` fails |
| `AUTH0_SECRET` | Auth0 session/cookie encryption secret | Server only | Production-specific | Staging-specific | Never production; preview-specific only if authentication is enabled | Yes | Identity/operator | Immediate on exposure; planned session rotation | `lib/env.ts` fails |
| `APP_BASE_URL` | Canonical application origin used by Auth0 | Server only | Approved production origin | Stable staging origin | Exact selected preview origin only | No, but security-sensitive | Deployment/identity operator | On domain/environment change | `lib/env.ts` fails; auth redirects/callbacks can break |
| `UPSTASH_REDIS_REST_URL` | Redis endpoint | Server only | Production resource | Staging resource | Preview resource or omitted | Configuration-sensitive | Infrastructure/operator | With Redis credential/resource change | `lib/env.ts` fails |
| `UPSTASH_REDIS_REST_TOKEN` | Redis credential | Server only | Production token | Staging token | Never production | Yes | Infrastructure/operator | Immediate on exposure; provider policy | `lib/env.ts` fails |
| `OPENAI_API_KEY` | AI provider authentication | Server only | Production project/key | Staging project/key | No production key; omit or low-budget preview key | Yes | AI budget/operator | Immediate on exposure; scheduled policy | `lib/env.ts` fails |
| `NODE_ENV` | Framework/runtime mode | Runtime metadata | Platform-managed | Platform-managed | Platform-managed | No | Platform | Not applicable | Defaults to `development` in central environment object |
| `VERCEL_ENV` | Vercel production/preview/development context; Redis stage input | Server/runtime metadata | `production` | Usually `preview` unless staging is explicitly distinguished | `preview` | No | Vercel | Not applicable | Current code falls back to dev behavior |
| `ENABLE_VERBOSE_LOGS` | Optional production info-log override | Server only | Optional, normally false | Optional | False/omitted | No | Operations | Not applicable | Normal sampling behavior |
| `LOG_INFO_SAMPLE_RATE` | Optional info-log sample rate | Server only | Optional | Optional | Optional | No | Operations | Review with logging policy | Defaults to `0.20` |
| `USD_TO_EUR` | Optional internal cost-estimate conversion | Server only | Optional | Optional | Omit unless needed | No, operational input | AI budget/operator | When estimate assumption changes | EUR estimate omitted |

`REDIS_PREFIX` and `RUNTIME_STAGE` are derived values, not configured secrets.
They do not identify the database, Auth0 client, OpenAI project, or provider
mode.

### QA-only variables

`qa/.env.example` documents local/live-test inputs such as `BASE_URL`, dedicated
test credentials, storage-state paths, session IDs, and explicit opt-ins. These
are test-runner variables, not application runtime configuration. Real QA
credentials and storage states remain ignored.

### Future payment-sensitive variables

PR #76 does not add these variables. Before PR #80 or any provider integration,
the implementing PR must inventory and validate:

- an explicit Release Signal deployment identity capable of distinguishing
  `preview`, `staging`, and `production`;
- Lemon Squeezy mode;
- mode-specific API key;
- mode-specific webhook secret;
- mode-specific store/product/variant identifiers;
- mode-specific webhook origin;
- mode-specific checkout/return/portal origins;
- checkout and webhook disable controls; and
- notification environment/channel.

Names must be chosen in the implementing PR from actual provider requirements.
No payment code may infer live/test mode from a product ID or URL alone.

## 6. Repository controls implemented by PR #76

### Placeholder-only root template

`.env.example` now lists current application variables with placeholders only.
It:

- contains no provider values or identifiers;
- is permitted through a narrow `.gitignore` exception;
- does not change runtime loading;
- does not create environment resources; and
- does not claim staging/production separation is complete.

### Existing controls preserved

- `lib/env.ts`, provider clients, database, and Redis helpers remain server-only.
- Required current variables fail fast when missing.
- No `NEXT_PUBLIC_*` secret is introduced.
- `.env`, `.env.local`, and other `.env*` files remain ignored.
- `.vercel` remains ignored.
- Redis rate-limit namespaces remain derived from Vercel context.

No runtime code or provider configuration changes in PR #76.

## 7. Secret discipline

### Required rules

- Real secrets live only in approved local ignored files or provider-managed
  secret stores.
- Never commit `.env`, `.env.local`, downloaded Vercel environment files,
  Auth0 secrets, database URLs, Redis tokens, OpenAI keys, webhook secrets, or
  notification credentials.
- `.env.example` contains placeholders only.
- No server credential may use `NEXT_PUBLIC_*`.
- Production variables must not be available to unsafe previews.
- Production, staging, and preview credentials must be separate.
- Test/live Lemon Squeezy secrets and identifiers must be separate.
- A secret value must not be used as an environment identity signal.
- Logs, errors, screenshots, PRs, issues, and evidence must redact secrets,
  database hosts where sensitive, signatures, cookies, and authorization
  headers.

### Vercel scope policy

| Variable class | Production | Preview | Development |
|---|---|---|---|
| Production credentials | Production only | Never | Never |
| Staging credentials | Never | Only the dedicated staging target or project | Only when explicitly testing staging |
| Bounded preview credentials | Never | Selected trusted previews only | Optional local test values |
| Local credentials | Never | Never | Ignored local file only |

If Vercel cannot scope a stable staging target safely within one project, use a
dedicated staging project. Forked/untrusted previews receive no secrets.

### Rotation procedure

1. Identify the exact environment and consumers.
2. Create a replacement credential with least privilege.
3. Configure it only in the intended provider scope.
4. deploy and validate the intended environment.
5. Revoke the old credential.
6. Verify lower environments cannot use either production credential.
7. Record date, owner, affected service, and validation without recording the
   value.

For session or signing secrets, document expected session/webhook effects and
coordinate rotation to avoid silently accepting two environments as one.

### Accidental-exposure response

1. Disable or rotate the exposed credential immediately.
2. Disable the affected deployment/integration when continuing would increase
   impact.
3. Identify repository, build, preview, log, and provider exposure.
4. Remove the value from current content and follow an approved history-cleanup
   process where necessary.
5. Review provider access, database, payment, and webhook logs.
6. replace the credential in the correct environment scope only.
7. Validate denial from other environments.
8. Record incident impact and follow-up without reproducing the secret.

Deleting a value from the latest commit is not sufficient remediation.

## 8. Preview deployment policy

Preview is a bounded review surface, not staging and not production approval.

- Production database write credentials are prohibited.
- Production Auth0 client secrets and authority assumptions are prohibited.
- Production Redis, OpenAI, Lemon Squeezy, webhook, and notification credentials
  are prohibited.
- Live provider product/variant IDs are prohibited.
- Payment-sensitive routes and webhooks are disabled by default.
- A selected preview requiring authentication or provider testing must use
  non-production resources and an exact approved callback/return URL.
- The approval must identify branch, purpose, resource set, reviewer, and
  expiration/removal point.
- Forked or otherwise untrusted previews receive no secrets.
- Preview data is disposable, labelled, and contains no production user data.
- A green preview proves only that the preview built and its bounded checks
  passed.

### Preview database rule

Because `npm run build` runs `prisma migrate deploy`, the safest default is no
database credential in previews that do not explicitly require a full build
against an isolated preview database. If Vercel requires the build-time
variables, they must target an isolated non-production database whose migration
and cleanup policy is approved.

Giving a preview production `DATABASE_URL` is a release blocker.

Classification:

```text
Operationally blocking before implementation PR previews are trusted.
```

## 9. Staging setup requirements

Staging is a stable isolated integration environment, not an arbitrary PR
preview.

- Dedicated Vercel staging project/environment and stable domain.
- Explicit staging deployment identity distinct from generic preview.
- Dedicated Auth0 tenant/application, API audience/claims configuration,
  callbacks, logout URLs, and allowed origins.
- Dedicated Supabase/Postgres project/database, roles, backups, and migration
  path.
- Dedicated Upstash Redis resource and token.
- Dedicated OpenAI project/key with staging spend limit.
- Lemon Squeezy test mode only, after provider work begins.
- Staging webhook endpoint and test secret only.
- Test product and variant IDs only.
- Test-labelled, non-production notification recipient/channel.
- Staging-specific checkout, return, and portal URLs.
- Synthetic/test accounts and data only.

The staging resource inventory must record provider resource names/IDs in a
private operations location where necessary. Repository evidence records only
completion status, not credentials.

## 10. Production deployment policy

Every merge to `master` is a production release.

Before merge:

1. Confirm approved scope and review requirements.
2. Confirm production safety of every changed file.
3. Review migrations and build-time side effects.
4. Run validation proportionate to the change.
5. Confirm required secrets/configuration already exist in correct scopes.
6. Confirm no manual dashboard step is being assumed silently.
7. Record rollback/disable steps and last known good deployment.
8. Obtain Stefan's approval.

Payment-sensitive PRs additionally require:

- staging validation before live configuration;
- explicit environment-mismatch tests;
- no return/email/frontend authority;
- verified webhook plus database authority;
- idempotency and recovery review;
- checkout/webhook disable controls; and
- Claude review before merge.

Preview success does not equal production approval. Live configuration must not
be added merely to make a preview pass.

## 11. Future environment-mismatch contract

Before payment-sensitive runtime code is merged, it must use a server-only,
explicit Release Signal environment identity that distinguishes:

```text
development
preview
staging
production
```

Vercel's `VERCEL_ENV=preview` cannot by itself distinguish a dedicated staging
deployment from a PR preview. The explicit identity must be validated against
Vercel context and the configured provider mode. Missing, unknown, or
contradictory identity fails closed.

At minimum, future payment code must reject:

- live Lemon Squeezy credentials in staging or preview;
- test credentials in production;
- live product/variant IDs in test mode;
- test product/variant IDs in live mode;
- production webhook or return origins in staging;
- staging webhook or return origins in production;
- production database/resource fingerprints in staging or preview;
- staging database/resource fingerprints in production; and
- missing or ambiguous environment identity.

Comparison must use non-secret provider/resource identity metadata or an
approved allowlist, not log or expose full credential values. Environment
guards supplement provider scopes and separate resources; they do not replace
them.

## 12. Rollback and disable policy

### Application deployment rollback

- Record the last known good Vercel production deployment before release.
- Roll back application code through the reviewed Vercel/Git process.
- Confirm the rollback target uses production-scoped configuration.
- Validate authentication, account state, protected routes, database access,
  Redis, and OpenAI after rollback.

### Database safety

- Git/Vercel rollback does not reverse an applied migration.
- Preserve billing, wallet, ledger, subscription, event, and audit history.
- Review every migration before merge because the build command deploys it.
- Risky migrations need a backup/restore or forward-repair plan.
- Never point staging/preview at production to avoid creating a staging
  migration path.

### Secret/configuration rollback

- Restore the last reviewed configuration only when it remains uncompromised.
- Rotate rather than restore an exposed credential.
- Validate the exact target environment after a change.
- Never copy a production credential into staging or preview as rollback.

### Future commercial disable controls

Future provider PRs must support disabling new checkout and safely containing
webhook processing without deleting event, subscription, wallet, or ledger
history. PR #76 defines this requirement but implements no commercial switch.

## 13. Manual external setup checklist

### Vercel — `manual setup required`

- [ ] Confirm repository/project connection.
- [ ] Confirm `master` is the production branch.
- [ ] Create or confirm dedicated staging project/environment and stable domain.
- [ ] Scope Production variables to Production only.
- [ ] Exclude production secrets from Preview and forked deployments.
- [ ] Decide whether ordinary previews build without provider credentials or
      use isolated preview resources.
- [ ] Verify build-time `DATABASE_URL` can never target production in preview.
- [ ] Configure deployment protection for staging/privileged previews.
- [ ] Record last known good deployment and rollback ownership.

### Auth0 — `manual setup required`

- [ ] Separate production and staging applications/tenants.
- [ ] Configure exact callback, logout, and allowed-origin URLs per environment.
- [ ] Keep production secret and session secret out of previews.
- [ ] Verify API audience and role claims in each environment.
- [ ] Do not infer production owner authority in staging/preview.
- [ ] Record secret rotation and emergency revocation ownership.

### Supabase/Postgres — `manual setup required`

- [ ] Separate production and staging projects/databases.
- [ ] Use least-privilege, environment-specific roles and credentials.
- [ ] Prevent production network/credential access from previews.
- [ ] Provide an isolated database or no database for preview builds.
- [ ] Confirm backups and restore/forward-repair ownership.
- [ ] Review the `prisma migrate deploy` build effect for each deployment class.

### Upstash Redis — `manual setup required`

- [ ] Separate production and staging resources/tokens.
- [ ] Use a preview-specific resource only when needed.
- [ ] Confirm production tokens are excluded from Preview.
- [ ] Do not rely solely on `REDIS_PREFIX`.
- [ ] Track unprefixed metric buckets as a known isolation limitation.

### OpenAI — `manual setup required`

- [ ] Separate production and staging projects/keys.
- [ ] Configure provider-side budgets/spend limits.
- [ ] Exclude production key from previews.
- [ ] Define owner and rotation process.

### Lemon Squeezy — `blocked by external provider`

- [ ] Keep test and live credentials, products, variants, webhooks, and secrets
      separate.
- [ ] Configure only test mode in staging.
- [ ] Add live resources only after provider approval and the live gate.
- [ ] Define provider fallback environment cleanup if Lemon Squeezy is
      unremediably rejected.

### Owner notifications — `blocked by external provider`

- [ ] Select provider later.
- [ ] Separate test recipient/channel from production owner channel.
- [ ] Mark staging notifications clearly as tests.
- [ ] Define credential rotation and owner break-glass recovery before
      owner-only routes exist.

## 14. Validation and evidence checklist

### Repository validation

- [ ] Only approved PR #76 files changed.
- [ ] `.env` and `.env.local` remain ignored.
- [ ] `.env.example` is tracked and contains placeholders only.
- [ ] No credential, token, signature, provider ID, or private dashboard value
      appears in the diff.
- [ ] No server secret is exposed with `NEXT_PUBLIC_*`.
- [ ] No runtime or product behavior changed.
- [ ] `git diff --check` passes.

### Manual environment evidence

For each provider, record:

| Evidence field | Required value |
|---|---|
| Environment | Preview, staging, or production |
| Provider/resource | Non-sensitive descriptive name |
| Control | Scope/separation being verified |
| Status | Implemented, manual setup required, blocked, or deferred |
| Owner | Authorised human |
| Date | Validation date |
| Evidence location | Private provider/operations reference |
| Result | Pass, limitation, or blocker |
| Follow-up | Ticket/PR and due gate |

Do not put screenshots containing secrets, personal identity documents,
credentials, or full environment values in the repository.

## 15. Known limitations and blockers

### Blocking before privileged staging or payment work

- Repository evidence cannot prove Vercel secret scopes or staging project
  isolation.
- Separate staging Auth0, database, Redis, and OpenAI resources are not proven.
- Preview build access to production `DATABASE_URL` is not proven impossible.
- No explicit runtime identity currently distinguishes staging from a generic
  Vercel preview.

These require manual setup/evidence before PR #80 or any payment-sensitive
runtime work. They do not block PR #77's approval-checklist and evidence
framework work, provided PR #77 performs no payment integration and does not
claim the store is already submittable.

Privileged staging, Auth0-commercial, payment, webhook, subscription, and
paid-credit work remains blocked until external separation evidence exists.

### Deferred with explicit risk

- Chat-metric Redis keys are not environment-prefixed. Separate Redis resources
  are mandatory; a later bounded observability hardening PR may add prefixing to
  both writer and reader.
- Current environment validation checks presence, not resource identity.
  Payment-sensitive code must implement the mismatch contract before use.
- No repository guard can prove external dashboards are configured correctly.
  Human evidence and provider access controls remain required.

### Carried downstream planning inputs relevant to environment safety

- Define an isolated provider fallback and revoke/remove Lemon Squeezy
  configuration if Lemon Squeezy is unremediably rejected.
- Keep PR #82 combined, but stage schema/lifecycle review before credit and
  ledger integration; migration and rollback evidence are required before its
  `master` merge.
- Define explicit owner break-glass recovery before owner-only routes and
  production notification credentials are implemented.

## 16. Deferred product contradictions

PR #76 does not fix:

1. Marketing's 10-day trial versus 15-day server provisioning — blocking before
   controlled external beta; planned for PR #79 after an explicit duration
   decision.
2. Advertised `contact@releasesignal.io` versus unfinished Contact-page wording
   — blocking before controlled external beta; planned for PR #79.
3. Admin credit-display documentation versus current stored-balance display —
   commercial-semantics clarification required before paid launch.

No billing, admin bypass, wallet, ledger, trial, support-page, or UI semantics
change here.

## 17. Operational ownership

| Area | Primary decision owner | Implementation/evidence responsibility |
|---|---|---|
| Production release and rollback | Stefan | Deployment operator |
| Vercel projects and scopes | Stefan | Deployment operator |
| Auth0 applications and claims | Stefan | Identity operator |
| Supabase/Postgres and backups | Stefan | Database operator |
| Upstash isolation | Stefan | Infrastructure operator |
| OpenAI keys and budget | Stefan | AI budget operator |
| Lemon Squeezy test/live setup | Stefan | Commercial/provider operator |
| Owner notification credentials | Stefan | Commercial/operations owner |
| Code review recommendation | Claude Code | Review only |

Claude Code must review environment isolation, preview restrictions, database
build risk, secret exposure, Auth0/resource separation, mismatch contracts,
rollback safety, scope discipline, and whether PR #77 may safely begin.

## 18. PR #76 completion boundary

PR #76 is complete in the repository when:

- the current environment behavior and limitations are accurately documented;
- production, staging, and preview boundaries are explicit;
- current variables, ownership, failure behavior, and rotation are inventoried;
- the root environment template contains placeholders only;
- unsafe preview access is blocked by explicit manual prerequisites until
  external evidence is complete;
- future payment PRs have a fail-closed mismatch contract;
- every `master` merge is treated as production;
- no runtime or protected product behavior changes; and
- Claude review reports no blocking finding before merge.

PR #77 documentation/evidence-framework work may begin after PR #76 review and
merge. Payment-sensitive runtime work may not begin until the manual environment
blockers relevant to that work have evidence.
