# EnterpriseComply — Security Architecture

Last reviewed: 2026-08-10. Owner: Security Engineering.

This document describes how EnterpriseComply is built and where the trust
boundaries are. It is written to be handed to a customer's security team
without redaction: it contains no secrets, no internal hostnames beyond the
ones already published in DNS, and no credentials.

## 1. System overview

EnterpriseComply is a multi-tenant SaaS GRC platform. A single application
serves every tenant; tenants are separated by data, not by deployment.

```
                    ┌──────────────────────────────────────────┐
   End user ─TLS1.3─▶│ Cloudflare edge                          │
   (browser)         │  WAF · DDoS · bot control · rate limits  │
                     │  TLS termination · HSTS · HTTP/2 + /3    │
                     └────────────────┬─────────────────────────┘
                                      │ TLS (origin pull)
                     ┌────────────────▼─────────────────────────┐
                     │ Railway — US West                        │
                     │                                          │
                     │  ┌────────────────────────────────────┐  │
                     │  │ EnterpriseComply service           │  │
                     │  │  · React SPA (static, Vite build)  │  │
                     │  │  · NestJS API  (/api/*)            │  │
                     │  │  · helmet CSP/HSTS, CORS allowlist │  │
                     │  │  · RateLimitGuard (global)         │  │
                     │  │  · ClerkAuthGuard → OrgContextGuard│  │
                     │  │    → RequireRole → RequirePlan     │  │
                     │  │  · AuditInterceptor (global)       │  │
                     │  │  · IdleTimeoutMiddleware (30 min)  │  │
                     │  └───────────────┬────────────────────┘  │
                     │                  │ private network       │
                     │                  │ *.railway.internal    │
                     │  ┌───────────────▼────────────────────┐  │
                     │  │ PostgreSQL 16                      │  │
                     │  │  · row level security per tenant   │  │
                     │  │  · WORM triggers (audit, evidence) │  │
                     │  │  · hash-chain evidence ledger      │  │
                     │  │  · PITR + daily volume backups     │  │
                     │  └────────────────────────────────────┘  │
                     └──────────────────┬───────────────────────┘
                                        │ egress, SSRF-guarded,
                                        │ HTTPS only, IP-pinned
                     ┌──────────────────▼───────────────────────┐
                     │ Customer-authorised integrations         │
                     │ AWS · GitHub · Okta · Google Workspace · │
                     │ Cloudflare · Railway · Vault · 15 more   │
                     └──────────────────────────────────────────┘
```

## 2. Trust boundaries

| # | Boundary | Crossed by | Control |
|---|----------|-----------|---------|
| 1 | Internet → edge | Every request | Cloudflare WAF, TLS 1.2+, HSTS, bot management, edge rate limits |
| 2 | Edge → origin | Proxied requests | Cloudflare proxy on both hostnames; origin reachable only over HTTPS |
| 3 | Anonymous → authenticated | Sign-in | better-auth magic link, 15-minute single-use token, invite-gated. Password authentication is disabled entirely |
| 4 | Authenticated → tenant data | Every API call | `OrgContextGuard` resolves membership, rejects URL org IDs that do not match the caller's membership, then RBAC and plan gates |
| 5 | Tenant A → tenant B | Never permitted | Application-layer org predicates on every query, plus PostgreSQL RLS policies bound to `app.current_org_id` |
| 6 | Application → third party | Integration sync | `guardedFetch` — HTTPS only, DNS re-resolution, private/loopback/link-local/CGNAT rejected, connection pinned to the validated IP |
| 7 | Operator → production | Deploys and admin | GitHub branch protection, CI gates, Railway deploy from `main` only, super-admin actions audited |

## 3. Identity and access

**Authentication.** Passwordless magic link via better-auth. Tokens expire in
15 minutes and are single use (NIST IA-5(1)). Email/password sign-in is
disabled in configuration, which removes the entire credential-stuffing
surface. Self-service organisation creation is off, so accounts only exist by
invitation (NIST AC-2).

**Sessions.** 8-hour absolute lifetime with `updateAge: 0`, so a session
cannot be extended indefinitely by activity. Cookies are `httpOnly`,
`secure`, `SameSite=Lax` and carry the `__Secure-` prefix. A 30-minute idle
timeout middleware applies to every API route (NIST AC-12).

**Multi-factor.** TOTP (30-second period, 6 digits) with 10 single-use backup
codes. Enforcement is a per-organisation policy: enabling it starts a
configurable grace window (default 14 days) during which members are warned
via an `X-MFA-Enrollment-Deadline` header, after which unenrolled members are
refused with a machine-readable `mfa_enrollment_required` error while the
enrolment route stays reachable.

**SSO.** SAML 2.0 per organisation, gated to the Enterprise plan. Per-org SP
metadata is published for the IdP; assertions are validated before a session
is issued.

**Authorisation.** Six roles in ascending order: `viewer`, `analyst`,
`compliance_manager`, `admin`, `owner`, and the platform-level `super_admin`.
Guards compose as authentication → org context → role → plan.

## 4. Data protection

**In transit.** TLS 1.2+ at the edge with HTTP/2 and HTTP/3, HSTS
`max-age=31536000; includeSubDomains`, and a permanent redirect from HTTP.
Application-to-database traffic stays on Railway's private network.

**At rest.** Railway-managed volume encryption for PostgreSQL. Integration
credentials are additionally encrypted at the application layer with
AES-256-GCM under a dedicated key (`enc:v1:` envelope, random IV per value,
authentication tag enforced), with a transactional, idempotent key-rotation
endpoint and audit entries for every rotation.

**Tenant isolation.** Three independent layers. The application scopes every
query by `org_id`; PostgreSQL enforces `tenant_isolation` RLS policies on all
51 tenant tables; and a least-privilege database role removes the ability to
bypass those policies. See CONTROLS.md for the current enforcement state of
layer three.

**Integrity.** The audit log and evidence records are Write-Once-Read-Many at
the database layer: triggers reject `UPDATE` and `DELETE` outright. Evidence
removal is a retention state change, never a destructive operation, and a
`legal_hold` flag refuses removal entirely. Every evidence write is appended
to a SHA-256 hash chain (`evidence_ledger`) that an auditor can verify
independently through `GET /api/orgs/:orgId/evidence/ledger/verify`.

## 5. Egress and integrations

All 22 integration connectors route through a single hardened fetch. The
guard resolves DNS, rejects any address in loopback, RFC1918, CGNAT,
link-local (including the cloud metadata endpoints), IPv6 loopback, ULA and
link-local ranges, refuses plaintext HTTP, and then pins the connection to
the exact address it validated so a DNS rebind between check and connect
cannot redirect the request.

## 6. What this architecture does not yet do

Stated plainly, because a security reviewer will find these anyway:

- The application currently connects to PostgreSQL as a superuser, which
  carries `BYPASSRLS`. The RLS policies are installed and correct but are not
  the enforcing control until the least-privilege role cutover completes.
- A single service replica in a single region. There is no automated
  failover; recovery is a redeploy.
- Evidence is stored as URL and metadata, not as uploaded bytes. There is no
  file upload path, and therefore no malware scanning requirement today. The
  planned upgrade is object storage with S3 Object Lock.
- The Cloudflare edge Content-Security-Policy permits `unsafe-inline` and
  `unsafe-eval` for scripts. The origin policy is stricter; the edge policy
  wins.

## Origin trust (edge-to-origin authentication)

Railway assigns every service a public `*.up.railway.app` hostname that resolves
straight to the container. Traffic sent to that hostname never touches Cloudflare,
so the WAF, rate limits, bot controls and Under Attack mode are all bypassable by
anyone who knows it. Cloudflare Authenticated Origin Pulls (mTLS from the edge)
is the textbook control here, but it cannot be completed on Railway because we do
not control client-certificate verification at the origin.

The equivalent is therefore enforced in the application, in
`artifacts/api-server/src/middleware/origin-trust.middleware.ts`, as the very first
middleware in the chain:

1. **Host allow-list.** The literal `Host` header must match `TRUSTED_HOSTS`
   (or a host derived from `PUBLIC_APP_URL` / `APP_URL` / `FRONTEND_URL` /
   `PUBLIC_BASE_URL`). `X-Forwarded-Host` is deliberately ignored because it is
   attacker-controlled. An allow-list entry without a port matches any port; an
   entry with a port must match exactly.
2. **Optional edge shared secret.** When `EDGE_SHARED_SECRET` is set, the request
   must also carry it in `x-ec-edge-auth`, compared with `timingSafeEqual`. A
   Cloudflare Transform Rule adds that header at the edge, which proves the
   request actually transited Cloudflare rather than merely claiming the right
   `Host`. Transform Rules are a separate quota from custom firewall rules, so
   this is available on the Free plan.

`ORIGIN_TRUST_MODE` is `off`, `report` or `enforce`. Production defaults to
`report` so that enabling the control can never black-hole live traffic before the
observed-host list has been reviewed. `/healthz`, `/health`, `/api/healthz` and
`/api/health` are always exempt, because the platform health probe does not come
through Cloudflare and its `Host` is not ours to set — without that exemption,
enforcement would fail every deploy.

Operational view: `GET /api/admin/origin-trust` (super_admin only) returns the
current mode, the allow-list, every hostname observed at the origin with request
and refusal counts, and whether an edge secret is configured. It never returns the
secret itself.

Coverage: test-suite SECTION 38 forges a `Host` header at the socket level
(`fetch()` refuses to set `Host`, which is the whole point of the control) and
asserts a `421 Misdirected Request` for the bare Railway hostname while
`/api/healthz` still answers `200`.

## Content-Security-Policy

`script-src` no longer contains `'unsafe-inline'`. A per-request nonce is minted in
`main.ts` before helmet runs, published in the header as `'nonce-<base64>'`, and
stamped onto every `<script` tag of the served `index.html`. `express.static` is
configured with `index: false` so that no HTML response can escape the stamping
step.

`style-src` keeps `'unsafe-inline'` on purpose: React and Tailwind set style
attributes at runtime. Style injection cannot execute script and `script-src` is
nonce-locked, so this is a documented residual risk rather than an oversight.

Exported assessment report HTML is served with `default-src 'none'; script-src
'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. The report is a
static document containing tenant-supplied text, so it has no reason to be able to
execute anything.
