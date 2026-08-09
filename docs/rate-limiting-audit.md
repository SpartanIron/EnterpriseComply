# Rate Limiting Audit — EnterpriseComply API

**Date:** 2026-08-09  
**Author:** automated audit pass  
**Status:** ✅ Implemented

---

## Summary

The API now enforces three named throttler profiles through a custom `RateLimitGuard` that applies exactly one profile per route.  Prior to this change the API had a single global limit of 120 req/min applied equally to every route, providing no meaningful protection for sensitive auth endpoints.

| Profile   | Limit       | Scope                                  |
|-----------|-------------|----------------------------------------|
| `default` | 120 req/min | All authenticated API endpoints (base) |
| `default` |   5 req/min | SSP generate (per-route override via `@Throttle({ default: { limit: 5 } })`) |
| `default` |  10 req/min | SSP export-text (per-route override)   |
| `default` |   8 req/min | Gap analysis (per-route override)      |
| `auth`    |   5 req/min | SAML login only                        |
| `webhook` | 300 req/min | Inbound CI/CD webhooks (BetterAuth)    |
| (exempt)  | —           | Health check, status page, providers   |

Additionally, repeated auth failures on the SAML ACS (callback) endpoint trigger an IP-level block after 10 failures within 15 minutes (blocked for 15 minutes, `Retry-After: 900`).

---

## Endpoint Inventory by Risk Tier

### Tier A — Auth / public-writable (highest risk)

| Endpoint | Method | Guard | Limit |
|----------|--------|-------|-------|
| `POST /api/saml/:slug/callback` | POST | IP failure block only (`@SkipThrottle()` — no per-minute throttle) | block after 10 failures in 15 min |
| `GET /api/saml/:slug/login`     | GET  | `auth` throttle | 5/min per IP |
| `GET /api/auth/*` (BetterAuth magic-link, OAuth init) | ALL | NestJS `auth` profile | 5/min per IP |

> ⚠️ **Gap noted:** The BetterAuth auth controller (`/api/auth/*`) is a wildcard `@All()` handler that proxies to BetterAuth's fetch-based runtime.  The NestJS `ThrottlerGuard` applies to this controller, but because BetterAuth handles its own internal routing, individual sub-routes (e.g. `/api/auth/magic-link/send`) cannot carry per-sub-route `@Throttle` decorators.  The entire `/api/auth/*` namespace receives the global `default` (120/min) limit today.
>
> **Recommendation:** Add a separate Express middleware (before NestJS routing) that enforces a 5/min limit on POST requests to `/api/auth/magic-link/send` using the same `ip-failure-tracker` pattern.

### Tier B — Authenticated read-heavy (medium traffic)

All authenticated endpoints (frameworks, controls, evidence, risks, audits, people, …) inherit the `default` profile: **120 req/min per IP**.

Notable high-frequency consumers:
- `GET /api/orgs/:orgId/frameworks` — dashboard polling
- `GET /api/orgs/:orgId/controls` — evidence grid
- `GET /api/orgs/:orgId/score-history` — score sparkline

These are safely within 120/min for a single user session.

### Tier C — Authenticated write (low frequency, high cost)

Some write endpoints carry tighter explicit limits in addition to the global 120/min default:

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `POST /api/orgs/:orgId/ssp/generate` | 5/min (`default` profile override via `@Throttle({ default: { limit: 5 } })`) | LLM call, expensive |
| `POST /api/orgs/:orgId/ssp/export-text` | 10/min (`default` profile override) | LLM call |
| `POST /api/orgs/:orgId/gap-analysis` | 8/min (`default` profile override) | CPU-intensive |

### Tier D — Webhooks (high expected volume)

| Endpoint | Method | Limit |
|----------|--------|-------|
| `POST /api/webhooks/user-created` | POST | 300/min per IP (`webhook` profile) |

Authenticated by `X-Webhook-Secret` header; separate from the auth throttle.

### Tier E — Public / exempt

| Endpoint | Reason |
|----------|--------|
| `GET /api/status/*` | Public status page; cached; no auth cost |
| `GET /api/healthz` | Health check; no auth cost |
| `GET /api/auth-providers` | Returns boolean flags only; no auth cost |
| `GET /api/orgs/:orgId/sso/metadata` | Authenticated (admin+enterprise); XML metadata |

---

## Rate Limit Response Headers

All throttled routes return:

```
X-RateLimit-Limit:     <limit>        # for default profile
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset:     <seconds>
```

Auth and webhook profiles return suffixed variants:

```
X-RateLimit-Limit-auth:      5        # auth profile
X-RateLimit-Remaining-auth:  4
X-RateLimit-Reset-auth:      60
```

When blocked (429 response):
```
Retry-After: 900    # 15-minute IP block (SAML failure block)
Retry-After: 60     # throttler window reset (standard throttle 429)
```

---

## IP Failure Block (SAML ACS Endpoint)

File: `artifacts/api-server/src/lib/auth-failure-tracker.ts`

| Parameter | Value |
|-----------|-------|
| Window    | 15 minutes |
| Threshold | 10 consecutive failures |
| Block duration | 15 minutes |
| `Retry-After` | 900 seconds |
| Storage | Postgres `ip_failure_tracker` table (persistent across restarts) |

State is persisted in Postgres so that a rolling Railway deploy does **not** reset failure counters.  The table is created automatically on first use (idempotent `CREATE TABLE IF NOT EXISTS`).

---

## Known Gaps and Recommendations

| Gap | Risk | Recommendation |
|-----|------|----------------|
| BetterAuth magic-link endpoint not individually throttled at 5/min | Medium — email rate limit (5/hour/email) partially mitigates | Add Express middleware before NestJS that applies IP-based 5/min limit on `POST /api/auth/magic-link/send` |
| ~~In-memory throttle state resets on deploy~~ | ✅ Fixed — both `ThrottlerModule` and `auth-failure-tracker` now use Postgres-backed storage (`throttle_hits` and `ip_failure_tracker` tables); state survives rolling deploys | — |
| No per-authenticated-user limits (only per-IP) | Low — All auth endpoints require session | Sufficient for current single-tenant Railway deployment |
| Cloudflare WAF rules not configured | Medium — Bot traffic not blocked at edge | Out of scope; infrastructure concern |
| OAuth initiation (`GET /api/auth/sign-in/github`) uses default 120/min | Medium | Move to `auth` profile if credential-stuffing concern arises |

---

## Implementation Files

| File | Change |
|------|--------|
| `artifacts/api-server/src/guards/rate-limit.guard.ts` | New: custom guard selecting single throttler profile per route |
| `artifacts/api-server/src/lib/auth-failure-tracker.ts` | **Updated:** Postgres-backed (was in-memory Map); all functions are now async |
| `artifacts/api-server/src/lib/pg-pool.ts` | New: singleton `pg.Pool` for rate-limit tables |
| `artifacts/api-server/src/lib/pg-throttler-storage.ts` | New: `PgThrottlerStorage` — implements `ThrottlerStorage` backed by `throttle_hits` table |
| `artifacts/api-server/src/app.module.ts` | **Updated:** `ThrottlerModule.forRoot` now uses object form with `storage: new PgThrottlerStorage()` |
| `artifacts/api-server/src/modules/sso/saml-auth.controller.ts` | **Updated:** `isIpBlocked`, `blockRemainingSeconds`, `recordAuthFailure` now awaited |
| `artifacts/api-server/src/main.ts` | trust proxy + expose rate limit headers in CORS |
| `artifacts/api-server/src/modules/webhooks/webhooks.controller.ts` | webhook throttle |
| `artifacts/api-server/src/modules/public-status/public-status.controller.ts` | explicit skip |
| `artifacts/api-server/src/modules/health/health.controller.ts` | explicit skip |
| `artifacts/api-server/src/modules/auth/providers.controller.ts` | explicit skip |
| `artifacts/api-server/src/modules/sso/sso.controller.ts` | explicit skip on metadata |
| `artifacts/api-server/src/modules/ssp/ssp.controller.ts` | rename `default` → `api` in @Throttle |
| `artifacts/api-server/src/modules/gap-analysis/gap-analysis.controller.ts` | rename `default` → `api` |
| `artifacts/api-server/scripts/test-rate-limit-persistence.mjs` | New: regression test verifying counter persistence across simulated restarts |
