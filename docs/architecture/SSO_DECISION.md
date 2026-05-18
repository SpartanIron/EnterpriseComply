# Platform SSO — Architecture Decision Required

> **Status.** Decision pending. This document captures verified ground truth and three honest paths forward. It supersedes any earlier runbook that assumed cross-product SSO was already wired.
>
> **Date verified.** 2026-05-18
>
> **Verified by.** Direct inspection of the C2S Intel repo, the EnterpriseComply repo, the Railway project, the Clerk dashboard, and the live launcher.

---

## 1. Stated goal

A user lands on `app.colorcodesolutions.com`, signs in once, sees the launcher with both products, clicks either tile, and lands inside that product **already authenticated**. One identity. Two products. Industry-standard multi-product SaaS SSO.

---

## 2. Ground truth (today)

### 2a. Identity stack today

| Surface | Auth system | Session domain | Notes |
|---------|-------------|----------------|-------|
| `app.colorcodesolutions.com` (launcher) | Clerk (`ins_3DRmbNwnYkR8t0LXkqwPnDahXkw`) | `.colorcodesolutions.com` | Source: app-launcher Cloudflare Worker. |
| `grc.colorcodesolutions.com` (EnterpriseComply) | Clerk (same instance) | `.colorcodesolutions.com` | Source: `SpartanIron/EnterpriseComply` repo. Inherits launcher session correctly. |
| `govcon.colorcodesolutions.com` | Currently bound to `govcon-placeholder` Worker. Not in service. | N/A | Intended destination for C2S Intel. |
| `www.c2sintel.com` / `app.c2sintel.com` (C2S Intel — already live) | **Own session + own Google OAuth.** Not Clerk. | `.c2sintel.com` (separate registrable domain) | Source: `SpartanIron/C2S-Contract-Intelligence-Platform` repo. `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` per `.env.example`. Zero references to "clerk" in the codebase (verified via code search). |

### 2b. Launcher tile behavior (verified by reading DOM)

| Tile | Link | Auth handoff |
|------|------|--------------|
| EnterpriseComply | `https://grc.colorcodesolutions.com/` | None passed in URL. Relies on Clerk cookie on `.colorcodesolutions.com`. **Works.** |
| C2S Intel (GovCon) | `https://govcon.colorcodesolutions.com/` | None passed in URL. Currently 404/placeholder. **Does not work.** |

### 2c. Critical consequence

**The "Single sign-on across the ColorCode Solutions platform" copy on the launcher is currently aspirational, not implemented.** If we mapped `govcon.colorcodesolutions.com` to the existing C2S Intel Railway service today with no other changes, a user clicking the C2S Intel tile would land on C2S Intel's **own** login page and have to sign in **again** with a separate username/password (or a separate Google flow on C2S Intel's OAuth client). That is not SSO. That is two products sitting next to each other behind a shared launcher.

### 2d. Browser-level constraint (immutable)

Browsers do not share cookies across registrable domains. A Clerk session cookie set on `.colorcodesolutions.com` is **never** visible to `www.c2sintel.com` regardless of any platform configuration. Any SSO solution between these two brands must use a token-passing or identity-federation mechanism, not cookie sharing — unless C2S Intel is moved fully under `govcon.colorcodesolutions.com` and we accept that the `c2sintel.com` brand-domain surface is auth-independent.

---

## 3. Three honest paths

### Path 1 — Migrate C2S Intel to Clerk (recommended for stated goal)

Replace C2S Intel's session + Google OAuth auth layer with Clerk. After migration, the same Clerk session that signs a user into the launcher also signs them into C2S Intel served at `govcon.colorcodesolutions.com`. Real SSO, single user store, single identity surface.

**Scope of change in `SpartanIron/C2S-Contract-Intelligence-Platform`:**

- Add `@clerk/clerk-react` (frontend) and `@clerk/clerk-sdk-node` (or `@clerk/express`) (backend).
- Wrap the React app in `<ClerkProvider publishableKey={...}>`.
- Replace existing Express session middleware with Clerk's `requireAuth()` middleware on protected routes.
- Map existing `users` table rows to Clerk user IDs (`user_xxx`). Either: (a) migrate existing accounts via Clerk's User Import API, or (b) accept that existing C2S Intel users re-register through Clerk on first login post-cutover.
- Remove `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` from Railway env. Add `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- Verify all auth-gated API endpoints accept Clerk-issued JWTs.
- Add `https://govcon.colorcodesolutions.com` (and the existing `www.c2sintel.com`, `app.c2sintel.com` if SSO should also apply on the brand domain via satellite-domain config) to Clerk allowed origins.

**Effort estimate:** 2–5 focused engineering days depending on auth complexity. P0 blast radius (production auth change).

**Pros:**
- Delivers the stated goal cleanly.
- Single source of truth for users.
- Aligns with industry best practice for multi-product SaaS.
- Lets future products plug in with zero auth work.
- Centralizes MFA, SSO-with-customer-IdPs (Okta/Azure AD), audit trails — all valuable for federal sales.

**Cons:**
- Real code change in a production app serving real customers.
- Existing C2S Intel users either get migrated or re-onboarded.
- Requires sequencing: clerk-proxy deploy first, then C2S Intel migration, then `govcon` mapping, then launcher flip.

### Path 2 — Federate C2S Intel via OIDC, with Clerk as IdP

C2S Intel keeps its own user database but configures Clerk as an OpenID Connect identity provider. Users click "Sign in with ColorCode" on C2S Intel, get redirected to Clerk, then redirected back to C2S Intel with a token C2S Intel validates and uses to create/link a local user record.

**Pros:**
- Smaller code change in C2S Intel (add OIDC client lib, one new login route).
- Existing C2S Intel users keep working unchanged.

**Cons:**
- Two user stores (Clerk + C2S Intel local DB) that must be kept in sync.
- Not "real" SSO — the user still passes through a redirect on first sign-in per product per device.
- Maintenance burden: every Clerk feature change requires verification on the C2S Intel side.
- Federation drift over time is a well-known anti-pattern in small-team SaaS.

### Path 3 — Accept separate auth, reword the launcher

Do not change C2S Intel's auth. Map `govcon.colorcodesolutions.com` to the Railway service. Edit the launcher copy from "Single sign-on across the ColorCode Solutions platform" to "Your ColorCode Solutions products" or similar. Users sign in twice when they use both products.

**Pros:**
- Zero engineering work on C2S Intel.
- Could be live this week.

**Cons:**
- The SSO promise — which is a sales differentiator — goes away.
- Future federal customers expecting platform-level SSO will be disappointed.
- This is technical debt with a marketing surface.

---

## 4. Recommendation

**Path 1.** Migrating C2S Intel to Clerk is the right answer for the stated goal. It is the only path that delivers true SSO, the only path that matches the launcher's existing copy, and the only path that scales to a third product without compounding auth debt.

The sequencing once approved:

1. Stabilize EnterpriseComply identity by deploying the clerk-proxy Worker (per `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`, gated on Cloudflare dashboard health).
2. Migrate C2S Intel auth to Clerk in a branch on `SpartanIron/C2S-Contract-Intelligence-Platform`. Stage and verify on the Railway preview environment.
3. Cut over: enable Clerk auth on the C2S Intel Railway production service; verify existing user migration; verify Clerk session works on `www.c2sintel.com` (via satellite-domain config) and on `govcon.colorcodesolutions.com` (subdomain inheritance).
4. Map `govcon.colorcodesolutions.com` to the existing `c2s-api-server` Railway service via Railway custom-domain + Cloudflare proxied CNAME (simpler than a Worker proxy; matches the pattern already working for `www.c2sintel.com`).
5. Flip the launcher card from COMING SOON to LIVE.
6. Add health-monitor probe.

---

## 5. Hard constraints carried forward (must not be violated by any path)

- Do NOT touch `c2sintel.com` infrastructure without explicit per-change approval. The C2S Intel app currently serving there has real customers.
- Do NOT chain product cutover with identity migration in the same window. Sequence per Section 4.
- Do NOT deploy when Cloudflare dashboard is degraded (per `docs/runbooks/PRODUCT_CUTOVER.md`).
- Engineer never handles `sk_live_*` secrets directly; account owner pastes into respective service dashboards.

---

## 6. Superseded documents

These prior artifacts assumed C2S Intel was already on Clerk. They are now factually incorrect and should not be followed:

- `artifacts/cloudflare-workers/c2s-intel-proxy/CUTOVER_PLAN.md` (commit `aa8549e`) — assumed Clerk allowed-origin add was sufficient. Superseded.
- `artifacts/cloudflare-workers/c2s-intel-proxy/README.md` (commit `5e1bfa3`) — same assumption. Superseded.
- `artifacts/cloudflare-workers/c2s-intel-proxy/worker.js` (commit `06e4ab8`) — premature; deploy approach should be reconsidered against Path 1's Railway-custom-domain option. Superseded.

When a path is selected and executed, append the post-execution runbook to this document and mark Section 6 entries as "Closed."

---

## 7. Decision

- [x] **Path 1 — Migrate C2S Intel to Clerk.** Stated goal achieved cleanly.
- [ ] Path 2 — Federate via OIDC. Smaller change, ongoing maintenance.
- [ ] Path 3 — Two separate auth systems. Reword launcher copy honestly.

**Decided by:** Account owner (annankwekujude@gmail.com), recorded via chat with platform engineer.
**Date:** 2026-05-18
**Rationale (summary):**
- Federal-customer expectation: platform-level SSO is baseline, not luxury. Two-login experience is a credibility problem at security review.
- Native Clerk features (SAML/Okta/AzureAD, MFA, audit logs, SCIM, RBAC) avoid the build-twice tax across products.
- Migration is bounded (2–5 focused engineering days), reversible at planning stage, and fully stageable on Railway preview before any production cutover.
- Closes the incidentally-bifurcated identity architecture before C2S Intel user base scales further.

**Next deliverable:** `docs/architecture/SSO_MIGRATION_PLAN.md` — engineer-executable work-breakdown for the C2S Intel Clerk migration.

**Sequencing (locked):**
1. clerk-proxy Worker deploy (held until Cloudflare dashboard healthy; see `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md`).
2. C2S Intel Clerk migration on a branch in `SpartanIron/C2S-Contract-Intelligence-Platform`; staged and verified on Railway preview environment.
3. Cut over C2S Intel Railway production service to Clerk-only auth; 1-hour log watch; rollback path defined in migration plan.
4. Map `govcon.colorcodesolutions.com` to the existing `c2s-api-server` Railway service via Railway custom-domain + Cloudflare proxied CNAME (no Worker proxy — simpler than the superseded c2s-intel-proxy approach).
5. Flip launcher card COMING SOON → LIVE; add health-monitor probe.
