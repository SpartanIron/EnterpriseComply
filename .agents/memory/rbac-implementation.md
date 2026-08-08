---
name: RBAC implementation
description: Role guard pattern, role hierarchy, and testing approach for EnterpriseComply API
---

## Role hierarchy (ROLE_HIERARCHY in roles.guard.ts)
viewer:0, auditor:1, analyst:2, member:2 (legacy), compliance_manager:3, admin:4, owner:5, super_admin:6

## Guard pattern
`RequireRole(minRole)` is a factory function (not a class) in `artifacts/api-server/src/guards/roles.guard.ts`.
It returns a mixin guard class that reads `req.member.role` (set by `OrgContextGuard`).
Usage: `@UseGuards(OrgContextGuard, RequireRole('admin'))` — OrgContextGuard MUST run first.

**Why factory instead of Reflector-based:** OrgContextGuard is used without DI at the class level; RequireRole mirrors this pattern so no module registration is needed.

## Permission tiers applied
- owner: framework activate/deactivate, org settings (PATCH /orgs/:orgId), all integration connect endpoints
- admin: people, vendors, audits, audit-shares, access-review campaigns, custom-frameworks, test-runs trigger, monitoring check/settings, zero-trust weights
- compliance_manager: evidence delete, controls result, POA&M, policies create/update, risks delete, remediation, STIGs, assets mutations, gap-analysis, SCAP import, questionnaires create/delete/approve, zero-trust score
- analyst/member: evidence create, risks create/update, compliance-calendar, controls result, questionnaire item answers

## AssetsController fix
Was using `ClerkAuthGuard` (no org context) — changed to `OrgContextGuard` so `req.member` is available for RequireRole.
Uses `@OrgContext()` decorator instead of raw `@Param('orgId')`.

## Better Auth cookie signing (for testing)
Cookie name: `__Secure-better-auth.session_token` (useSecureCookies: true)
Signature: HMAC-SHA256(rawToken, secret) encoded as plain btoa base64 (NOT base64url)
Signed cookie value: `<rawToken>.<base64sig>`
Secret: process.env.BETTER_AUTH_SECRET || "ec-dev-secret-change-in-production"
Better Auth internal context: `await (auth as any).$context` (async getter)

## Testing approach
Live HTTP test via fetch() in a .ts script (not curl — curl can't easily handle `__Secure-` cookies or base64 signatures with `+/=`).
Use `auth.api.getSession({ headers })` to verify session resolves before hitting endpoints.
Clean up test users from DB after testing.
