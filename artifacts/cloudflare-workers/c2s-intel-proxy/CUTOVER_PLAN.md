# C2S Intel (GovCon) Cutover Plan

Moves `govcon.colorcodesolutions.com` from the current placeholder Worker to
the production C2S Intel application, and flips the launcher card from
`COMING SOON` to `LIVE`.

## Current state (2026-05-18)

- App source: `artifacts/c2s-ciop/` (Vite + React + Clerk, deploy-ready).
- Hostname: `govcon.colorcodesolutions.com` -> `govcon-placeholder` Worker.
- Launcher card: `COMING SOON` (hard-coded in app-launcher Worker source).
- Clerk: same instance as EnterpriseComply (single sign-on across platform).

## Target state

- Hostname: `govcon.colorcodesolutions.com` -> Railway service `c2s-intel`
  (via `c2s-intel-proxy` Cloudflare Worker, mirroring the EnterpriseComply
  pattern for blast-radius isolation and consistent observability).
- Launcher card: `LIVE`, links to `https://govcon.colorcodesolutions.com`.
- Health probe: `status.colorcodesolutions.com` includes `govcon` in its probe set.

## Prerequisite (manual, by account owner)

Create a new Railway service named `c2s-intel` with:

- **Repo root**: `artifacts/c2s-ciop`
- **Build command**: `pnpm install && pnpm build`
- **Start command**: `pnpm preview --host 0.0.0.0 --port $PORT` (or production static serve)
- **Environment variables**:
  - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_Y2xlcmsuY29sb3Jjb2Rlc29sdXRpb25zLmNvbSQ`
  - `VITE_API_BASE_URL` = (api.colorcodesolutions.com or service-specific)
  - Any feature flags the app reads at build time
- **Public networking**: enabled, note the generated `*.up.railway.app` hostname

This service creation is on the account owner because Railway service creation
touches billing surface.

## Cutover sequence (engineer-executable once Railway hostname exists)

### Step 1: Author and commit `c2s-intel-proxy` Worker source

- Path: `artifacts/cloudflare-workers/c2s-intel-proxy/worker.js`
- Pattern: minimal HTTP forwarder to the Railway public hostname.
- No secret bindings required (C2S Intel app is fully client-rendered and uses
  Clerk's public publishable key only; the API gateway handles authenticated
  backend calls separately).
- CORS: not needed at the proxy layer (same-origin to the user).
- Headers: preserve `Host` upstream rewrite, pass `CF-Connecting-IP`,
  strip hop-by-hop per RFC 7230 6.1.
- Companion `README.md` with deploy + rollback procedure (mirror clerk-proxy
  documentation pattern).

### Step 2: Pre-change validation

- Verify Railway service health: `curl https://<railway-host>/` returns 200 with
  the C2S Intel index.html.
- Verify Clerk sign-in works against the Railway-hosted preview (manual smoke).
- Verify the app-launcher card change diff is reviewed and ready (next step).

### Step 3: Deploy `c2s-intel-proxy` Worker

- Deploy via Cloudflare API or dashboard with the source from Step 1.
- Worker is NOT yet bound to any route - it is dark.
- Verify by invoking the Worker preview URL directly.

### Step 4: Swap Worker route

- Cloudflare Zone `colorcodesolutions.com` -> Workers Routes
- Change: `govcon.colorcodesolutions.com/*` from `govcon-placeholder` to `c2s-intel-proxy`
- This is the irreversible production traffic moment - requires explicit
  human ack per SOC 2 CC8.1.
- Immediately after: `curl -I https://govcon.colorcodesolutions.com` -> expect 200.
- Manual smoke: sign in via launcher card, confirm C2S Intel app renders.

### Step 5: Flip launcher card to LIVE

- Update `app-launcher` Worker product list:
  - C2S Intel: `status: 'live'`, badge: `LIVE` (green), clickable target
    `https://govcon.colorcodesolutions.com`.
- Deploy app-launcher Worker.
- Verify `https://app.colorcodesolutions.com` shows the green LIVE badge on
  the C2S Intel card and the card is clickable.

### Step 6: Add health probe

- Update `health-monitor` Worker probe set:
  - Add `https://govcon.colorcodesolutions.com/` (expect 200, look for known
    string in body like the C2S Intel title).
- Deploy health-monitor.
- Verify `status.colorcodesolutions.com` shows C2S Intel as healthy.

### Step 7: Commit changelog entry

- Append `PLATFORM_CHANGELOG.md` with the cutover entry, including all
  deployment IDs for rollback evidence (SOC 2 CC8.1).

## Rollback procedure

At any step that fails:

- **Steps 1-3 fail**: no production impact, fix and retry.
- **Step 4 fails**: revert Worker route from `c2s-intel-proxy` back to
  `govcon-placeholder`. Subdomain returns to placeholder page.
  No user-visible regression because the launcher card is still COMING SOON.
- **Step 5 fails after step 4 succeeded**: revert app-launcher Worker to its
  previous deployment; users see COMING SOON again; the live app still works
  at the direct URL but is not advertised.
- **Step 6**: probe failure is informational only; correct and redeploy.

## Control mappings

- SOC 2: CC6.1, CC6.6, CC7.2, CC8.1, A1.2 (availability via probe).
- NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13.
- FedRAMP Moderate baseline alignment.

## Deferred (not in this cutover)

- Mapping `www.c2sintel.com` -> `govcon.colorcodesolutions.com` (external
  domain). Do this only after C2S Intel has been stable on the GovCon subdomain
  for at least 7 days. Chaining two unstable changes is how outages happen.
- Cloudflare Pro upgrade (separate budget approval).
- HSTS preload submission (separate 30+ day DNS stability window).
