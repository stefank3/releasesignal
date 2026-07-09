# Billing Wallet/Ledger Integrity Audit

PR #64C.8 is a read-only audit. It does not mutate database data, change
billing behavior, change Prisma schema, change Auth0 or admin semantics, or
change any runtime route.

## Executive Summary

Current runtime behavior treats `CreditWallet.balance` as the authoritative
remaining-credit balance.

`CreditLedger` is intended to be an audit trail for credit grants,
administrative adjustments, and chat usage charges. For current code paths that
create new trial grants, admin top-ups, or chat usage charges, the wallet and
ledger are updated together in a transaction. In that current model, a wallet's
balance should normally reconcile to the sum of its ledger deltas.

However, existing repository history and the PR #64C.7 read-only database check
show that some existing wallets do not reconcile with ledger sums. The safest
classification is:

```text
Option B: Wallet and ledger should reconcile for current deterministic paths,
but historical data is inconsistent.
```

There is also an admin-specific display nuance:

```text
Admin users can have wallet balances, but /api/chat uses admin credit bypass.
```

That means an admin wallet balance can be real database state while still being
misleading as a "credits left" product signal.

## Current Credit Data Model

Relevant Prisma models:

- `Organization`
- `OrgMember`
- `Subscription`
- `CreditWallet`
- `CreditLedger`

`CreditWallet` stores one balance per organization and currency:

```text
CreditWallet.organizationId
CreditWallet.currency
CreditWallet.balance
```

`CreditLedger` stores credit movements:

```text
CreditLedger.walletId
CreditLedger.auth0Sub
CreditLedger.delta
CreditLedger.reason
CreditLedger.requestId
```

The schema enforces one wallet per organization/currency through:

```text
@@unique([organizationId, currency])
```

The ledger has an idempotency-oriented uniqueness constraint:

```text
@@unique([walletId, reason, requestId])
```

Because PostgreSQL permits multiple `NULL` values in unique indexes,
`requestId = null` rows are not globally idempotent. Current runtime write paths
use request IDs for trial grants, admin adjustments, and chat usage.

## Source-Of-Truth Assessment

The operational source of truth for remaining credits is currently:

```text
CreditWallet.balance
```

Evidence:

- `/api/me` returns `creditsRemaining: orgState.wallet.balance`.
- `lib/billing/accountAccess.ts` checks `params.wallet.balance <= 0` to block
  insufficient credits.
- `lib/billing/chargeCredits.ts` locks the wallet row, checks
  `lockedWallet.balance`, writes a `chat_usage` ledger row, then decrements the
  wallet.
- `lib/chat/persist.ts` returns the post-charge wallet balance from
  `chargeCreditsTx(...)`.

`CreditLedger` is not read by `/api/me` or the pre-call access check to compute
remaining credits. It is an audit/idempotency record used by write flows, not
the runtime balance calculator.

## Wallet Creation Flow

`ensureOrgForUser(...)` is the central provisioning helper.

When an `OrgMember` already exists:

- it loads the existing `CreditWallet` for the member organization and
  `currency = "credits"`;
- if the wallet is missing, it creates one with `balance = 0`;
- it does not create a matching ledger row for that missing-wallet repair path.

For a new Auth0 admin:

- it creates an organization;
- it creates an `OrgMember` with `role = "admin"`;
- it creates a `CreditWallet` with `balance = 0`;
- it does not create a ledger row.

For a new non-admin trial organization:

- it creates an organization;
- it creates an `OrgMember` with `role = "admin"` as organization role;
- it creates a `CreditWallet` with `balance = 100`;
- it creates a `trialing` `Subscription` with `monthlyCredits = 100`;
- it creates a `CreditLedger` row with `delta = 100`,
  `reason = "trial_grant"`, and a deterministic request ID.

## Ledger Creation Flow

Current code creates ledger rows in these main paths:

- `ensureOrgForUser(...)` creates `trial_grant` ledger rows for new non-admin
  trial organizations.
- `chargeCreditsTx(...)` creates negative `chat_usage` ledger rows for charged
  AI usage.
- `app/api/admin/billing/topup/route.ts` creates positive `admin_adjust` ledger
  rows for admin top-ups.

The admin top-up route creates the ledger row before incrementing the wallet in
the same transaction.

The chat charge route creates the ledger row before decrementing the wallet in
the same transaction.

## Charge Flow

AI-backed `/api/chat` requests call `ensureBillingPreconditions(...)`.

For non-admin users:

1. `ensureOrgForUser(...)` resolves organization and wallet state.
2. `evaluateAccountAccess(...)` verifies subscription/account status and checks
   that wallet balance is greater than zero.
3. The model call runs.
4. `persistAssistantWithBillingTx(...)` calls `chargeCreditsTx(...)`.
5. `chargeCreditsTx(...)` locks the wallet row, checks balance, creates a
   `chat_usage` ledger row, decrements the wallet, and returns the new balance.

This means the pre-call gate checks only positive balance. The final charge
amount is known after model usage is available and may still fail if the final
charge exceeds the remaining balance.

## Admin Bypass Behavior

`ensureBillingPreconditions(...)` checks Auth0 admin status using
`isAdminFromAccessToken()`.

For Auth0 admins:

- it still calls `ensureOrgForUser(...)`;
- it still returns an organization and wallet;
- it returns `skipCreditCharge: true`;
- downstream persistence skips `chargeCreditsTx(...)`.

Therefore admin wallets can exist and can hold balances, but admin `/api/chat`
usage is not charged. PR #64C.7 changed the header display for admins to
`Credits: admin` so the UI does not imply that admin usage consumes the shown
wallet balance.

## Trial And Default Allocation Behavior

Current trial provisioning constants live in `lib/billing/ensureOrgForUser.ts`:

```text
trial duration: 15 days
starting credits: 100
planCode: trial_v1
subscription status: trialing
seats: 1
grant reason: trial_grant
```

New non-admin trial organizations receive both:

- `CreditWallet.balance = 100`
- `CreditLedger.delta = 100`

No current normal trial provisioning path creates a `1000` wallet balance.

## Observed Mismatch Summary

During PR #64C.7, a read-only database check reported:

```text
walletCount = 13
walletsWithBalance1000 = 1
mismatchCount = 7
one wallet had CreditWallet.balance = 1000
the same wallet had ledgerSum = 100
```

The same check found the `1000` wallet attached to an organization with an
active historical `office_50` subscription and `monthlyCredits = 1000`.

Code search found no current generic runtime fallback that silently defaults
wallet balance to `1000`. The visible `1000` was real stored wallet state, not a
hardcoded UI default.

## Mismatch Classification Plan

PR #64C.9 keeps the audit read-only and does not decide cleanup. The next safe
step is to classify each wallet/ledger mismatch with enough evidence to
distinguish historical/admin/test data from active non-admin account risk.

The recommended current outcome is:

```text
Option C: Current data is insufficient for safe cleanup; add safer read-only
diagnostics first.
```

The PR #64C.7 read-only check suggests the known `1000` wallet is historical or
admin/test-adjacent because it is tied to `office_50` data and no current code
path grants `1000` trial credits. That is not enough to conclude that all
mismatches are harmless. Stored `OrgMember.role = "admin"` is organization role
data, not Auth0 app-admin evidence, and duplicate membership can make the
runtime-selected organization ambiguous.

### Classification Dimensions

Each mismatched wallet should be classified using these dimensions:

- Auth0 admin evidence: manually reviewed Auth0 role evidence, not
  `OrgMember.role` alone.
- Stored organization role evidence: useful for DB hygiene, but not runtime
  app-admin truth.
- Runtime organization selection: whether `findFirst({ auth0Sub })` paths can
  select this organization for the user.
- Subscription evidence: latest plan/status, including `trial_v1`,
  `standard_v1`, historical `office_50`, missing subscription, expired trial,
  or stale active subscription.
- Wallet evidence: `CreditWallet.balance`, currency, creation time, update
  time, and whether the wallet may have been created through missing-wallet
  repair with `balance = 0`.
- Ledger evidence: summed deltas, count by reason, positive grant totals,
  negative charge totals, `NULL` request IDs, duplicate request IDs, and
  ledger rows without matching wallet balance.
- Activity evidence: chat sessions, chat messages, telemetry, recent
  `chat_usage` ledger rows, and admin top-up history.
- Historical/test indicators: legacy plan codes, placeholder organization
  names, inactive rows, no recent activity, and values that match old
  allocations but not current constants.
- Real-user risk: active non-admin account state, visible finite credit
  display, and a wallet used by `/api/chat` charging.

### Read-Only SQL Shape

The following SQL is a safe classification shape for a future audit script or
manual console run. It is intentionally read-only and keeps Auth0 evidence as an
empty local CTE so committed docs do not contain real identifiers.

```sql
WITH expected_auth0_roles(auth0_sub, is_auth0_admin, evidence) AS (
  SELECT
    NULL::text AS auth0_sub,
    NULL::boolean AS is_auth0_admin,
    NULL::text AS evidence
  WHERE false
),
ledger_by_wallet AS (
  SELECT
    cw.id AS wallet_id,
    cw."organizationId" AS organization_id,
    cw.currency,
    cw.balance,
    cw."createdAt" AS wallet_created_at,
    cw."updatedAt" AS wallet_updated_at,
    COALESCE(SUM(cl.delta), 0) AS ledger_sum,
    COUNT(cl.id) AS ledger_count,
    COUNT(cl.id) FILTER (WHERE cl.reason = 'trial_grant') AS trial_grant_count,
    COALESCE(SUM(cl.delta) FILTER (WHERE cl.reason = 'trial_grant'), 0) AS trial_grant_sum,
    COUNT(cl.id) FILTER (WHERE cl.reason = 'chat_usage') AS chat_usage_count,
    COALESCE(SUM(cl.delta) FILTER (WHERE cl.reason = 'chat_usage'), 0) AS chat_usage_sum,
    COUNT(cl.id) FILTER (WHERE cl.reason LIKE 'admin_adjust%') AS admin_adjust_count,
    COALESCE(SUM(cl.delta) FILTER (WHERE cl.reason LIKE 'admin_adjust%'), 0) AS admin_adjust_sum,
    COUNT(cl.id) FILTER (WHERE cl."requestId" IS NULL) AS null_request_id_count,
    MIN(cl."createdAt") AS first_ledger_at,
    MAX(cl."createdAt") AS last_ledger_at
  FROM "CreditWallet" cw
  LEFT JOIN "CreditLedger" cl ON cl."walletId" = cw.id
  GROUP BY cw.id, cw."organizationId", cw.currency, cw.balance, cw."createdAt", cw."updatedAt"
),
latest_subscription AS (
  SELECT *
  FROM (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        PARTITION BY s."organizationId"
        ORDER BY s."createdAt" DESC, s.id DESC
      ) AS rn
    FROM "Subscription" s
  ) ranked
  WHERE rn = 1
),
member_rollup AS (
  SELECT
    om."organizationId" AS organization_id,
    COUNT(*) AS member_count,
    COUNT(DISTINCT om."auth0Sub") AS distinct_auth0_sub_count,
    BOOL_OR(om.role = 'admin') AS has_stored_org_admin,
    BOOL_OR(er.is_auth0_admin = true) AS has_reviewed_auth0_admin,
    BOOL_OR(er.is_auth0_admin = false) AS has_reviewed_auth0_non_admin,
    COUNT(er.auth0_sub) AS reviewed_auth0_subject_count
  FROM "OrgMember" om
  LEFT JOIN expected_auth0_roles er ON er.auth0_sub = om."auth0Sub"
  GROUP BY om."organizationId"
),
org_activity AS (
  SELECT
    o.id AS organization_id,
    COUNT(DISTINCT cs.id) AS chat_session_count,
    COUNT(DISTINCT cm.id) AS chat_message_count,
    COUNT(DISTINCT tel.id) AS telemetry_count,
    MAX(cs."updatedAt") AS last_chat_session_at,
    MAX(cm."createdAt") AS last_chat_message_at,
    MAX(tel."createdAt") AS last_telemetry_at
  FROM "Organization" o
  LEFT JOIN "OrgMember" om ON om."organizationId" = o.id
  LEFT JOIN "ChatSession" cs ON cs."auth0Sub" = om."auth0Sub"
  LEFT JOIN "ChatMessage" cm ON cm."auth0Sub" = om."auth0Sub"
  LEFT JOIN "TelemetryEventLog" tel ON tel."organizationId" = o.id
  GROUP BY o.id
),
classified_mismatches AS (
  SELECT
    md5(l.organization_id) AS anonymized_organization_id,
    l.currency,
    l.balance AS wallet_balance,
    l.ledger_sum,
    l.balance - l.ledger_sum AS unreconciled_delta,
    l.ledger_count,
    l.trial_grant_count,
    l.trial_grant_sum,
    l.chat_usage_count,
    l.chat_usage_sum,
    l.admin_adjust_count,
    l.admin_adjust_sum,
    l.null_request_id_count,
    s.status AS latest_subscription_status,
    s."planCode" AS latest_subscription_plan_code,
    s."monthlyCredits" AS latest_monthly_credits,
    s."currentPeriodEnd" AS latest_current_period_end,
    COALESCE(m.member_count, 0) AS member_count,
    COALESCE(m.distinct_auth0_sub_count, 0) AS distinct_auth0_sub_count,
    COALESCE(m.has_stored_org_admin, false) AS has_stored_org_admin,
    COALESCE(m.has_reviewed_auth0_admin, false) AS has_reviewed_auth0_admin,
    COALESCE(m.has_reviewed_auth0_non_admin, false) AS has_reviewed_auth0_non_admin,
    COALESCE(a.chat_session_count, 0) AS chat_session_count,
    COALESCE(a.chat_message_count, 0) AS chat_message_count,
    COALESCE(a.telemetry_count, 0) AS telemetry_count,
    CASE
      WHEN COALESCE(m.has_reviewed_auth0_admin, false) THEN 'adminOrBypassLikely'
      WHEN COALESCE(m.has_reviewed_auth0_non_admin, false)
        AND s.status IN ('trialing', 'active')
        AND s."currentPeriodEnd" >= NOW()
        THEN 'activeNonAdminRisk'
      WHEN COALESCE(m.distinct_auth0_sub_count, 0) > 1 THEN 'multiMemberAmbiguous'
      WHEN s.id IS NULL THEN 'missingSubscriptionState'
      WHEN s."planCode" NOT IN ('trial_v1', 'standard_v1') THEN 'historicalOrLegacyPlan'
      WHEN l.trial_grant_count = 0 AND l.balance > 0 THEN 'walletCreatedWithoutGrantLedger'
      WHEN l.chat_usage_count > 0 AND l.balance <> l.ledger_sum THEN 'usageLedgerMismatch'
      WHEN l.admin_adjust_count > 0 AND l.balance <> l.ledger_sum THEN 'adminTopupReview'
      WHEN COALESCE(a.chat_session_count, 0) = 0
        AND COALESCE(a.chat_message_count, 0) = 0
        AND COALESCE(a.telemetry_count, 0) = 0
        THEN 'historicalOrTestLikely'
      ELSE 'insufficientEvidence'
    END AS classification
  FROM ledger_by_wallet l
  LEFT JOIN latest_subscription s ON s."organizationId" = l.organization_id
  LEFT JOIN member_rollup m ON m.organization_id = l.organization_id
  LEFT JOIN org_activity a ON a.organization_id = l.organization_id
  WHERE l.balance <> l.ledger_sum
)
SELECT
  classification,
  COUNT(*) AS wallet_count,
  SUM(unreconciled_delta) AS total_unreconciled_delta,
  SUM(wallet_balance) AS total_wallet_balance,
  SUM(ledger_sum) AS total_ledger_sum
FROM classified_mismatches
GROUP BY classification
ORDER BY classification;
```

For manual review, run a second detail query against the same
`classified_mismatches` CTE and return only anonymized IDs plus counts:

```sql
SELECT
  classification,
  anonymized_organization_id,
  wallet_balance,
  ledger_sum,
  unreconciled_delta,
  latest_subscription_plan_code,
  latest_subscription_status,
  latest_monthly_credits,
  has_reviewed_auth0_admin,
  has_reviewed_auth0_non_admin,
  chat_usage_count,
  trial_grant_count,
  admin_adjust_count,
  chat_session_count,
  chat_message_count,
  telemetry_count
FROM classified_mismatches
ORDER BY classification, ABS(unreconciled_delta) DESC;
```

### Risk Categories

- `adminOrBypassLikely`: reviewed Auth0 evidence says the user is an app-admin.
  Header display should be `Credits: admin`; `/api/chat` does not charge these
  requests.
- `activeNonAdminRisk`: reviewed Auth0 evidence says non-admin, subscription is
  active or trialing, and the wallet can affect visible credits and charging.
  These rows need careful manual review before cleanup.
- `historicalOrLegacyPlan`: mismatch is tied to legacy plan data such as
  `office_50`. This can still be visible if the organization is active and
  non-admin, so do not auto-clean it.
- `walletCreatedWithoutGrantLedger`: wallet has a positive balance but lacks an
  expected grant or top-up ledger trail. This points to old provisioning,
  manual edits, or missing historical ledger rows.
- `usageLedgerMismatch`: chat usage ledger rows exist but wallet balance does
  not reconcile. This is higher risk because it may affect active charging
  history, even though current write logic is transactional.
- `adminTopupReview`: admin adjustment rows exist and need note/request-ID
  review before deciding whether ledger or wallet is authoritative.
- `missingSubscriptionState`: wallet exists without a clear subscription state.
  Do not infer trial or standard status from the wallet alone.
- `multiMemberAmbiguous`: the organization has multiple Auth0 subjects or is
  part of duplicate membership evidence. Review runtime organization selection.
- `historicalOrTestLikely`: no activity evidence and no current plan evidence.
  Candidate for later cleanup planning only after exact IDs are reviewed.
- `insufficientEvidence`: Auth0, activity, subscription, or ledger details do
  not support a safe conclusion.

### Manual Review Checklist

Before any cleanup PR, review each mismatched wallet and confirm:

1. Auth0 app-admin status for the related subject or subjects.
2. Which organization `/api/me`, `/api/chat`, and admin billing routes select
   for the subject today.
3. Whether the latest subscription is active, trialing, expired, canceled,
   legacy, missing, or test-only.
4. Whether the wallet balance is currently visible to a non-admin user.
5. Whether recent `chat_usage` ledger rows exist for the wallet.
6. Whether positive balances are explained by `trial_grant` or `admin_adjust`
   rows with request IDs.
7. Whether `NULL` request IDs, duplicate grants, or historical migration timing
   make the ledger incomplete.
8. Whether organization/chat/telemetry activity indicates real user data.
9. Whether ledger sum or wallet balance should be authoritative for that exact
   organization.
10. The planned cleanup action, if any, using a transaction and reviewed IDs.

### Recommended Next Cleanup And Hardening PRs

1. Add a read-only mismatch classification script using the SQL shape above,
   or extend `scripts/audit-beta-db-integrity.sql` after the output shape is
   approved.
2. Run the script with manually reviewed Auth0 evidence and record anonymized
   aggregate results in a follow-up audit note.
3. Prepare a manual cleanup PR only for rows classified with enough evidence.
   Do not mutate data from UI code or from an unreviewed script.
4. Add provisioning hardening after data cleanup so an `auth0Sub` cannot
   ambiguously resolve to multiple organizations.
5. Add isolated invariant tests proving current trial grants, admin top-ups,
   and chat usage charges keep wallet balance and ledger sum aligned.
6. Consider an internal admin-only integrity warning for mismatched wallets.
   The warning should not change `/api/me`, `/api/chat`, or runtime billing
   semantics.

## Expected Or Suspicious?

The mismatch is suspicious for current code paths.

Current deterministic write paths are designed so credit-affecting changes
create ledger rows and update wallet balance in the same transaction. Under
those paths, wallet balance and ledger sum should normally reconcile.

The mismatch is also plausibly historical/test/admin data rather than proof of
a current charge bug:

- the mismatched `1000` wallet was associated with historical `office_50`
  subscription data, not the current `trial_v1` provisioning constants;
- PR #59 already classified wallet-balance-vs-ledger-sum mismatches as
  `manualReviewRequired`;
- the PR #59 cleanup guidance explicitly says to reconcile wallet balance only
  when the ledger sum is clearly authoritative;
- admin users can have wallet state even though chat usage is not charged.

This PR does not determine that ledger sum is safe to apply over wallet balance
for historical rows.

## Risk Assessment

### Risk That Users See Incorrect Credit Balances

Possible.

Because `/api/me` reads `CreditWallet.balance`, any historical wallet balance
that was set outside ledger-backed paths will be displayed as remaining credits
for non-admin users. PR #64C.7 prevents admin users from seeing a finite wallet
balance as "credits left", but non-admin display still follows wallet truth.

### Risk That Users Are Charged Incorrectly

Not proven by this audit.

Current non-admin charge flow uses the wallet row as the operational balance,
locks it, writes a `chat_usage` ledger row, and decrements the wallet in one
transaction. That is internally consistent for new charges.

The larger unresolved risk is that the starting wallet balance for some
historical organizations may not be ledger-explainable. If such an organization
is active and non-admin, the system will still enforce and charge against the
stored wallet balance.

### Risk From Duplicate Organization Membership

Still relevant.

PR #59 documented that several server paths use `findFirst({ auth0Sub })` to
choose an organization. Duplicate `OrgMember` rows can make the selected wallet
ambiguous. That issue is adjacent to, but separate from, wallet/ledger
arithmetic reconciliation.

## Recommended Next PRs

1. Extend the existing read-only SQL audit to classify wallet/ledger
   mismatches by:
   - Auth0 admin evidence,
   - stored org role,
   - latest subscription plan/status,
   - chat-session/chat-message activity,
   - ledger reasons present,
   - whether mismatch appears on active non-admin accounts.

2. Add a read-only admin integrity view or script only after the SQL shape is
   approved. It should never mutate data and should avoid committing real
   user identifiers.

3. Run a human-reviewed production/preview data audit and decide per mismatch:
   - keep wallet balance as authoritative,
   - backfill missing ledger rows,
   - correct wallet balance,
   - or preserve as historical/test/admin data.

4. After data cleanup decisions, harden provisioning so an `auth0Sub` cannot
   ambiguously resolve to multiple organizations.

5. Consider adding a CI-safe invariant test around current write helpers using
   isolated test data, not production data. The test should confirm that new
   trial grants, admin top-ups, and chat usage charges keep wallet balance and
   ledger sum aligned for the rows they create.

6. Consider exposing a non-user-facing integrity warning in admin billing
   tooling when a wallet balance does not match ledger sum. Do not block users
   or mutate balances from UI-only logic.

## What Must Not Change Without Explicit Approval

- Do not mutate production or preview billing data from Codex.
- Do not clamp wallet balances.
- Do not overwrite `CreditWallet.balance` with ledger sum automatically.
- Do not backfill ledger rows automatically.
- Do not change `/api/chat` charge semantics.
- Do not change `chargeCreditsTx(...)` transaction behavior.
- Do not change trial grants, trial duration, plan codes, or admin bypass
  semantics.
- Do not change Prisma schema or add migrations.
- Do not treat `CreditLedger` as the runtime balance source until a data cleanup
  and compatibility plan is approved.
- Do not use UI logic as the source of credit truth.

## Conclusion

`CreditWallet.balance` is currently the operational source of truth for
remaining credits. `CreditLedger` is intended to be the audit trail and should
normally reconcile with the wallet for current deterministic write paths.

The observed mismatches are not expected under current write logic, but they are
plausibly historical/test/admin data and were already identified by PR #59 as
manual-review-required. No billing data should be changed until a targeted
read-only audit identifies which mismatches affect real non-admin accounts and
which source is authoritative for each reviewed organization.
