/**
 * Drop-in, SSRF-safe replacement for global `fetch` for outbound calls whose
 * destination is influenced by tenant-supplied configuration.
 *
 * Integration providers build request URLs from per-org connector settings
 * (`config.baseUrl`, `config.apiHostname`, `config.vaultAddr`, `config.tenantUrl`,
 * ...). Calling the global `fetch` with those values lets any tenant admin aim
 * the server at internal-only addresses - cloud instance metadata
 * (169.254.169.254), the loopback API itself, or RFC1918 hosts - and read the
 * response back through the integration UI. That is OWASP A10:2021 (SSRF), and
 * on a cloud host it is a direct path to stealing instance credentials.
 *
 * `guardedFetch` closes that by:
 *   1. requiring HTTPS,
 *   2. resolving the hostname and rejecting private / loopback / link-local /
 *      metadata / reserved addresses,
 *   3. connecting to the *already resolved* IP while presenting the original
 *      hostname for TLS SNI and the Host header, which removes the DNS-rebinding
 *      (TOCTOU) window between validation and connection,
 *   4. never following redirects, so a 302 to an internal address cannot be used
 *      as a bypass,
 *   5. enforcing a hard timeout.
 *
 * The returned object is shape-compatible with the subset of `Response` the
 * providers use (`ok`, `status`, `statusText`, `json()`, `text()`), so providers
 * adopt it with a single aliased import and no other change.
 */
import {
  pinnedHttpsRequest,
  validateAndResolvePublicHttpsUrl,
  type PinnedResponse,
} from "./ssrf-guard.js";

const DEFAULT_TIMEOUT_MS = 15_000;

function toHeaderRecord(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;

  // Headers instance
  if (
    typeof (headers as Headers).forEach === "function" &&
    typeof (headers as Headers).get === "function"
  ) {
    (headers as Headers).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  // [[key, value], ...]
  if (Array.isArray(headers)) {
    for (const pair of headers as unknown[][]) {
      if (Array.isArray(pair) && pair.length >= 2) out[String(pair[0])] = String(pair[1]);
    }
    return out;
  }

  // plain object
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value !== undefined && value !== null) out[key] = String(value);
  }
  return out;
}

function toBodyString(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  // URLSearchParams and anything else with a meaningful toString()
  if (typeof (body as { toString?: unknown }).toString === "function") {
    const serialised = String(body);
    return serialised === "[object Object]" ? JSON.stringify(body) : serialised;
  }
  return undefined;
}

export type GuardedFetchInit = RequestInit & { timeoutMs?: number };

export async function guardedFetch(
  input: string | URL,
  init: GuardedFetchInit = {},
): Promise<PinnedResponse> {
  const rawUrl = typeof input === "string" ? input : String(input);
  const { url, resolvedIP } = await validateAndResolvePublicHttpsUrl(
    rawUrl,
    "integration endpoint",
  );

  return pinnedHttpsRequest(url.toString(), resolvedIP ?? url.hostname, {
    method: typeof init.method === "string" ? init.method : "GET",
    headers: toHeaderRecord(init.headers),
    body: toBodyString(init.body),
    timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

export default guardedFetch;
