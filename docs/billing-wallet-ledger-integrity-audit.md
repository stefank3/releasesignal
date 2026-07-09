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
