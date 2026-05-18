# clerk-proxy Worker — Deploy Checklist

> **Purpose.** Make the production deploy of the corrected `clerk-proxy` Worker a 60-second, zero-improvisation operation when the Cloudflare dashboard is healthy.
>
> **Scope.** EnterpriseComply / ColorCode Solutions platform identity layer.
>
> **Audience.** Engineer with Cloudflare account access (`87b2c292a36f48eab8198745bf5fa3d2`) executing the cutover described in `docs/runbooks/PRODUCT_CUTOVER.md`.

---

## 0. Pre-flight gates (all must pass before opening editor)

| Gate | Pass criterion | If fails |
|------|----------------|----------|
| Cloudflare dashboard health | GCR indicator (bottom-right) reads green ≥ 80/100 **AND** the Worker editor page loads in < 5 seconds | **Stop.** Defer per `PRODUCT_CUTOVER.md`. Re-check in 30 min. |
| Maintenance window | Either a quiet traffic window OR you have informed stakeholders that grc.colorcodesolutions.com sign-in may briefly degrade | Pick a quieter window. |
| Rollback target known | Previous good deployment ID is recorded: `3ba3482d-4fc3-4ca4-adf8-54c65126bcc6` | **Stop.** Get current deployment ID from the Deployments tab first. |
| Source on main | `artifacts/cloudflare-workers/clerk-proxy/worker.js` is the version to deploy (170 lines, ~5.73 KB) | **Stop.** Reconcile main first. |
| Secret in place | `CLERK_SECRET_KEY` binding exists on the Worker as `secret_text` (set previously, do not re-paste) | If missing: account owner pastes `sk_live_*` from Clerk dashboard → API Keys. Engineer must not see/handle this. |
| Clerk allowed origins | All ColorCode subdomains are already in Clerk allowed origins (verified prior session) | If missing: add before deploy. |

---

## 1. Open the Worker editor

URL: `https://dash.cloudflare.com/87b2c292a36f48eab8198745bf5fa3d2/workers/services/view/clerk-proxy/production`

Click **Edit code** (top right of the Worker overview page).

Expected: Monaco editor renders with the current production worker source in < 3 seconds. If it spins for more than 10 seconds → abort, dashboard is degraded.

---

## 2. Replace the source

1. Click anywhere inside the Monaco editor.
2. Select all: `Ctrl + A`.
3. Delete: `Delete`.
4. Open the canonical source in a second tab: `https://github.com/SpartanIron/EnterpriseComply/blob/main/artifacts/cloudflare-workers/clerk-proxy/worker.js`
5. Click **Raw**, `Ctrl + A`, `Ctrl + C`.
6. Back in Monaco: `Ctrl + V`.
7. Visually verify: line count is 170, the first `const` is `CLERK_FAPI_UPSTREAM = "https://frontend-api.clerk.dev"`, the proxy path prefix constant equals `"/__clerk"`.

---

## 3. Save and deploy

1. Click **Save and deploy** (top right).
2. Confirm in modal.
3. Wait for the green "Deployment succeeded" toast.
4. **Record the new deployment ID** from the Deployments tab. Append it to `artifacts/PLATFORM_CHANGELOG.md`.

---

## 4. Post-deploy verification (must complete within 60 seconds of deploy)

### 4a. Curl the proxy endpoint

```bash
curl -i https://colorcodesolutions.com/__clerk/v1/environment
```

**Pass:** HTTP/2 200, `content-type: application/json`, body is a JSON document containing `"auth_config"`, `"display_config"`, or similar Clerk environment keys.

**Fail signals (any of these → rollback immediately):**

- 525 SSL handshake failed → proxy not wired to upstream correctly
- 500 `proxy_misconfigured` → `CLERK_SECRET_KEY` binding missing
- 502 `proxy_upstream_error` → upstream unreachable
- 404 → route binding misconfigured
- Any 5xx that persists across 3 retries

### 4b. CORS preflight check

```bash
curl -i -X OPTIONS https://colorcodesolutions.com/__clerk/v1/environment \
  -H "Origin: https://grc.colorcodesolutions.com" \
  -H "Access-Control-Request-Method: GET"
```

**Pass:** 204, `Access-Control-Allow-Origin: https://grc.colorcodesolutions.com`, `Access-Control-Allow-Credentials: true`, `Vary: Origin`.

**Fail:** No `Access-Control-Allow-Origin` or wildcard `*` returned with credentials → rollback.

### 4c. Secret-leak check

```bash
curl -sS https://colorcodesolutions.com/__clerk/v1/environment | grep -c "sk_live_"
```

**Pass:** `0`. (No secret in response body, ever.)

**Fail:** Any non-zero → rollback immediately and treat as a P0 incident.

---

## 5. Rollback procedure (if any 4a/4b/4c check fails)

1. Cloudflare → Workers → clerk-proxy → **Deployments** tab.
2. Locate deployment `3ba3482d-4fc3-4ca4-adf8-54c65126bcc6`.
3. Click **⋯** → **Rollback to this version**.
4. Confirm.
5. Re-run 4a. Should return to the pre-deploy state (which was the 525 baseline — that is acceptable because it means we are back to the known starting point).
6. Append rollback entry to `artifacts/PLATFORM_CHANGELOG.md` with timestamp, reason, and failing check.

**Do NOT proceed to Step 6 if rollback was triggered.** Open an incident note, diagnose, fix in worker.js on main, re-run checklist from Step 1.

---

## 6. Enable Clerk proxy mode

**Only execute after 4a, 4b, 4c all pass.**

1. Open Clerk dashboard: `https://dashboard.clerk.com/apps/app_3DRbXxZH4HekcgVQHeV8Xgx1RTc/instances/ins_3DRmbNwnYkR8t0LXkqwPnDahXkw/domains`
2. Find the production domain row.
3. Click **Edit** / **Configure Frontend API**.
4. Select **Use a proxy** (or equivalent toggle name).
5. Paste proxy URL: `https://colorcodesolutions.com/__clerk`
6. Save.
7. Clerk will run its own validation against the proxy URL. Expected: green check within 10 seconds.

If Clerk rejects the proxy URL → do NOT force it. Rollback the Worker per Step 5 and re-diagnose.

---

## 7. Observation window (10 minutes, hands-off)

Open in separate tabs and watch:

- `https://grc.colorcodesolutions.com` — open in private window, sign in with a test account.
- Browser DevTools → Network → filter `__clerk` → confirm requests go to `colorcodesolutions.com/__clerk/*` (not `clerk.colorcodesolutions.com`).
- Browser DevTools → Console → zero Clerk errors.
- Cloudflare → Workers → clerk-proxy → **Logs** (real-time tail) → only 2xx, no `clerk_proxy_error` entries.

If anything goes wrong during the 10-minute window → execute Step 5 rollback. The Clerk dashboard proxy toggle can also be reverted to direct mode (this is the auth-layer rollback, separate from the Worker rollback).

---

## 8. Clean up the index.html CDN-rewrite hack

**Only execute after Step 7 passes cleanly for 10 minutes.**

1. Identify the index.html script-rewrite shim added as a workaround (search repo for "rewrite Clerk CDN" or "clerk.browser.js" in HTML).
2. Remove the rewrite block.
3. Commit directly to main with message: `chore(identity): remove index.html CDN-rewrite shim — clerk-proxy is now live`
4. Use **Bypass rules and commit changes**.
5. Verify EnterpriseComply Railway redeploys and sign-in still works.

---

## 9. Final paper trail

Append to `artifacts/PLATFORM_CHANGELOG.md`:

```
### YYYY-MM-DD — clerk-proxy production cutover

- Deployed worker.js (commit a83a21c) to clerk-proxy on Cloudflare.
- New deployment ID: <paste>
- Previous deployment (rollback target, unused): 3ba3482d-4fc3-4ca4-adf8-54c65126bcc6
- curl /__clerk/v1/environment: 200 OK (verified at <timestamp>)
- CORS preflight verified for grc.colorcodesolutions.com origin.
- Clerk proxy mode enabled in dashboard at <timestamp>.
- 10-minute observation window: clean, no errors.
- index.html CDN-rewrite shim removed in commit <sha>.
- Platform identity now running on documented Clerk proxy architecture.
```

---

## 10. Hard NO list (do not do these things)

- **Do NOT** paste `sk_live_*` into Monaco. The secret lives in the Worker binding only.
- **Do NOT** deploy when Cloudflare dashboard GCR < 80/100 or editor takes > 10s to load.
- **Do NOT** chain this cutover with the C2S Intel cutover in the same session.
- **Do NOT** skip Step 4c (secret-leak check). Ever.
- **Do NOT** disable the index.html shim before Step 7 passes.
- **Do NOT** modify Clerk DNS records (`clerk.*`, `accounts.*`, `clk*._domainkey`, `clkmail`) — they stay DNS-only.

---

## Owner / approver

- Engineer executing: any platform engineer with Cloudflare + GitHub write
- Approver for Step 6 (Clerk proxy toggle): account owner (annankwekujude@gmail.com)
- Incident contact: ops@colorcodesolutions.com
