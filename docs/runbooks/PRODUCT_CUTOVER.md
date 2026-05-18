# Product Cutover Runbook

Standard procedure for bringing a new product online under the ColorCode
Solutions platform. Use this when a new app needs a public subdomain on
`colorcodesolutions.com` (or a vanity domain) and a launcher card.

Following this runbook produces SOC 2 CC8.1 / NIST 800-53 CM-3 change
management evidence by construction.

## When to use this runbook

Any of these scenarios:

- A new product that needs its own `*.colorcodesolutions.com` subdomain.
- An existing product moving from staging to production.
- A placeholder Worker being replaced by a real application backend.
- A vanity domain mapping (e.g. `www.c2sintel.com` -> internal subdomain).

## Prerequisites (account owner work, not engineer-executable)

1. Application source committed to the EnterpriseComply repo under
   `artifacts/<product-slug>/`.
2. Hosting target created and reachable. Two supported patterns:
   - **Pattern A** (recommended for full apps): Railway service named
     `<product-slug>` rooted at the artifact path, with environment
     variables set in Railway's dashboard.
   - **Pattern B** (static sites or edge-only apps): Cloudflare Pages project.
3. Public hostname of the target service noted (e.g. `*.up.railway.app` for
   Railway, `*.pages.dev` for Pages).

## Engineer-executable cutover sequence

### Step 0: Open a session-scoped task in PLATFORM_CHANGELOG.md

Document intent before touching production. Include rollback target.

### Step 1: Author and commit the proxy Worker source

- Path: `artifacts/cloudflare-workers/<product-slug>-proxy/worker.js`
- Pattern: copy `c2s-intel-proxy/worker.js` and adapt env binding name.
- Companion: `artifacts/cloudflare-workers/<product-slug>-proxy/README.md`
  documenting bindings, route, deploy, and rollback.
- This commit is reviewable, not deployed.

### Step 2: Pre-change validation

All three must pass before touching production:

- `curl https://<hosting-target-host>/` returns 200 with the app's index page.
- Authentication (Clerk / OAuth) works against the target's direct hostname.
- Cloudflare dashboard is observably healthy (no `Caution` indicators on the
  workers/zones view, deploys completing in < 30s in the account).

If the Cloudflare dashboard is degraded, **stop**. Reschedule for a healthy
window. Do not flip production toggles when observability is unhealthy.

### Step 3: Deploy the proxy Worker (dark)

Deploy the Worker source from Step 1 to its named Worker service. Do not yet
bind it to a Worker route. Verify via the Worker's preview URL.

Record the deployment ID for rollback.

### Step 4: Swap the Worker route (production traffic moment)

This is the irreversible production cutover. Requires explicit human
confirmation per SOC 2 CC8.1.

- Cloudflare Zone `colorcodesolutions.com` -> Workers Routes.
- Change `<product-slug>.colorcodesolutions.com/*` from the current Worker to
  `<product-slug>-proxy`.
- Immediately: `curl -I https://<product-slug>.colorcodesolutions.com/`
  expect 200 (or the app's healthy status code).
- Manual smoke: sign in, exercise one core flow.
- Watch error rate for 5-10 minutes.

If any check fails, revert the route immediately to the prior Worker.

### Step 5: Flip the launcher card

- Update `app-launcher` Worker product list:
  - Set the product status to `live`, badge to `LIVE`, target URL to the
    public subdomain.
- Deploy app-launcher Worker.
- Verify on `https://app.colorcodesolutions.com` that the card is green and
  clickable.

### Step 6: Add the health probe

- Update `health-monitor` Worker probe set with the new hostname.
- Deploy.
- Verify `status.colorcodesolutions.com` shows the new product as healthy.

### Step 7: Append PLATFORM_CHANGELOG.md

Close the loop. Include:

- Date.
- Hostnames touched.
- All deployment IDs (proxy Worker, app-launcher, health-monitor) for
  rollback evidence.
- Control mappings (SOC 2 CC8.1 minimum, plus any product-specific controls).

## Vanity domain mapping (Pattern C, additive only)

Only after the internal subdomain has been stable for 7+ days:

1. In Cloudflare, add the vanity domain (e.g. `www.c2sintel.com`) as a new
   zone or via CNAME, depending on the registrar setup.
2. Add an HTTP redirect rule or a separate Worker route on the vanity domain
   that 308-redirects to the internal subdomain. This preserves analytics
   and SEO continuity.
3. Smoke test from a clean browser session.
4. Append PLATFORM_CHANGELOG.md.

Do not chain a vanity-domain change with an initial product cutover. Two
simultaneous unstable changes is the most common outage pattern.

## Rollback decision tree

| Step that failed | Rollback action |
|------------------|-----------------|
| 1 (Worker source review) | Iterate locally. No production impact. |
| 2 (pre-change validation) | Do not proceed. Fix root cause first. |
| 3 (Worker deploy, dark) | Delete the Worker version. No production impact. |
| 4 (route swap) | Revert route to previous Worker immediately. |
| 5 (launcher flip) | Revert app-launcher Worker to previous deployment. Card returns to COMING SOON; direct URL still works. |
| 6 (probe add) | Revert health-monitor Worker. Informational only. |
| 7 (changelog) | Edit and recommit. No production impact. |

## Hard rules

- Never deploy when the Cloudflare dashboard is degraded.
- Never skip the version-controlled Worker source commit. "Deploy from the
  dashboard editor" is not change-management compliant.
- Never flip the launcher card before the route is verified healthy.
- Never chain a product cutover with a vanity-domain mapping in the same
  session.
- Never enter secrets via this runbook. Secret bindings are set by a human
  in the Cloudflare or Railway dashboard, not by the engineer driving cutover.

## Control mappings

- SOC 2: CC6.1, CC6.6, CC7.2, CC8.1, A1.2.
- NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13.
- FedRAMP Moderate baseline alignment.
