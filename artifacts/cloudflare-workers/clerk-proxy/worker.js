/**
 * clerk-proxy
 * ----------------------------------------------------------------------------
 * Cloudflare Worker that proxies Clerk Frontend API (FAPI) requests from the
 * primary apex domain so the browser sees a same-origin auth surface.
 *
 * Contract reference:
 *   https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi
 *
 * Required environment bindings (Worker -> Settings -> Variables):
 *   CLERK_SECRET_KEY  (secret_text) - production sk_live_* from Clerk dashboard
 *
 * Required Worker routes (Zone -> Workers Routes):
 *   colorcodesolutions.com/__clerk/*  ->  clerk-proxy
 *
 * Required Clerk configuration:
 *   Frontend API URL (proxy):  https://colorcodesolutions.com/__clerk
 *
 * Control mappings:
 *   SOC 2 CC6.1, CC6.6, CC7.2, CC8.1
 *   NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13
 *   FedRAMP Moderate baseline alignment
 *
 * SECURITY NOTES:
 *   - CLERK_SECRET_KEY is injected server-side ONLY; never echoed in responses.
 *   - CORS allowlist is explicit; no wildcard is ever returned with credentials.
 *   - Hop-by-hop headers are stripped per RFC 7230 section 6.1.
 *   - Request body is streamed (not buffered) to preserve large uploads.
 * ----------------------------------------------------------------------------
 */

const CLERK_FAPI_UPSTREAM = "https://frontend-api.clerk.dev";
const PROXY_PATH_PREFIX   = "/__clerk";
const PROXY_PUBLIC_URL    = "https://colorcodesolutions.com/__clerk";

// Explicit allowlist. Wildcard with credentials is forbidden.
const ALLOWED_ORIGINS = new Set([
  "https://colorcodesolutions.com",
  "https://www.colorcodesolutions.com",
  "https://app.colorcodesolutions.com",
  "https://accounts.colorcodesolutions.com",
  "https://grc.colorcodesolutions.com",
  "https://govcon.colorcodesolutions.com",
]);

// RFC 7230 section 6.1 hop-by-hop headers - must not be forwarded.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // Defense-in-depth: route should only match /__clerk/*, but verify.
      if (!url.pathname.startsWith(PROXY_PATH_PREFIX + "/") &&
          url.pathname !== PROXY_PATH_PREFIX) {
        return new Response("Not Found", { status: 404 });
      }

      // CORS preflight - handle locally, do not forward.
      if (request.method === "OPTIONS") {
        return handlePreflight(request);
      }

      // Required server-side secret.
      if (!env.CLERK_SECRET_KEY) {
        return jsonError(500, "proxy_misconfigured", "CLERK_SECRET_KEY binding missing");
      }

      // Build upstream URL: strip /__clerk prefix, preserve subpath + query.
      const upstreamPath = url.pathname.slice(PROXY_PATH_PREFIX.length) || "/";
      const upstreamUrl  = CLERK_FAPI_UPSTREAM + upstreamPath + url.search;

      // Build forwarded headers (strip hop-by-hop, inject Clerk contract headers).
      const fwdHeaders = new Headers();
      for (const [k, v] of request.headers) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) {
          fwdHeaders.set(k, v);
        }
      }

      // Clerk proxy contract - three required headers:
      fwdHeaders.set("Clerk-Proxy-Url", PROXY_PUBLIC_URL);
      fwdHeaders.set("Clerk-Secret-Key", env.CLERK_SECRET_KEY);

      const cfClientIp = request.headers.get("cf-connecting-ip");
      if (cfClientIp) {
        // Preserve any existing X-Forwarded-For chain.
        const existing = request.headers.get("x-forwarded-for");
        fwdHeaders.set(
          "X-Forwarded-For",
          existing ? existing + ", " + cfClientIp : cfClientIp
        );
      }

      // Stream the body (preserves large uploads, does not buffer in memory).
      const init = {
        method: request.method,
        headers: fwdHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual",
      };

      const upstreamResp = await fetch(upstreamUrl, init);

      // Mirror response, strip hop-by-hop, attach CORS.
      const respHeaders = new Headers();
      for (const [k, v] of upstreamResp.headers) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) {
          respHeaders.set(k, v);
        }
      }
      applyCors(request, respHeaders);

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      // Structured error log - never echo secrets.
      console.error(JSON.stringify({
        evt: "clerk_proxy_error",
        msg: err && err.message ? err.message : "unknown",
        url: request.url,
        method: request.method,
      }));
      return jsonError(502, "proxy_upstream_error", "Upstream request failed");
    }
  },
};

function handlePreflight(request) {
  const headers = new Headers();
  applyCors(request, headers);
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Requested-With, Clerk-Frontend-Api, Clerk-Publishable-Key"
  );
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

function applyCors(request, headers) {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
  }
}

function jsonError(status, code, detail) {
  return new Response(
    JSON.stringify({ error: code, detail }),
    { status, headers: { "content-type": "application/json" } }
  );
}
