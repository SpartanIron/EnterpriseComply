---
name: Multi-org isolation
description: Summary of isolation vulnerabilities found and fixed in the EnterpriseComply API; patterns to maintain going forward.
---

## What was fixed (2026-08-08)

### Critical — cross-org mutation via missing orgId in WHERE clause
`risks.service.ts` `updateRisk` and `deleteRisk` had no `orgId` predicate on the UPDATE/DELETE
(only `id`). A user in org 1 calling `/api/orgs/1/risks/999` where risk 999 belongs to org 3
would have mutated org 3's data. Fixed: `AND orgId = :orgId` added to both queries.

### Critical — eMASS agent endpoints had zero authentication
`GET /v1/emass/agent/pull/:orgId` and `POST /v1/emass/agent/acknowledge/:orgId` used
`@Param("orgId")` with no guard. Now protected by `AgentSecretGuard` which requires
`X-Agent-Secret: $EMASS_AGENT_SECRET` header. If env var is unset the endpoints return 401.

### Guard — OrgContextGuard URL param validation added
`OrgContextGuard` now reads `req.params.orgId` and compares it to `member.orgId`.
Returns 403 if the URL org differs from the session user's org.
**Why:** Before this fix, a user in org 1 calling `/api/orgs/3/anything` would have the guard
silently set `req.orgId = 1` (their real org), so they got their own data regardless of the URL.
That's not a leak but is incorrect multi-org routing and would be a real bug for multi-org users.

### Defense-in-depth — service-level UPDATE/DELETE missing orgId
All of these received `orgId` in the method signature but didn't pass it to the DB query.
They were safe because the resource was loaded org-scoped in an earlier read (so the ID
couldn't be from another org in a normal flow). Added `AND orgId = :orgId` for consistency:

| File | Methods fixed |
|---|---|
| `people/people.service.ts` | `syncPeopleFromHR` update + deactivate |
| `access-reviews/access-reviews.service.ts` | `submitDecision` review stats update |
| `audit-shares/audit-shares.service.ts` | `revoke` update |
| `controls/controls.service.ts` | `updateFrameworkScores` |
| `custom-frameworks/custom-frameworks.service.ts` | `addControl`, `bulkImportControls` framework total update |
| `zero-trust/zero-trust.service.ts` | `scoreAssessment`, `updateWeights` assessment update |

## Patterns to maintain going forward

1. **Every UPDATE/DELETE must include `AND orgId = :orgId` in its WHERE clause**, even if
   the resource was loaded org-scoped in the same method. Defense-in-depth prevents TOCTOU.
2. **New `@Post` / `@Patch` / `@Delete` controller methods must use `@OrgContext()`**, not
   `@Param("orgId")`, when the endpoint is under `/api/orgs/:orgId/...`. The `@Param` path
   bypasses both session validation and org membership checks.
3. **Agent/webhook endpoints** (no user session) need their own auth guard (shared secret or
   mTLS verification). Never leave a route unguarded even if the path is "obscure".

## Verification approach (repeatable)

1. Insert test users + sessions + org_members via DB (clerkUserId = user.id for guard lookup).
2. Trigger magic link via `POST /api/auth/sign-in/magic-link` — token lands in `verification`
   table (identifier = random token, value = `{email}`).
3. Complete via `GET /api/auth/magic-link/verify?token=...` → `Set-Cookie: __Secure-better-auth.session_token=<signed>`.
4. The signed token format is `<raw>.<base64-hmac>` — not the raw UUID from the DB.
5. Use cookie in curl: `-H "Cookie: __Secure-better-auth.session_token=<signed_token>"`.
6. Assert own-org endpoints → 200, cross-org endpoints → 403.
