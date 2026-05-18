# c2s-intel-proxy Cloudflare Worker

Forwards `govcon.colorcodesolutions.com` traffic to the C2S Intel application
hosted on Railway. Provides a stable Cloudflare-fronted origin so the public
hostname stays under our edge control (security headers, WAF, caching,
observability) while the application runs on Railway.

## Route contract

| Concern         | Value |
|-----------------|-------|
| Worker name     | c2s-intel-proxy |
| Public URL      | https://govcon.colorcodesolutions.com/* |
| Upstream        | https://<C2S_UPSTREAM_HOST> (Railway hostname) |
| Cloudflare account | 87b2c292a36f48eab8198745bf5fa3d2 |
| Zone            | colorcodesolutions.com (bb77bbfe119edc2a64334d2e657a25c9) |

## Required Worker bindings

| Name              | Type       | Source |
|-------------------|------------|--------|
| C2S_UPSTREAM_HOST | plain_text | Railway service public hostname (e.g. `c2s-intel-production.up.railway.app`), no protocol |

No secret bindings. The C2S Intel app is client-rendered and authenticates
via the shared Clerk publishable key + same-platform SSO; the proxy never
sees or handles secret material.

## Required Worker route

```
govcon.colorcodesolutions.com/*  ->  c2s-intel-proxy
```

This route currently points at `govcon-placeholder`. The cutover swap is
step 4 of `CUTOVER_PLAN.md`.

## Required Railway environment variables (set when the service is created)

| Name                          | Value |
|-------------------------------|-------|
| VITE_CLERK_PUBLISHABLE_KEY    | `pk_live_Y2xlcmsuY29sb3Jjb2Rlc29sdXRpb25zLmNvbSQ` (same as EnterpriseComply - one Clerk instance for the whole platform) |
| VITE_API_BASE_URL             | Your C2S Intel API base, e.g. `https://api.colorcodesolutions.com` |
| Any feature flags             | per app needs |

## Required Clerk dashboard step

Before the cutover, add `https://govcon.colorcodesolutions.com` to the Clerk
instance's allowed origins / CORS list. Same Clerk instance as EnterpriseComply
(`app_3DRbXxZH4HekcgVQHeV8Xgx1RTc` / `ins_3DRmbNwnYkR8t0LXkqwPnDahXkw`).
No new keys, no new Clerk app, no Google OAuth changes needed.

## Deployment procedure

1. Pre-change validation (must all pass):
   - `curl https://<C2S_UPSTREAM_HOST>/` returns 200 with the C2S Intel HTML.
   - Sign-in via Clerk works against the Railway preview URL directly.
   - Cloudflare dashboard is observably healthy (no Caution indicators).
   - `govcon.colorcodesolutions.com` is added to Clerk allowed origins.
2. Deploy the Worker source (this directory's `worker.js`) to the Cloudflare
   `c2s-intel-proxy` Worker. Record the deployment ID.
3. Set the `C2S_UPSTREAM_HOST` binding to the Railway hostname.
4. Smoke test via Worker preview URL.
5. Swap the Worker route from `govcon-placeholder` to `c2s-intel-proxy`.
6. Curl `-I https://govcon.colorcodesolutions.com/` -> expect 200.
7. Manual smoke: sign in via launcher card, confirm C2S Intel app renders.
8. Watch for 10 minutes; if clean, proceed to launcher card flip.

## Rollback procedure

At any step that fails:

- **Steps 1-4 fail**: no production impact. Fix and retry.
- **Step 5 fails**: revert the Worker route from `c2s-intel-proxy` back to
  `govcon-placeholder`. Subdomain returns to placeholder page. The launcher
  card is still COMING SOON, so no user-visible regression.
- **Post-cutover regression**: revert the Worker route as above; users see
  the placeholder. If the launcher has already been flipped to LIVE, revert
  the `app-launcher` Worker to its prior deployment as well.

## Control mappings

- SOC 2: CC6.1 (logical access), CC6.6 (transmission), CC7.2 (monitoring),
  CC8.1 (change management), A1.2 (availability).
- NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13.
- FedRAMP Moderate baseline alignment.

## Security properties

- No secrets at the Worker layer.
- Hop-by-hop headers stripped per RFC 7230 section 6.1.
- Defense-in-depth response headers injected at the edge (HSTS without
  preload, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
  Permissions-Policy).
- Request body streamed (no in-memory buffering of uploads).
- X-Forwarded-For / X-Forwarded-Host / X-Forwarded-Proto chain preserved
  for upstream logging.
