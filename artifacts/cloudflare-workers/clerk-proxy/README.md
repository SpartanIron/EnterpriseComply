# clerk-proxy Cloudflare Worker

Proxies Clerk Frontend API (FAPI) requests through the apex domain so the
browser sees a same-origin authentication surface.

## Route contract

| Concern        | Value |
|----------------|-------|
| Worker name    | clerk-proxy |
| Public URL     | https://colorcodesolutions.com/__clerk/* |
| Upstream       | https://frontend-api.clerk.dev |
| Cloudflare account | 87b2c292a36f48eab8198745bf5fa3d2 |
| Zone               | colorcodesolutions.com (bb77bbfe119edc2a64334d2e657a25c9) |

## Required Worker bindings

| Name              | Type        | Source |
|-------------------|-------------|--------|
| CLERK_SECRET_KEY  | secret_text | Clerk dashboard -> API keys -> production sk_live_* |

## Required Worker route

```
colorcodesolutions.com/__clerk/*  ->  clerk-proxy
```

## Required Clerk configuration

Clerk dashboard -> Domains -> Frontend API -> Use proxy:

```
https://colorcodesolutions.com/__clerk
```

## Deployment procedure (next session, when dashboard is healthy)

1. Pre-change validation:
   - Verify https://accounts.colorcodesolutions.com loads (Clerk hosted, not proxy).
   - Verify CLERK_SECRET_KEY binding is present (Cloudflare API check).
   - Verify Worker route colorcodesolutions.com/__clerk/* is active.
2. Deploy the Worker source from this directory.
3. Validate: curl https://colorcodesolutions.com/__clerk/v1/environment
   - Expect: 200 JSON describing the Clerk environment.
   - 525 means upstream hostname is wrong - DO NOT proceed.
   - 401 means Clerk-Secret-Key was not forwarded - DO NOT proceed.
4. Only after a successful 200, enable proxy mode in Clerk dashboard.
5. Watch Worker logs and Clerk sign-in success rate for 15 minutes.

## Rollback procedure

1. Revert the Worker to deployment 3ba3482d-4fc3-4ca4-adf8-54c65126bcc6
   (the version active on 2026-05-18 before this change).
2. Clear the proxy URL in Clerk dashboard -> Domains -> Frontend API.
3. Confirm sign-in flow restores via accounts.colorcodesolutions.com.

## Control mappings

- SOC 2: CC6.1 (logical access), CC6.6 (transmission), CC7.2 (monitoring),
  CC8.1 (change management).
- NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13.
- FedRAMP Moderate baseline alignment.

## Security properties

- CLERK_SECRET_KEY is injected server-side only; never present in any browser
  request and never echoed in error responses.
- CORS allowlist is explicit; the wildcard origin is never returned alongside
  credentialed responses.
- Hop-by-hop headers stripped per RFC 7230 section 6.1.
- Request body is streamed (Worker does not buffer large uploads in memory).
- Structured JSON error logging without secret material.
