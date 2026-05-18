# C2S Intel — Clerk Migration Plan (Path 1)

> **Status.** Approved per `docs/architecture/SSO_DECISION.md` Section 7 (commit `4b4d0cf`).
> **Target repo.** `SpartanIron/C2S-Contract-Intelligence-Platform` (branch `main`).
> **Target Railway service.** `c2s-api-server` (project `c2s-intel-platform`, service ID `a1b02044-90f5-4403-b63f-f27318bae3b9`).
> **Effort estimate.** 2–5 focused engineering days.
> **Blast radius.** P0 — production auth change. Stage on Railway preview before production cutover.

---

## 0. Pre-flight gates (all must pass before opening a migration PR)

| Gate | Pass criterion | Verification |
|------|----------------|--------------|
| clerk-proxy Worker deployed and verified | `curl https://colorcodesolutions.com/__clerk/v1/environment` returns 200 JSON | Per `artifacts/cloudflare-workers/clerk-proxy/DEPLOY_CHECKLIST.md` Section 4. |
| Clerk dashboard healthy | dashboard.clerk.com loads in < 3 seconds; API Keys panel reachable | Manual visual check. |
| Railway preview environment exists for c2s-api-server | Service Settings → Environments shows a non-production env, or a feature-branch deploy is producing PR previews | Railway UI. |
| Account owner can paste `sk_live_*` into Railway env | Owner has Clerk dashboard access and Railway env-var write | Owner self-attests. |
| Existing C2S Intel user count is known | SELECT COUNT(*) FROM users in production DB | Engineer query; informs migration strategy choice (5a vs 5b). |

---

## 1. Repo audit — what currently does auth

Before writing a line of new code, the engineer must produce a single PR (or doc) that inventories every place auth currently happens in `C2S-Contract-Intelligence-Platform`. Expected surfaces (based on `.env.example`):

- **Session middleware.** Likely `express-session` + a connect-pg-simple or similar store, signed with `SESSION_SECRET`. Find all `req.session` reads/writes.
- **Login routes.** Probably `/api/auth/google` (start) and `/api/auth/google/callback` (finish) using `passport` + `passport-google-oauth20`, or hand-rolled equivalents. Find all redirects to/from Google OAuth.
- **Auth-gated routes.** Every route that currently checks `req.session.user` or `req.user`. Express middleware like `requireAuth` / `isAuthenticated`.
- **Frontend auth state.** React contexts, hooks (`useAuth`, `useUser`), and any `fetch` calls that depend on session cookies being sent.
- **Logout.** Every place that calls `req.session.destroy()` or clears cookies.
- **User schema.** The `users` table. Columns to identify: `id`, `email`, `google_id`, `created_at`, anything tying users to other tables (`user_id` foreign keys).

**Deliverable from this step:** `AUTH_INVENTORY.md` in the C2S Intel repo listing every file, route, and DB column touched. This is the change surface.

---

## 2. Clerk dashboard prep (account owner)

These are owner-only because they involve Clerk credentials. The engineer cannot do these and should not see the secret key.

1. In Clerk dashboard → Configure → API Keys, confirm the production publishable key is `pk_live_Y2xlcmsuY29sb3Jjb2Rlc29sdXRpb25zLmNvbSQ` (same as EnterpriseComply — single instance, single key).
2. Copy the `sk_live_*` production secret key. **Owner only — never share.**
3. In Clerk dashboard → Domains, add allowed origins for C2S Intel:
   - `https://govcon.colorcodesolutions.com` (future destination)
   - `https://c2s-api-server-production.up.railway.app` (Railway direct, for testing)
   - Any PR-preview Railway URL pattern (`*.up.railway.app` if Clerk supports wildcards, otherwise add specific preview hostnames as they appear).
4. If `www.c2sintel.com` should ALSO use the same Clerk identity (so users on the brand domain inherit SSO too), enable Clerk **Satellite Domains** and add `www.c2sintel.com` + `app.c2sintel.com`. This is optional and architecturally separate from the platform-subdomain SSO.

---

## 3. Backend code changes (in C2S Intel repo)

### 3a. Dependencies

Add to `package.json`:

```bash
pnpm add @clerk/express @clerk/backend
```

Remove (after migration verified):

```bash
pnpm remove express-session passport passport-google-oauth20 connect-pg-simple
```

Do NOT remove these until Section 6 verification passes.

### 3b. Env vars

Add to Railway (production and any preview environments):

```
CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuY29sb3Jjb2Rlc29sdXRpb25zLmNvbSQ
CLERK_SECRET_KEY=<owner pastes sk_live_*>
```

Update `.env.example` in the repo to reflect the new variables and mark `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` as DEPRECATED with a removal date.

### 3c. Express integration

Replace existing session middleware with Clerk's:

```ts
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';

app.use(clerkMiddleware());

// On protected routes:
app.get('/api/me', requireAuth(), (req, res) => {
  const { userId, sessionId } = getAuth(req);
  // userId is Clerk's user_xxx identifier.
  res.json({ userId, sessionId });
});
```

### 3d. User identity mapping

The C2S Intel `users` table currently keys on its own internal user ID (probably linked to `google_id`). After Clerk migration, the canonical user identifier is Clerk's `user_xxx`.

**Schema change:** Add a column `clerk_user_id TEXT UNIQUE` to the `users` table. Backfill per Section 5.

**Lookup pattern:** Every code path that reads `req.session.user.id` (internal ID) becomes:

```ts
const { userId: clerkUserId } = getAuth(req);
const user = await db.users.findUnique({ where: { clerk_user_id: clerkUserId } });
```

Or, simpler in the long run, switch every `user_id` foreign key in the rest of the schema to store Clerk's `user_xxx` directly. This is more invasive but eliminates the dual-ID problem permanently. Engineer to recommend based on the foreign-key audit in Step 1.

### 3e. Remove Google OAuth handler routes

`/api/auth/google` and `/api/auth/google/callback` are no longer needed. Clerk handles the entire Google OAuth flow when you enable Google as a social connection in the Clerk dashboard (which it already is, given EnterpriseComply works with Google sign-in).

Update redirects from those routes to point to Clerk's `<SignIn>` page instead.

---

## 4. Frontend code changes (in C2S Intel repo)

### 4a. Dependencies

```bash
pnpm add @clerk/clerk-react
```

### 4b. Wrap the app

In the main entry (likely `src/main.tsx` or `src/App.tsx`):

```tsx
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

<ClerkProvider
  publishableKey={PUBLISHABLE_KEY}
  // Use the proxied Clerk frontend API for ad-blocker/network-policy resilience.
  // This makes Clerk's JS load from colorcodesolutions.com/__clerk/* instead of clerk.dev directly.
  proxyUrl="https://colorcodesolutions.com/__clerk"
>
  <App />
</ClerkProvider>
```

Add `VITE_CLERK_PUBLISHABLE_KEY` to Railway env (build-time, so it's baked into the Vite bundle).

### 4c. Replace auth UI

Wherever the current login button lives, replace with Clerk components:

```tsx
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

<SignedOut>
  <SignInButton mode="modal" />
</SignedOut>
<SignedIn>
  <UserButton afterSignOutUrl="/" />
</SignedIn>
```

### 4d. Replace auth state hooks

Anywhere the code reads from a custom `useAuth()` or React context, switch to:

```tsx
import { useUser, useAuth } from '@clerk/clerk-react';

const { user, isLoaded, isSignedIn } = useUser();
const { getToken } = useAuth();
```

### 4e. API call authentication

Replace any cookie-based fetch calls with Clerk token attachment:

```tsx
const token = await getToken();
fetch('/api/something', { headers: { Authorization: `Bearer ${token}` } });
```

The backend `clerkMiddleware()` will verify the Bearer token automatically.

---

## 5. User migration strategy

Two options. Engineer + owner pick one based on existing user count and customer impact tolerance.

### 5a. Migrate existing users via Clerk Import API (zero re-onboarding)

Use Clerk's [User Import](https://clerk.com/docs/users/users-import) endpoint to bulk-create Clerk users from the existing `users` table. Each existing user becomes a Clerk user with the same email and `google_id` linked. On first login after cutover, the user signs in with Google as usual and lands in their existing account.

**Steps:**
1. Export existing users: `SELECT id, email, google_id, created_at FROM users WHERE active = true`.
2. Format as Clerk import JSON.
3. POST to `https://api.clerk.com/v1/users` with `Authorization: Bearer sk_live_*` (owner runs this; engineer prepares the payload).
4. For each import response, record the new `user_xxx` against the original user row: `UPDATE users SET clerk_user_id = $1 WHERE id = $2`.
5. Verify: count rows in `users` where `clerk_user_id IS NOT NULL` matches count of active users.

**Pros:** Zero customer-facing disruption. Users don't know anything changed.
**Cons:** Slightly more setup work. Need to handle email-already-exists conflicts (rare; Clerk de-duplicates by email).

### 5b. Re-onboard users at first login (clean slate)

Cut over with an empty Clerk user store. On first login post-cutover, each existing C2S Intel user signs in with Google through Clerk, gets a new `user_xxx`. A migration handler on the backend matches by email to the existing local user record and writes the `clerk_user_id`.

**Steps:**
1. Cut over (Section 6) with no pre-migration.
2. On first authenticated request from each user, server checks if `clerk_user_id` is set on the matching email row. If not, set it.

**Pros:** Simpler, no Clerk Import API setup, no upfront batch operation.
**Cons:** Edge cases (user whose email changed, user with no `google_id` because they used a password-only legacy account) need explicit handling.

**Recommendation:** 5a for any user base above ~50 users. 5b for very small user bases where the re-onboarding edge cases can be handled manually.

---

## 6. Cutover sequence (production)

**Pre-cutover:** All Section 3, 4, 5 work merged to `main` on the C2S Intel repo. Railway preview deploy has been verified end-to-end: sign-in via Clerk works, protected routes work, user data is correctly linked to Clerk IDs, the launcher cookie is recognized (test by signing into `app.colorcodesolutions.com` then visiting the preview URL — should appear signed-in).

**Cutover steps (production, with both the engineer and account owner online):**

1. Announce a 30-minute maintenance window. Pin a status update on the launcher.
2. Owner pastes `CLERK_SECRET_KEY` (sk_live_*) into Railway production env for `c2s-api-server`.
3. Owner sets `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in Railway production env.
4. Engineer triggers a Railway production deploy from latest `main`.
5. Wait for green deploy status.
6. Smoke test:
   - Hit `https://c2s-api-server-production.up.railway.app` → loads.
   - Sign in via Google through Clerk → success.
   - Existing user lands in their data (Section 5a migration verified) OR new `clerk_user_id` written on first login (Section 5b).
   - Sign out → session ends.
   - Re-sign-in → session restored.
7. Watch Railway logs for 60 minutes. Any 401/403 spikes or stack traces with `session` or `passport` references → rollback (Section 7).

---

## 7. Rollback plan

The migration PR must NOT delete the old `express-session` / `passport` code in the same commit as enabling Clerk. Use a feature flag:

```ts
const USE_CLERK = process.env.AUTH_PROVIDER === 'clerk';
if (USE_CLERK) {
  app.use(clerkMiddleware());
  app.use(requireAuthForProtectedRoutes());
} else {
  app.use(session({ secret: process.env.SESSION_SECRET, ... }));
  app.use(passportMiddleware());
}
```

**Rollback procedure if Section 6 step 7 detects failure:**

1. In Railway env, set `AUTH_PROVIDER=legacy` (or unset it; default to legacy).
2. Redeploy.
3. Service returns to session+passport auth. Existing users continue as if nothing happened.
4. Open incident note, diagnose, fix on a branch, retry cutover.

**The legacy code path stays in the repo for 30 days post-cutover.** After 30 days of clean Clerk operation, a separate PR removes it.

---

## 8. Post-cutover platform tasks (NOT in the C2S Intel repo)

These happen in the EnterpriseComply repo / Cloudflare / launcher after the C2S Intel cutover is stable for 24 hours:

### 8a. Map govcon.colorcodesolutions.com to the C2S Intel Railway service

1. In Railway → c2s-api-server → Settings → Networking → Custom Domains: click "Add Custom Domain", enter `govcon.colorcodesolutions.com`. Railway provides a CNAME target.
2. In Cloudflare → colorcodesolutions.com → DNS: create CNAME `govcon` → `<railway-cname-target>`, proxied (orange cloud).
3. Wait for Railway to verify (usually < 60 seconds).
4. Verify: `curl -I https://govcon.colorcodesolutions.com` returns 200 with C2S Intel content.
5. **Remove** the existing `govcon.colorcodesolutions.com/*` Worker route for `govcon-placeholder` (no longer needed).

### 8b. Flip the launcher card COMING SOON → LIVE

The app-launcher Worker source is not in the EnterpriseComply repo. Engineer must either locate the launcher source repo OR edit the Worker directly in the Cloudflare dashboard (with the same change-management discipline as the clerk-proxy deploy — only when Cloudflare dashboard is healthy).

The change: in the C2S Intel card, replace `COMING SOON` badge with `LIVE` badge.

### 8c. Health-monitor probe

Add to the `health-monitor` Worker: probe `https://govcon.colorcodesolutions.com/api/health` (or whatever the C2S Intel health endpoint is) every 60 seconds. Alert on > 2 consecutive failures.

### 8d. Retire superseded artifacts

Per `SSO_DECISION.md` Section 6, the following are now obsolete:

- `artifacts/cloudflare-workers/c2s-intel-proxy/CUTOVER_PLAN.md` (commit `aa8549e`)
- `artifacts/cloudflare-workers/c2s-intel-proxy/README.md` (commit `5e1bfa3`)
- `artifacts/cloudflare-workers/c2s-intel-proxy/worker.js` (commit `06e4ab8`)

Create a single PR that adds a `SUPERSEDED.md` in that directory pointing here, OR removes the directory entirely. Engineer's choice; either is acceptable.

The `artifacts/c2s-ciop/` directory in the EnterpriseComply monorepo is also a stale duplicate of the C2S Intel codebase (canonical lives in `SpartanIron/C2S-Contract-Intelligence-Platform`). Same treatment.

---

## 9. Verification checklist (must all be true before declaring SSO live)

- [ ] User signs in once on `https://app.colorcodesolutions.com`.
- [ ] Clicking the EnterpriseComply tile lands at `https://grc.colorcodesolutions.com` already authenticated — no second login.
- [ ] Clicking the C2S Intel tile lands at `https://govcon.colorcodesolutions.com` already authenticated — no second login.
- [ ] Signing out on the launcher signs the user out of both products.
- [ ] Browser DevTools → Application → Cookies on `app.colorcodesolutions.com` shows a Clerk session cookie scoped to `.colorcodesolutions.com`.
- [ ] Both products call Clerk's frontend API via `colorcodesolutions.com/__clerk/*` (verified in Network panel), not directly to `clerk.dev`.
- [ ] Clerk dashboard → Users shows ONE record per real user across both products.
- [ ] `www.c2sintel.com` continues to work for its existing customer base (either with separate auth if Clerk Satellite Domain was NOT enabled, OR with SSO if it was).
- [ ] Health-monitor reports both product subdomains as healthy.
- [ ] Launcher copy "Single sign-on across the ColorCode Solutions platform" is now literally true.

---

## 10. Hard constraints (must not violate)

- Account owner pastes all `sk_live_*` secrets directly into Railway / Clerk dashboards. Engineer never sees them.
- Migration PR uses a feature flag (`AUTH_PROVIDER`) so rollback is one env-var change, not a code revert.
- Cutover happens in a maintenance window, not during peak hours.
- Cloudflare dashboard must be healthy (GCR ≥ 80/100) before any Worker route changes in Section 8.
- Do NOT touch `c2sintel.com` DNS or Railway bindings without explicit per-change approval. The brand domain is a separate change surface.
- Do NOT enable Clerk Satellite Domains for `c2sintel.com` until the platform SSO is verified stable on `*.colorcodesolutions.com` for 7+ days.

---

## 11. Owner / approver

- **Engineer executing:** any platform engineer with write access to `SpartanIron/C2S-Contract-Intelligence-Platform` and the C2S Intel Railway service.
- **Approver for Section 6 (production cutover):** account owner (annankwekujude@gmail.com).
- **Secret handler (sk_live_*, Clerk Import API calls):** account owner only.
- **Incident contact:** ops@colorcodesolutions.com.
