/**
 * c2s-intel-proxy
 * ----------------------------------------------------------------------------
 * Cloudflare Worker that forwards govcon.colorcodesolutions.com traffic to
 * the C2S Intel (GovCon) production application hosted on Railway.
 *
 * Purpose:
 *   Provides a stable Cloudflare-fronted origin for the C2S Intel app so the
 *   public hostname stays under our edge control (security headers, WAF,
 *   caching, observability) while the application is hosted on Railway.
 *
 * Required environment binding:
 *   C2S_UPSTREAM_HOST  (plain_text) - the *.up.railway.app hostname of the
 *                                     c2s-intel Railway service, without protocol.
 *                                     Example: c2s-intel-production.up.railway.app
 *
 * Required Worker route (Zone -> Workers Routes):
 *   govcon.colorcodesolutions.com/*  ->  c2s-intel-proxy
 *
 * Security properties:
 *   - No secrets handled at the Worker layer (C2S Intel is client-rendered
 *     and authenticates via Clerk publishable key + same-platform SSO).
 *   - Hop-by-hop headers stripped per RFC 7230 section 6.1.
 *   - Standard security response headers injected at the edge.
 *   - X-Forwarded-* chain preserved for upstream logging.
 *
 * Control mappings:
 *   SOC 2 CC6.1, CC6.6, CC7.2, CC8.1
 *   NIST 800-53 r5: AC-4, AU-3, CM-3, CM-4, SC-7, SC-8, SC-13
 *   FedRAMP Moderate baseline alignment
 * ----------------------------------------------------------------------------
 */

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
      if (!env.C2S_UPSTREAM_HOST) {
        return jsonError(500, "proxy_misconfigured", "C2S_UPSTREAM_HOST binding missing");
      }

      const url = new URL(request.url);
      const upstreamUrl = "https://" + env.C2S_UPSTREAM_HOST + url.pathname + url.search;

      // Build forwarded headers - strip hop-by-hop, preserve forwarding chain.
      const fwdHeaders = new Headers();
      for (const [k, v] of request.headers) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) {
          fwdHeaders.set(k, v);
        }
      }

      const cfClientIp = request.headers.get("cf-connecting-ip");
      if (cfClientIp) {
        const existing = request.headers.get("x-forwarded-for");
        fwdHeaders.set(
          "X-Forwarded-For",
          existing ? existing + ", " + cfClientIp : cfClientIp
        );
        fwdHeaders.set("X-Forwarded-Host", url.hostname);
        fwdHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
      }

      // Stream the body to preserve uploads and avoid memory buffering.
      const init = {
        method: request.method,
        headers: fwdHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual",
      };

      const upstreamResp = await fetch(upstreamUrl, init);

      // Mirror response, strip hop-by-hop, inject edge security headers.
      const respHeaders = new Headers();
      for (const [k, v] of upstreamResp.headers) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) {
          respHeaders.set(k, v);
        }
      }
      injectSecurityHeaders(respHeaders);

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      console.error(JSON.stringify({
        evt: "c2s_intel_proxy_error",
        msg: err && err.message ? err.message : "unknown",
        url: request.url,
        method: request.method,
      }));
      return jsonError(502, "proxy_upstream_error", "Upstream request failed");
    }
  },
};

function injectSecurityHeaders(headers) {
  // Defense-in-depth headers at the edge. HSTS preload deferred until DNS
  // is stable for 30+ days per platform policy.
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}

function jsonError(status, code, detail) {
  return new Response(
    JSON.stringify({ error: code, detail }),
    { status, headers: { "content-type": "application/json" } }
  );
}
