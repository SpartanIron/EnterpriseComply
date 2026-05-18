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

### Ground-truth reconciliation: C2S Intel is NOT on Clerk

Direct inspection of `SpartanIron/C2S-Contract-Intelligence-Platform` (.env.example
+ repo-wide code search for "clerk" returning zero matches) confirmed C2S Intel
uses its own express-session + Google OAuth, NOT Clerk. Earlier session notes
that assumed Clerk on C2S Intel were factually wrong.

Direct inspection of the Railway project `c2s-intel-platform` confirmed the
C2S Intel app is already deployed as service `c2s-api-server` (service ID
`a1b02044-90f5-4403-b63f-f27318bae3b9`), Online, bound to `www.c2sintel.com`
and `app.c2sintel.com` plus the Railway-assigned
`c2s-api-server-production.up.railway.app` host. No Railway service creation
is needed; that prior deferral item was based on incorrect assumptions.

Implications: prior c2s-intel-proxy artifacts (CUTOVER_PLAN aa8549e, README
5e1bfa3, worker.js 06e4ab8) are factually wrong about Clerk allowed-origins
being sufficient for SSO. They are flagged superseded.

### Decision: Platform-wide SSO via Path 1 (migrate C2S Intel to Clerk)

Documented in `docs/architecture/SSO_DECISION.md` (commits 12aff3a +
4b4d0cf). Engineer-executable migration plan at
`docs/architecture/SSO_MIGRATION_PLAN.md`.

Rationale: federal-customer expectation; native Clerk SAML/MFA/audit/SCIM
avoid build-twice tax; bounded 2-5 day migration is reversible at planning
stage and stageable on Railway preview; closes the incidentally-bifurcated
identity architecture before the C2S Intel user base scales further.

Locked sequencing:
1. clerk-proxy Worker deploy (still held - Cloudflare dashboard observed
   degraded today, GCR Caution 50/100, splash never resolved across 30+s).
2. C2S Intel Clerk migration on branch; staged on Railway preview.
3. Cut over C2S Intel Railway production to Clerk-only auth; 1-hour log watch.
4. Map govcon.colorcodesolutions.com to c2s-api-server via Railway
   custom-domain + Cloudflare proxied CNAME (simpler than the superseded
   c2s-intel-proxy Worker approach).
5. Flip launcher card COMING SOON -> LIVE; add health-monitor probe.

### Added: clerk-proxy DEPLOY_CHECKLIST.md

Codified the 60-second clerk-proxy production deploy sequence with explicit
pre-flight gates, three verification curls (200 health, CORS preflight,
secret-leak check), rollback to deployment
`3ba3482d-4fc3-4ca4-adf8-54c65126bcc6`, Clerk proxy-mode toggle steps,
10-minute observation window, index.html shim cleanup, and a Hard NO list.
Located at `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`.

### Verified: Cloudflare dashboard health (deploy gate)

Re-probed dash.cloudflare.com Workers editor today: still degraded.
GCR indicator reads Caution (50/100), splash loading screen did not resolve
after 30+ seconds across multiple reload attempts. Per PRODUCT_CUTOVER.md
codified rule, clerk-proxy production deploy remains deferred until the
dashboard returns to healthy state.

### Production state at end of 2026-05-18 session

- grc.colorcodesolutions.com -> EnterpriseComply (Clerk, working)
- app.colorcodesolutions.com -> Launcher (Clerk session on .colorcodesolutions.com, working)
- govcon.colorcodesolutions.com -> govcon-placeholder Worker (unchanged)
- www.c2sintel.com / app.c2sintel.com -> c2s-api-server Railway (own auth, untouched)
- clerk-proxy production Worker -> previous (broken) version still serving 525 baseline
- colorcodesolutions.com/__clerk/* route -> wired (added prior session); awaiting healthy-dashboard deploy of corrected worker.js (committed at a83a21c)

---

## 2026-05-18 (entry 6) â Migration strategy locked: 5a (Clerk Import API)

Updated docs/architecture/SSO_MIGRATION_PLAN.md adding Section 5c "Locked decision (canonical)".

**Decision.** Strategy 5a (Clerk Import API) is now the canonical user-migration approach for the C2S Intel â Clerk migration. Zero customer-facing disruption.

**Decided by.** Account-owner direction ("go with your recommendation").

**Conditional fallback.** 5b (re-onboard at first login) remains documented but only as a fallback for user bases under 10, and only with explicit owner approval recorded in the paper trail.

**Reinforced constraints.** sk_live_* Clerk Import API calls remain owner-only. Engineer prepares the JSON payload, owner runs the request. A pre-import dry run (test instance OR 1â2 user production sample) is mandatory before the full batch import.

**Commits this entry.**
- (this changelog append)
- docs(sso): lock 5a Clerk Import API as canonical migration strategy (b6a2888)

**Production state.** Unchanged. No deploys, no DNS changes, no Clerk toggles, no Railway env changes. Architecture document only.
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

### Ground-truth reconciliation: C2S Intel is NOT on Clerk

Direct inspection of `SpartanIron/C2S-Contract-Intelligence-Platform` (.env.example
+ repo-wide code search for "clerk" returning zero matches) confirmed C2S Intel
uses its own express-session + Google OAuth, NOT Clerk. Earlier session notes
that assumed Clerk on C2S Intel were factually wrong.

Direct inspection of the Railway project `c2s-intel-platform` confirmed the
C2S Intel app is already deployed as service `c2s-api-server` (service ID
`a1b02044-90f5-4403-b63f-f27318bae3b9`), Online, bound to `www.c2sintel.com`
and `app.c2sintel.com` plus the Railway-assigned
`c2s-api-server-production.up.railway.app` host. No Railway service creation
is needed; that prior deferral item was based on incorrect assumptions.

Implications: prior c2s-intel-proxy artifacts (CUTOVER_PLAN aa8549e, README
5e1bfa3, worker.js 06e4ab8) are factually wrong about Clerk allowed-origins
being sufficient for SSO. They are flagged superseded.

### Decision: Platform-wide SSO via Path 1 (migrate C2S Intel to Clerk)

Documented in `docs/architecture/SSO_DECISION.md` (commits 12aff3a +
4b4d0cf). Engineer-executable migration plan at
`docs/architecture/SSO_MIGRATION_PLAN.md`.

Rationale: federal-customer expectation; native Clerk SAML/MFA/audit/SCIM
avoid build-twice tax; bounded 2-5 day migration is reversible at planning
stage and stageable on Railway preview; closes the incidentally-bifurcated
identity architecture before the C2S Intel user base scales further.

Locked sequencing:
1. clerk-proxy Worker deploy (still held - Cloudflare dashboard observed
   degraded today, GCR Caution 50/100, splash never resolved across 30+s).
2. C2S Intel Clerk migration on branch; staged on Railway preview.
3. Cut over C2S Intel Railway production to Clerk-only auth; 1-hour log watch.
4. Map govcon.colorcodesolutions.com to c2s-api-server via Railway
   custom-domain + Cloudflare proxied CNAME (simpler than the superseded
   c2s-intel-proxy Worker approach).
5. Flip launcher card COMING SOON -> LIVE; add health-monitor probe.

### Added: clerk-proxy DEPLOY_CHECKLIST.md

Codified the 60-second clerk-proxy production deploy sequence with explicit
pre-flight gates, three verification curls (200 health, CORS preflight,
secret-leak check), rollback to deployment
`3ba3482d-4fc3-4ca4-adf8-54c65126bcc6`, Clerk proxy-mode toggle steps,
10-minute observation window, index.html shim cleanup, and a Hard NO list.
Located at `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`.

### Verified: Cloudflare dashboard health (deploy gate)

Re-probed dash.cloudflare.com Workers editor today: still degraded.
GCR indicator reads Caution (50/100), splash loading screen did not resolve
after 30+ seconds across multiple reload attempts. Per PRODUCT_CUTOVER.md
codified rule, clerk-proxy production deploy remains deferred until the
dashboard returns to healthy state.

### Production state at end of 2026-05-18 session

- grc.colorcodesolutions.com -> EnterpriseComply (Clerk, working)
- app.colorcodesolutions.com -> Launcher (Clerk session on .colorcodesolutions.com, working)
- govcon.colorcodesolutions.com -> govcon-placeholder Worker (unchanged)
- www.c2sintel.com / app.c2sintel.com -> c2s-api-server Railway (own auth, untouched)
- clerk-proxy production Worker -> previous (broken) version still serving 525 baseline
- colorcodesolutions.com/__clerk/* route -> wired (added prior session); awaiting healthy-dashboard deploy of corrected worker.js (committed at a83a21c)

---

## 2026-05-18 (entry 7) — C2S Intel migration: branch opened + security incident filed

First write into the C2S Intel repo (`SpartanIron/C2S-Contract-Intelligence-Platform`) for the Clerk migration. Working branch `migration/clerk-prep` created, two docs committed:

- `docs/migration/AUTH_INVENTORY.md` (commit `4b6a198`) — 12-section auth-surface skeleton enumerating session middleware, Google OAuth routes, auth-gated middleware, user schema + FK fan-out, frontend auth state, logout, CSRF/CORS/cookie posture, inter-product integrations, Clerk Import API data extraction, schema change for `clerk_user_id`, security concerns, and sign-off. Verified facts pre-filled; engineer fills `TODO` slots via local `rg`.
- `docs/security/INCIDENT_2026_05_18_FIELD_ENCRYPTION_KEY_EXPOSED.md` (commit `bf352a2`) — incident note. Plaintext AES-256-GCM `FIELD_ENCRYPTION_KEY` discovered in `.replit` on `main`. 4-phase remediation plan: rotate via Railway env, re-encrypt at-rest data, scrub git history with `git filter-repo`, prevent recurrence via secret-scanning + push protection. Literal key value deliberately NOT included in the incident doc to avoid re-leak. Owner decision required before any production auth change in C2S Intel.

**Gates added.** Per the incident note Section 5, the Clerk migration cutover sequence (`SSO_MIGRATION_PLAN.md` Section 6) must NOT run until at least Phase 2 (re-encrypt at-rest data) of the FIELD_ENCRYPTION_KEY remediation is complete. Touching production env vars with a known-compromised secret in flight is unsafe.

**Production state.** Unchanged. No code commits to main on either repo. Working branch only. No DNS, no Clerk toggles, no Railway env changes.
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

### Ground-truth reconciliation: C2S Intel is NOT on Clerk

Direct inspection of `SpartanIron/C2S-Contract-Intelligence-Platform` (.env.example
+ repo-wide code search for "clerk" returning zero matches) confirmed C2S Intel
uses its own express-session + Google OAuth, NOT Clerk. Earlier session notes
that assumed Clerk on C2S Intel were factually wrong.

Direct inspection of the Railway project `c2s-intel-platform` confirmed the
C2S Intel app is already deployed as service `c2s-api-server` (service ID
`a1b02044-90f5-4403-b63f-f27318bae3b9`), Online, bound to `www.c2sintel.com`
and `app.c2sintel.com` plus the Railway-assigned
`c2s-api-server-production.up.railway.app` host. No Railway service creation
is needed; that prior deferral item was based on incorrect assumptions.

Implications: prior c2s-intel-proxy artifacts (CUTOVER_PLAN aa8549e, README
5e1bfa3, worker.js 06e4ab8) are factually wrong about Clerk allowed-origins
being sufficient for SSO. They are flagged superseded.

### Decision: Platform-wide SSO via Path 1 (migrate C2S Intel to Clerk)

Documented in `docs/architecture/SSO_DECISION.md` (commits 12aff3a +
4b4d0cf). Engineer-executable migration plan at
`docs/architecture/SSO_MIGRATION_PLAN.md`.

Rationale: federal-customer expectation; native Clerk SAML/MFA/audit/SCIM
avoid build-twice tax; bounded 2-5 day migration is reversible at planning
stage and stageable on Railway preview; closes the incidentally-bifurcated
identity architecture before the C2S Intel user base scales further.

Locked sequencing:
1. clerk-proxy Worker deploy (still held - Cloudflare dashboard observed
   degraded today, GCR Caution 50/100, splash never resolved across 30+s).
2. C2S Intel Clerk migration on branch; staged on Railway preview.
3. Cut over C2S Intel Railway production to Clerk-only auth; 1-hour log watch.
4. Map govcon.colorcodesolutions.com to c2s-api-server via Railway
   custom-domain + Cloudflare proxied CNAME (simpler than the superseded
   c2s-intel-proxy Worker approach).
5. Flip launcher card COMING SOON -> LIVE; add health-monitor probe.

### Added: clerk-proxy DEPLOY_CHECKLIST.md

Codified the 60-second clerk-proxy production deploy sequence with explicit
pre-flight gates, three verification curls (200 health, CORS preflight,
secret-leak check), rollback to deployment
`3ba3482d-4fc3-4ca4-adf8-54c65126bcc6`, Clerk proxy-mode toggle steps,
10-minute observation window, index.html shim cleanup, and a Hard NO list.
Located at `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`.

### Verified: Cloudflare dashboard health (deploy gate)

Re-probed dash.cloudflare.com Workers editor today: still degraded.
GCR indicator reads Caution (50/100), splash loading screen did not resolve
after 30+ seconds across multiple reload attempts. Per PRODUCT_CUTOVER.md
codified rule, clerk-proxy production deploy remains deferred until the
dashboard returns to healthy state.

### Production state at end of 2026-05-18 session

- grc.colorcodesolutions.com -> EnterpriseComply (Clerk, working)
- app.colorcodesolutions.com -> Launcher (Clerk session on .colorcodesolutions.com, working)
- govcon.colorcodesolutions.com -> govcon-placeholder Worker (unchanged)
- www.c2sintel.com / app.c2sintel.com -> c2s-api-server Railway (own auth, untouched)
- clerk-proxy production Worker -> previous (broken) version still serving 525 baseline
- colorcodesolutions.com/__clerk/* route -> wired (added prior session); awaiting healthy-dashboard deploy of corrected worker.js (committed at a83a21c)

---

## 2026-05-18 (entry 6) — Migration strategy locked: 5a (Clerk Import API)

Updated docs/architecture/SSO_MIGRATION_PLAN.md adding Section 5c "Locked decision (canonical)".

**Decision.** Strategy 5a (Clerk Import API) is now the canonical user-migration approach for the C2S Intel → Clerk migration. Zero customer-facing disruption.

**Decided by.** Account-owner direction ("go with your recommendation").

**Conditional fallback.** 5b (re-onboard at first login) remains documented but only as a fallback for user bases under 10, and only with explicit owner approval recorded in the paper trail.

**Reinforced constraints.** sk_live_* Clerk Import API calls remain owner-only. Engineer prepares the JSON payload, owner runs the request. A pre-import dry run (test instance OR 1–2 user production sample) is mandatory before the full batch import.

**Commits this entry.**
- (this changelog append)
- docs(sso): lock 5a Clerk Import API as canonical migration strategy (b6a2888)

**Production state.** Unchanged. No deploys, no DNS changes, no Clerk toggles, no Railway env changes. Architecture document only.
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

### Ground-truth reconciliation: C2S Intel is NOT on Clerk

Direct inspection of `SpartanIron/C2S-Contract-Intelligence-Platform` (.env.example
+ repo-wide code search for "clerk" returning zero matches) confirmed C2S Intel
uses its own express-session + Google OAuth, NOT Clerk. Earlier session notes
that assumed Clerk on C2S Intel were factually wrong.

Direct inspection of the Railway project `c2s-intel-platform` confirmed the
C2S Intel app is already deployed as service `c2s-api-server` (service ID
`a1b02044-90f5-4403-b63f-f27318bae3b9`), Online, bound to `www.c2sintel.com`
and `app.c2sintel.com` plus the Railway-assigned
`c2s-api-server-production.up.railway.app` host. No Railway service creation
is needed; that prior deferral item was based on incorrect assumptions.

Implications: prior c2s-intel-proxy artifacts (CUTOVER_PLAN aa8549e, README
5e1bfa3, worker.js 06e4ab8) are factually wrong about Clerk allowed-origins
being sufficient for SSO. They are flagged superseded.

### Decision: Platform-wide SSO via Path 1 (migrate C2S Intel to Clerk)

Documented in `docs/architecture/SSO_DECISION.md` (commits 12aff3a +
4b4d0cf). Engineer-executable migration plan at
`docs/architecture/SSO_MIGRATION_PLAN.md`.

Rationale: federal-customer expectation; native Clerk SAML/MFA/audit/SCIM
avoid build-twice tax; bounded 2-5 day migration is reversible at planning
stage and stageable on Railway preview; closes the incidentally-bifurcated
identity architecture before the C2S Intel user base scales further.

Locked sequencing:
1. clerk-proxy Worker deploy (still held - Cloudflare dashboard observed
   degraded today, GCR Caution 50/100, splash never resolved across 30+s).
2. C2S Intel Clerk migration on branch; staged on Railway preview.
3. Cut over C2S Intel Railway production to Clerk-only auth; 1-hour log watch.
4. Map govcon.colorcodesolutions.com to c2s-api-server via Railway
   custom-domain + Cloudflare proxied CNAME (simpler than the superseded
   c2s-intel-proxy Worker approach).
5. Flip launcher card COMING SOON -> LIVE; add health-monitor probe.

### Added: clerk-proxy DEPLOY_CHECKLIST.md

Codified the 60-second clerk-proxy production deploy sequence with explicit
pre-flight gates, three verification curls (200 health, CORS preflight,
secret-leak check), rollback to deployment
`3ba3482d-4fc3-4ca4-adf8-54c65126bcc6`, Clerk proxy-mode toggle steps,
10-minute observation window, index.html shim cleanup, and a Hard NO list.
Located at `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`.

### Verified: Cloudflare dashboard health (deploy gate)

Re-probed dash.cloudflare.com Workers editor today: still degraded.
GCR indicator reads Caution (50/100), splash loading screen did not resolve
after 30+ seconds across multiple reload attempts. Per PRODUCT_CUTOVER.md
codified rule, clerk-proxy production deploy remains deferred until the
dashboard returns to healthy state.

### Production state at end of 2026-05-18 session

- grc.colorcodesolutions.com -> EnterpriseComply (Clerk, working)
- app.colorcodesolutions.com -> Launcher (Clerk session on .colorcodesolutions.com, working)
- govcon.colorcodesolutions.com -> govcon-placeholder Worker (unchanged)
- www.c2sintel.com / app.c2sintel.com -> c2s-api-server Railway (own auth, untouched)
- clerk-proxy production Worker -> previous (broken) version still serving 525 baseline
- colorcodesolutions.com/__clerk/* route -> wired (added prior session); awaiting healthy-dashboard deploy of corrected worker.js (committed at a83a21c)

---

## Entry 8 — 2026-05-18 — FIELD_ENCRYPTION_KEY rotation and removal (C2S Intel)

### Context

During the pre-Clerk-migration auth-surface review of `SpartanIron/C2S-Contract-Intelligence-Platform`, a plaintext AES-256-GCM key was found committed in the `.replit` file on `main`:

```
[userenv.shared]
FIELD_ENCRYPTION_KEY = "<64-char hex string — real production key>"
```

This key drives field-level encryption for sensitive columns. Treated as High severity.

### Cross-product impact

None to EnterpriseComply directly (separate repo, separate Clerk app, separate database). Logged here because EnterpriseComply's PLATFORM_CHANGELOG is the canonical platform-wide history and because ColorCode SSO will soon link the two products.

### Resolution

1. Incident note committed on `migration/clerk-prep`: `docs/security/INCIDENT_2026_05_18_FIELD_ENCRYPTION_KEY_EXPOSED.md` (commit `bf352a2`).
2. Rotation runbook committed on `migration/clerk-prep`: `docs/security/RUNBOOK_2026_05_18_ROTATE_FIELD_ENCRYPTION_KEY.md` (commit `8eb3c3c`).
3. Owner generated a new 64-char hex key locally with `openssl rand -hex 32` and pasted it into the Railway service `c2s-api-server` env var `FIELD_ENCRYPTION_KEY`. Railway auto-redeployed; owner confirmed service healthy.
4. Plaintext key line removed from `.replit` on `main` of C2S Intel repo (commit `c85a45c` on `main`). Replaced with a comment block pointing to the incident note and runbook.
5. Resolution log appended to incident note (commit `7a76440` on `migration/clerk-prep`).

### Residual risk

The old key value is still present in C2S Intel git history. Step 7 of the runbook (`git filter-repo` scrub on a fresh clone, then force push) is owner-executed locally and remains open. Live blast radius is closed because the rotated key value cannot decrypt any production data.

### Status board after this entry

- C2S Intel `FIELD_ENCRYPTION_KEY` exposure — live blast radius **closed**, source-tree **closed**, git-history **open** (owner action pending).
- C2S Intel Clerk migration — branch `migration/clerk-prep` is now ready for code-level Clerk integration. Next commits will land `@clerk/express` on `artifacts/api-server`, `@clerk/clerk-react` on `artifacts/c2s-dashboard`, and a `clerk_user_id` column on the `users` table. Re-onboarding strategy (no users to import) confirmed by owner.
- EnterpriseComply production — unchanged. No deploys, no DNS, no Clerk toggles this session.
- clerk-proxy Worker — corrected source still committed-only (commit `a83a21c`); deploy still gated on Cloudflare dashboard health.
