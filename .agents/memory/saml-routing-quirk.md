---
name: SAML routing quirk — BetterAuth wildcard conflict
description: BetterAuth's AuthController intercepts all /api/auth/* routes; SAML endpoints must use a different prefix.
---

## Rule
SAML / SSO auth-flow routes must be registered under `/api/saml/` (not `/api/auth/saml/`).

**Why:** `AuthController` uses `@All("*path")` to forward every `/api/auth/**` request to BetterAuth. Even more-specific NestJS routes in a different controller lose to this wildcard when the wildcard module is loaded first. Routes under `/api/saml/` avoid the conflict entirely.

**How to apply:** Any new public-facing auth-flow endpoints (OAuth callback, SAML, passkeys, etc.) that must NOT go through BetterAuth should use a controller prefix that doesn't start with `auth/`.
