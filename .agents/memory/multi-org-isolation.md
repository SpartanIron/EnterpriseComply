---
name: Multi-org isolation
description: Patterns, fixes, and verification recipe for cross-tenant data isolation in the EnterpriseComply API
---

## Guard layer (URL orgId check)

`OrgContextGuard` in `artifacts/api-server/src/guards/clerk-auth.guard.ts`:
- Validates `req.params.orgId` against the authenticated user's `orgMembersTable.orgId`
- Returns 403 if URL orgId ≠ session orgId
- All 30+ controllers use this guard via `@UseGuards(OrgContextGuard)` — controller list is in the audit explorer result

## DB predicate layer (orgId in WHERE)

All UPDATE/DELETE must include `eq(table.orgId, orgId)` in the WHERE clause, not just `eq(table.id, resourceId)`.

Fixed in this session (defense-in-depth or actual gap):
- `risks.service.ts` — updateRisk, deleteRisk
- `people.service.ts` — updatePerson (syncPeopleFromHR bulk update)
- `access-reviews.service.ts` — submitDecision review stats update
- `audit-shares.service.ts` — revoke update
- `controls.service.ts` — updateFrameworkScores
- `custom-frameworks.service.ts` — addControl, bulkImportControls
- `zero-trust.service.ts` — scoreAssessment updateWeights, DELETE pillar/function scores/gap findings (3 deletes)
- `policies.service.ts` — ackCounts query in getOrgPolicies
- `audits.service.ts` — nested evidence request query in getEngagements

## 404 on stale/foreign resource IDs (bypass via own-org URL)

The guard blocks `/orgs/3/risks` for an org-1 user. But `/orgs/1/risks/<org3_id>` passes the guard.
Without a 404 throw, the UPDATE runs with `WHERE orgId=1 AND id=<org3_id>` — 0 rows, still returns 200.
Data is safe but it's a silent no-op and a potential ID oracle.

**Fix:** After every `const [row] = db.update().where(orgId+id).returning()`, throw `NotFoundException` if `!row`.

Services fixed with NotFoundException on empty returning():
- `risks.service.ts` — updateRisk
- `policies.service.ts` — updatePolicy
- `people.service.ts` — updatePerson
- `vendors.service.ts` — updateVendor
- `custom-frameworks.service.ts` — updateFramework, updateControl
- `stigs.service.ts` — updateFinding

Services already throwing before this fix: `remediation.service.ts`, `questionnaires.service.ts`, `audit-shares.service.ts`

## Agent endpoints

`emass.controller.ts` `/v1/emass/agent/pull/:orgId` and `/v1/emass/agent/acknowledge/:orgId` — protected by `AgentSecretGuard` requiring `X-Agent-Secret: $EMASS_AGENT_SECRET`. Returns 401 if env var unset.

## Webhook endpoint

`/api/webhooks/user-created` — protected by `WEBHOOK_SECRET` env var check (`X-Webhook-Secret` header). Returns 503 if `WEBHOOK_SECRET` unset.

**Why:** This endpoint triggers welcome emails and inserts drip log entries. Previously unauthenticated — any external caller could spam emails and pollute the drip log.

## Verification recipe

See `artifacts/api-server/scripts/test-isolation.mjs` for the full test script.

Steps:
1. Create user records in Better Auth `user` table matching `org_members.clerk_user_id` values
2. Create session rows for each; sign cookie as `HMAC-SHA256(rawToken, BETTER_AUTH_SECRET)` → btoa base64
3. Cookie name: `__Secure-better-auth.session_token`
4. Run GET on all endpoints across the wrong org — expect 403
5. Run POST/PATCH/DELETE across the wrong org — expect 403
6. Test mutation bypass: PATCH `/orgs/1/risks/<org3_id>` via org-1 session — expect 404 (not 200)
7. Clean up test user + session rows after

## False positives from audit

- `audit-package.service.ts` — all queries already org-scoped (explorer was wrong)
- `integration-scheduler.service.ts` — privileged internal service, intentionally all-org
- `questionnaires.service.ts` update at line 127 — just-inserted ID, not user-controlled
- `orgs.service.ts` getDashboard — already `and(orgId, active)` (explorer was wrong)
