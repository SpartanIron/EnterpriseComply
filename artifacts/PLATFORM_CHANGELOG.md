# Platform Changelog

Authoritative record of production identity, edge, and DNS changes for the
ColorCode Solutions platform. Each entry maps to SOC 2 CC8.1 / NIST 800-53 CM-3
change management evidence.

## 2026-05-18

### Fixed: Google OAuth redirect_uri_mismatch on sign-in

- Symptom: Continue with Google returned Google Error 400, redirect_uri_mismatch.
- Root cause: Clerk's required OAuth redirect URIs were not registered on the
  Google Cloud OAuth client (Project gen-lang-client-0594967095, Client ID
  ending 8deu...).
- Action: User added the two required redirect URIs in Google Cloud Console:
  - https://clerk.colorcodesolutions.com/v1/oauth_callback
  - https://accounts.colorcodesolutions.com/v1/oauth_callback
- Verification: Google account chooser now renders cleanly on the Continue with
  Google flow from accounts.colorcodesolutions.com/sign-in.
- Controls: SOC 2 CC6.1, NIST 800-53 IA-2, IA-8.

### Added: Cloudflare Worker route for apex Clerk proxy

- Route: colorcodesolutions.com/__clerk/* -> clerk-proxy
- Zone: colorcodesolutions.com (bb77bbfe119edc2a64334d2e657a25c9)
- Purpose: Enable the apex domain to act as the Clerk Frontend API origin so
  the browser sees same-origin auth (eliminates third-party cookie failure
  modes and aligns with FedRAMP Moderate AC-17/SC-7 perimeter hardening).
- Status: Route is live. The Worker that backs it is being corrected (see next
  entry); the route currently 525s pending the corrected deploy.
- Controls: SOC 2 CC6.6, NIST 800-53 SC-7, SC-8.

### Diagnosed: clerk-proxy Worker 525 SSL handshake failed

- Symptom: https://colorcodesolutions.com/__clerk/v1/environment returns 525.
- Root cause: Deployed Worker fetched https://frontend-api.clerk.services,
  but Clerk's documented FAPI hostname is https://frontend-api.clerk.dev.
- Resolution path: Authored a corrected Worker source at
  artifacts/cloudflare-workers/clerk-proxy/worker.js committed for review.
  Deployment deferred to a session where the Cloudflare dashboard is healthy
  (observability prerequisite per CC7.2).

### Added: clerk-proxy Worker source as version-controlled artifact

- Path: artifacts/cloudflare-workers/clerk-proxy/worker.js
- Companion: artifacts/cloudflare-workers/clerk-proxy/README.md
- Implements Clerk's official FAPI proxy contract:
  Clerk-Proxy-Url, Clerk-Secret-Key, X-Forwarded-For.
- Streams request body, strips hop-by-hop headers per RFC 7230 6.1,
  explicit CORS allowlist (no wildcard with credentials), structured error
  logging that never echoes secrets.
- Controls: SOC 2 CC8.1 (change management), NIST 800-53 CM-3, CM-4, AU-3.

### Deferred / pending

- Deploy the corrected clerk-proxy Worker (next session).
- Enable Clerk proxy mode in Clerk dashboard (after Worker validates 200 JSON).
- Remove the index.html CDN-rewrite hack (after proxy mode is active).
- Update health-monitor probe to cover /__clerk/v1/environment.
- Cloudflare Pro upgrade (deferred until budget approved by owner).
- HSTS preload (deferred until 30+ days of DNS stability per platform policy).

## Change management discipline

No production identity or edge toggle is flipped without:

1. Pre-change validation evidence.
2. Version-controlled source in this repository.
3. Documented rollback path.
4. Health monitoring confirmed healthy at the time of change.

This policy is enforced for all SOC 2 CC8.1 / FedRAMP Moderate CM-3 changes.

## 2026-05-18 (additional)

### Added: C2S Intel cutover artifacts (reviewable, not deployed)

- artifacts/cloudflare-workers/c2s-intel-proxy/CUTOVER_PLAN.md - full cutover
  sequence, prerequisites (Railway service creation by account owner),
  rollback decision tree, and control mappings.
- artifacts/cloudflare-workers/c2s-intel-proxy/worker.js - the Worker source
  that will forward govcon.colorcodesolutions.com to the C2S Intel Railway
  service. No secrets at the proxy layer.
- artifacts/cloudflare-workers/c2s-intel-proxy/README.md - route contract,
  bindings, deployment procedure, rollback procedure, and the explicit Clerk
  allowed-origins step (so it is not forgotten at cutover).
- Controls: SOC 2 CC8.1, NIST 800-53 CM-3, CM-4.

### Added: docs/runbooks/PRODUCT_CUTOVER.md

Standard runbook for bringing any new product live on the platform. Codifies
prerequisites, engineer-executable cutover steps, vanity-domain pattern,
rollback decision tree, and hard rules (no deploy when Cloudflare dashboard
is degraded, no chaining cutover with vanity-domain mapping in the same
session). Future product launches follow this recipe.

### Architectural confirmation: single Clerk instance across platform

C2S Intel will use the same Clerk app (app_3DRbXxZH4HekcgVQHeV8Xgx1RTc) and
production instance (ins_3DRmbNwnYkR8t0LXkqwPnDahXkw) as EnterpriseComply.
- Same publishable key pk_live_Y2xlcmsuY29sb3Jjb2Rlc29sdXRpb25zLmNvbSQ.
- Same Google OAuth client - the redirect URIs added on 2026-05-18 cover
  C2S Intel too (OAuth callbacks always land on accounts.colorcodesolutions.com).
- Only Clerk-side change needed at cutover: add govcon.colorcodesolutions.com
  to the instance's allowed origins.

### Deferred: clerk-proxy Worker deployment

Cloudflare dashboard observed as degraded (Caution 50/100 indicator, loading
screen exceeding 16s on the workers/services view) during this session.
Per the change management policy now codified in PRODUCT_CUTOVER.md hard
rules: identity toggles are not flipped when observability is degraded.
Deployment of the corrected clerk-proxy worker.js (committed at a83a21c)
rescheduled to a healthy-dashboard session.

### Deferred: C2S Intel Railway service creation

Account owner task - Railway service creation touches billing surface. Once
the service exists and its *.up.railway.app hostname is known, the cutover
is the engineer-executable sequence documented in CUTOVER_PLAN.md.
