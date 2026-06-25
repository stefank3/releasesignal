-- Release Signal PR #59 beta DB integrity audit
--
-- NON-DESTRUCTIVE: this file only reads database state.
-- Run manually against the target database and copy the result rows into PR notes.
--
-- Categories:
-- - safeToClean: likely safe cleanup candidates, still review before action.
-- - manualReviewRequired: needs human/DB/Auth0 comparison before action.
-- - doNotTouch: records with user activity or ambiguous ownership; preserve unless explicitly approved.
-- - futureHardeningNeeded: schema/provisioning risks that need a later implementation PR.
--
-- Optional Auth0 role evidence:
-- This CTE is intentionally empty by default so committed repo artifacts do not
-- contain real QA identifiers and unchanged audit runs do not emit placeholder
-- evidence. Before running a reviewed audit locally, replace the SELECT with
-- VALUES rows such as:
--
--   VALUES
--     ('<REVIEWED_AUTH0_SUB>', '<REVIEWED_EMAIL>', false, 'Manual Auth0 check: no roles')

WITH expected_auth0_roles(auth0_sub, email, is_auth0_admin, evidence) AS (
  SELECT
    NULL::text AS auth0_sub,
    NULL::text AS email,
    NULL::boolean AS is_auth0_admin,
    NULL::text AS evidence
  WHERE false
),
org_activity AS (
  SELECT
    o.id AS organization_id,
    COUNT(DISTINCT om.id) AS member_count,
    COUNT(DISTINCT cs.id) AS chat_session_count,
    COUNT(DISTINCT cm.id) AS chat_message_count,
    COUNT(DISTINCT tel.id) AS telemetry_count,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.reason = 'chat_usage') AS chat_usage_ledger_count,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.reason = 'trial_grant') AS trial_grant_ledger_count
  FROM "Organization" o
  LEFT JOIN "OrgMember" om ON om."organizationId" = o.id
  LEFT JOIN "ChatSession" cs ON cs."auth0Sub" = om."auth0Sub"
  LEFT JOIN "ChatMessage" cm ON cm."auth0Sub" = om."auth0Sub"
  LEFT JOIN "TelemetryEventLog" tel ON tel."organizationId" = o.id
  LEFT JOIN "CreditWallet" cw ON cw."organizationId" = o.id
  LEFT JOIN "CreditLedger" cl ON cl."walletId" = cw.id
  GROUP BY o.id
),
ledger_sums AS (
  SELECT
    cw.id AS wallet_id,
    cw."organizationId" AS organization_id,
    cw.currency,
    cw.balance,
    COALESCE(SUM(cl.delta), 0) AS ledger_sum,
    COUNT(cl.id) AS ledger_count
  FROM "CreditWallet" cw
  LEFT JOIN "CreditLedger" cl ON cl."walletId" = cw.id
  GROUP BY cw.id, cw."organizationId", cw.currency, cw.balance
),
duplicate_members AS (
  SELECT
    om."auth0Sub",
    COUNT(*) AS member_rows,
    COUNT(DISTINCT om."organizationId") AS organization_count,
    ARRAY_AGG(om."organizationId" ORDER BY om."createdAt", om."organizationId") AS organization_ids,
    ARRAY_AGG(om.role ORDER BY om."createdAt", om."organizationId") AS roles,
    MIN(om."createdAt") AS first_seen_at,
    MAX(om."createdAt") AS last_seen_at
  FROM "OrgMember" om
  GROUP BY om."auth0Sub"
  HAVING COUNT(*) > 1 OR COUNT(DISTINCT om."organizationId") > 1
),
duplicate_trial_subscriptions AS (
  SELECT
    s."organizationId",
    COUNT(*) AS trial_subscription_count,
    ARRAY_AGG(s.id ORDER BY s."createdAt") AS subscription_ids,
    MIN(s."createdAt") AS first_created_at,
    MAX(s."createdAt") AS last_created_at
  FROM "Subscription" s
  WHERE s."planCode" = 'trial_v1'
  GROUP BY s."organizationId"
  HAVING COUNT(*) > 1
),
duplicate_trial_grants AS (
  SELECT
    cw."organizationId",
    cl."walletId",
    cl."auth0Sub",
    COUNT(*) AS grant_count,
    SUM(cl.delta) AS total_granted,
    ARRAY_AGG(cl.id ORDER BY cl."createdAt") AS ledger_ids,
    ARRAY_AGG(cl."requestId" ORDER BY cl."createdAt") AS request_ids,
    MIN(cl."createdAt") AS first_created_at,
    MAX(cl."createdAt") AS last_created_at
  FROM "CreditLedger" cl
  JOIN "CreditWallet" cw ON cw.id = cl."walletId"
  WHERE cl.reason = 'trial_grant'
  GROUP BY cw."organizationId", cl."walletId", cl."auth0Sub"
  HAVING COUNT(*) > 1
),
normal_users_stored_as_admin AS (
  SELECT
    om."auth0Sub",
    er.email,
    om."organizationId",
    om.id AS org_member_id,
    om.role,
    er.evidence
  FROM "OrgMember" om
  JOIN expected_auth0_roles er ON er.auth0_sub = om."auth0Sub"
  WHERE er.is_auth0_admin = false
    AND om.role = 'admin'
),
all_stored_org_admin_roles AS (
  SELECT
    om."auth0Sub",
    om."organizationId",
    om.id AS org_member_id,
    om.role,
    om."createdAt",
    o.name AS organization_name,
    s.id AS latest_subscription_id,
    s.status AS latest_subscription_status,
    s."planCode" AS latest_subscription_plan_code,
    s."createdAt" AS latest_subscription_created_at
  FROM "OrgMember" om
  JOIN "Organization" o ON o.id = om."organizationId"
  LEFT JOIN LATERAL (
    SELECT
      sub.id,
      sub.status,
      sub."planCode",
      sub."createdAt"
    FROM "Subscription" sub
    WHERE sub."organizationId" = om."organizationId"
    ORDER BY sub."createdAt" DESC
    LIMIT 1
  ) s ON true
  WHERE om.role = 'admin'
),
auth0_admins_with_trial AS (
  SELECT
    er.auth0_sub,
    er.email,
    om."organizationId",
    s.id AS subscription_id,
    s.status,
    s."planCode",
    er.evidence
  FROM expected_auth0_roles er
  JOIN "OrgMember" om ON om."auth0Sub" = er.auth0_sub
  JOIN "Subscription" s ON s."organizationId" = om."organizationId"
  WHERE er.is_auth0_admin = true
    AND s."planCode" = 'trial_v1'
),
orphan_organizations AS (
  SELECT
    o.id AS organization_id,
    o.name,
    o."createdAt",
    COALESCE(oa.member_count, 0) AS member_count,
    COALESCE(oa.telemetry_count, 0) AS telemetry_count
  FROM "Organization" o
  LEFT JOIN org_activity oa ON oa.organization_id = o.id
  WHERE COALESCE(oa.member_count, 0) = 0
),
wallet_mismatches AS (
  SELECT *
  FROM ledger_sums
  WHERE balance <> ledger_sum
),
candidate_empty_duplicate_orgs AS (
  SELECT
    dm."auth0Sub",
    om."organizationId",
    om.id AS org_member_id,
    oa.chat_session_count,
    oa.chat_message_count,
    oa.telemetry_count,
    oa.chat_usage_ledger_count,
    oa.trial_grant_ledger_count
  FROM duplicate_members dm
  JOIN "OrgMember" om ON om."auth0Sub" = dm."auth0Sub"
  JOIN org_activity oa ON oa.organization_id = om."organizationId"
  WHERE oa.chat_session_count = 0
    AND oa.chat_message_count = 0
    AND oa.telemetry_count = 0
    AND oa.chat_usage_ledger_count = 0
    AND oa.trial_grant_ledger_count <= 1
),
active_duplicate_orgs AS (
  SELECT
    dm."auth0Sub",
    om."organizationId",
    oa.chat_session_count,
    oa.chat_message_count,
    oa.telemetry_count,
    oa.chat_usage_ledger_count,
    oa.trial_grant_ledger_count
  FROM duplicate_members dm
  JOIN "OrgMember" om ON om."auth0Sub" = dm."auth0Sub"
  JOIN org_activity oa ON oa.organization_id = om."organizationId"
  WHERE oa.chat_session_count > 0
     OR oa.chat_message_count > 0
     OR oa.telemetry_count > 0
     OR oa.chat_usage_ledger_count > 0
),
audit_rows AS (
  SELECT
    'manualReviewRequired' AS category,
    'duplicateOrgMembershipForAuth0Sub' AS finding,
    dm."auth0Sub" AS subject,
    NULL::text AS organization_id,
    jsonb_build_object(
      'memberRows', dm.member_rows,
      'organizationCount', dm.organization_count,
      'organizationIds', dm.organization_ids,
      'roles', dm.roles,
      'firstSeenAt', dm.first_seen_at,
      'lastSeenAt', dm.last_seen_at
    ) AS details
  FROM duplicate_members dm

  UNION ALL
  SELECT
    'manualReviewRequired',
    'normalUserStoredAsOrgAdmin',
    n."auth0Sub",
    n."organizationId",
    jsonb_build_object(
      'email', n.email,
      'orgMemberId', n.org_member_id,
      'storedRole', n.role,
      'auth0Evidence', n.evidence,
      'note', 'Runtime app-admin remains Auth0-claim based; this flags DB hygiene only.'
    )
  FROM normal_users_stored_as_admin n

  UNION ALL
  SELECT
    'manualReviewRequired',
    'allStoredOrgAdminRolesForReview',
    a."auth0Sub",
    a."organizationId",
    jsonb_build_object(
      'orgMemberId', a.org_member_id,
      'storedRole', a.role,
      'orgMemberCreatedAt', a."createdAt",
      'organizationName', a.organization_name,
      'latestSubscriptionId', a.latest_subscription_id,
      'latestSubscriptionStatus', a.latest_subscription_status,
      'latestSubscriptionPlanCode', a.latest_subscription_plan_code,
      'latestSubscriptionCreatedAt', a.latest_subscription_created_at,
      'note', 'Manual verification list only. Runtime app-admin access is Auth0-claim based, not OrgMember.role based.'
    )
  FROM all_stored_org_admin_roles a

  UNION ALL
  SELECT
    'manualReviewRequired',
    'auth0AdminHasTrialSubscription',
    a.auth0_sub,
    a."organizationId",
    jsonb_build_object(
      'email', a.email,
      'subscriptionId', a.subscription_id,
      'status', a.status,
      'planCode', a."planCode",
      'auth0Evidence', a.evidence
    )
  FROM auth0_admins_with_trial a

  UNION ALL
  SELECT
    'manualReviewRequired',
    'duplicateTrialSubscriptions',
    NULL,
    d."organizationId",
    jsonb_build_object(
      'trialSubscriptionCount', d.trial_subscription_count,
      'subscriptionIds', d.subscription_ids,
      'firstCreatedAt', d.first_created_at,
      'lastCreatedAt', d.last_created_at
    )
  FROM duplicate_trial_subscriptions d

  UNION ALL
  SELECT
    'manualReviewRequired',
    'walletBalanceDoesNotMatchLedgerSum',
    NULL,
    w.organization_id,
    jsonb_build_object(
      'walletId', w.wallet_id,
      'currency', w.currency,
      'walletBalance', w.balance,
      'ledgerSum', w.ledger_sum,
      'ledgerCount', w.ledger_count,
      'note', 'Review admin_adjust and manual correction history before reconciling.'
    )
  FROM wallet_mismatches w

  UNION ALL
  SELECT
    'manualReviewRequired',
    'duplicateTrialGrants',
    d."auth0Sub",
    d."organizationId",
    jsonb_build_object(
      'walletId', d."walletId",
      'grantCount', d.grant_count,
      'totalGranted', d.total_granted,
      'ledgerIds', d.ledger_ids,
      'requestIds', d.request_ids,
      'firstCreatedAt', d.first_created_at,
      'lastCreatedAt', d.last_created_at
    )
  FROM duplicate_trial_grants d

  UNION ALL
  SELECT
    'safeToClean',
    'emptyDuplicateOrgCandidate',
    c."auth0Sub",
    c."organizationId",
    jsonb_build_object(
      'orgMemberId', c.org_member_id,
      'chatSessionCount', c.chat_session_count,
      'chatMessageCount', c.chat_message_count,
      'telemetryCount', c.telemetry_count,
      'chatUsageLedgerCount', c.chat_usage_ledger_count,
      'trialGrantLedgerCount', c.trial_grant_ledger_count,
      'note', 'Candidate only. Keep one reviewed active org per auth0Sub.'
    )
  FROM candidate_empty_duplicate_orgs c

  UNION ALL
  SELECT
    'doNotTouch',
    'activeDuplicateOrgHasUsageOrTelemetry',
    a."auth0Sub",
    a."organizationId",
    jsonb_build_object(
      'chatSessionCount', a.chat_session_count,
      'chatMessageCount', a.chat_message_count,
      'telemetryCount', a.telemetry_count,
      'chatUsageLedgerCount', a.chat_usage_ledger_count,
      'trialGrantLedgerCount', a.trial_grant_ledger_count,
      'note', 'Contains user activity or operational evidence.'
    )
  FROM active_duplicate_orgs a

  UNION ALL
  SELECT
    'manualReviewRequired',
    'orphanOrganizationNoMembers',
    NULL,
    o.organization_id,
    jsonb_build_object(
      'name', o.name,
      'createdAt', o."createdAt",
      'memberCount', o.member_count,
      'telemetryCount', o.telemetry_count
    )
  FROM orphan_organizations o

  UNION ALL
  SELECT
    'futureHardeningNeeded',
    'auth0SubNotGloballyUniqueInOrgMember',
    NULL,
    NULL,
    jsonb_build_object(
      'currentConstraint', 'unique(organizationId, auth0Sub)',
      'risk', 'same auth0Sub can be linked to multiple organizations',
      'recommendation', 'After data cleanup, consider global uniqueness/idempotent provisioning for auth0Sub.'
    )

  UNION ALL
  SELECT
    'futureHardeningNeeded',
    'ensureOrgForUserReadThenCreateRace',
    NULL,
    NULL,
    jsonb_build_object(
      'risk', 'Concurrent first-login or retry can pass findFirst({ auth0Sub }) before either transaction commits.',
      'recommendation', 'Add idempotent provisioning hardening after data cleanup; do not change schema in PR #59.'
    )
)
SELECT
  category,
  finding,
  subject,
  organization_id,
  details
FROM audit_rows
ORDER BY
  CASE category
    WHEN 'safeToClean' THEN 1
    WHEN 'manualReviewRequired' THEN 2
    WHEN 'doNotTouch' THEN 3
    WHEN 'futureHardeningNeeded' THEN 4
    ELSE 5
  END,
  finding,
  subject NULLS LAST,
  organization_id NULLS LAST;
