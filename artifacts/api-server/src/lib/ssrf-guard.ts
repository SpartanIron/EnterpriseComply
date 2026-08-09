/**
 * SSRF guard — validates that an outbound URL targets a public, HTTPS host,
 * and provides a pinned HTTPS client that connects to the DNS-resolved address
 * so there is no TOCTOU gap between validation and the actual outbound request.
 *
 * Blocks:
 *  - Non-HTTPS schemes (http, file, ftp, …)
 *  - Loopback:       127.0.0.0/8, ::1, ::ffff:127.x (IPv4-mapped/compatible)
 *  - Link-local:     169.254.0.0/16, fe80::/10
 *  - Private:        10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7
 *  - AWS metadata:   169.254.169.254
 *  - All reserved/bogon ranges (0.0.0.0/8, 240.0.0.0/4, …)
 *  - IPv4-mapped/compatible IPv6 that embed a blocked v4 address
 *  - DNS-resolved addresses (mitigates DNS rebinding via CNAME/TTL tricks)
 */

import dns from "dns";
import https from "https";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

// ── IPv4 helpers ──────────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function cidrContainsV4(cidr: string, ip: string): boolean {
  const [base, bits] = cidr.split("/");
  const prefixLen = parseInt(bits!, 10);
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  try {
    return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base!) & mask);
  } catch {
    return false;
  }
}

const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",          // "This" network
  "10.0.0.0/8",         // Private class A
  "100.64.0.0/10",      // Carrier-grade NAT
  "127.0.0.0/8",        // Loopback
  "169.254.0.0/16",     // Link-local / AWS metadata
  "172.16.0.0/12",      // Private class B
  "192.0.0.0/24",       // IETF Protocol Assignments
  "192.168.0.0/16",     // Private class C
  "198.18.0.0/15",      // Benchmarking
  "198.51.100.0/24",    // TEST-NET-2
  "203.0.113.0/24",     // TEST-NET-3
  "224.0.0.0/4",        // Multicast
  "240.0.0.0/4",        // Reserved
  "255.255.255.255/32", // Broadcast
];

export function isBlockedIPv4(ip: string): boolean {
  return BLOCKED_IPV4_CIDRS.some((cidr) => cidrContainsV4(cidr, ip));
}

// ── IPv6 helpers ──────────────────────────────────────────────────────────────
// Parse the address into 16 bytes to do proper prefix comparisons.

function parseIPv6(raw: string): Uint8Array | null {
  const s = raw.replace(/^\[/, "").replace(/\]$/, "").toLowerCase().trim();
  const halves = s.split("::");
  if (halves.length > 2) return null;

  function groupsOf(part: string): number[] | null {
    if (!part) return [];
    const chunks = part.split(":");
    const last = chunks[chunks.length - 1]!;
    if (last.includes(".")) {
      const v4parts = last.split(".").map(Number);
      if (v4parts.length !== 4 || v4parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
      const g1 = (v4parts[0]! << 8) | v4parts[1]!;
      const g2 = (v4parts[2]! << 8) | v4parts[3]!;
      const prefix = chunks.slice(0, -1).map((h) => parseInt(h, 16));
      if (prefix.some(isNaN)) return null;
      return [...prefix, g1, g2];
    }
    const nums = chunks.map((h) => parseInt(h, 16));
    if (nums.some(isNaN)) return null;
    return nums;
  }

  let groups: number[];
  if (halves.length === 1) {
    const g = groupsOf(halves[0]!);
    if (!g || g.length !== 8) return null;
    groups = g;
  } else {
    const left = groupsOf(halves[0]!);
    const right = groupsOf(halves[1]!);
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array(missing).fill(0), ...right];
  }

  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2]     = (groups[i]! >> 8) & 0xff;
    bytes[i * 2 + 1] = groups[i]! & 0xff;
  }
  return bytes;
}

function ipv6HasPrefix(bytes: Uint8Array, prefix: number[], prefixBits: number): boolean {
  const fullBytes = Math.floor(prefixBits / 8);
  const rem = prefixBits % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  if (rem > 0) {
    const mask = 0xff & (0xff << (8 - rem));
    if ((bytes[fullBytes]! & mask) !== (prefix[fullBytes]! & mask)) return false;
  }
  return true;
}

/**
 * Extract the embedded IPv4 address from an IPv4-mapped (::ffff:x/96) or
 * IPv4-compatible (::/96) IPv6 address, or null if not applicable.
 */
function embeddedIPv4(bytes: Uint8Array): string | null {
  // IPv4-mapped: ::ffff:0:0/96 — bytes[0..9]=0x00, bytes[10..11]=0xff 0xff
  const isMapped =
    bytes.slice(0, 10).every((b) => b === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  // IPv4-compatible (deprecated RFC 4291 §2.5.5.1) — first 12 bytes all zero
  const isCompat = bytes.slice(0, 12).every((b) => b === 0);
  if (isMapped || isCompat) {
    return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
  }
  return null;
}

export function isBlockedIPv6(raw: string): boolean {
  const bytes = parseIPv6(raw);
  if (!bytes) return true; // Can't parse → treat as unsafe

  // Loopback ::1
  if (bytes.every((b, i) => (i < 15 ? b === 0 : b === 1))) return true;
  // Unspecified ::
  if (bytes.every((b) => b === 0)) return true;
  // IPv4-mapped / IPv4-compatible — check embedded v4 address
  const v4 = embeddedIPv4(bytes);
  if (v4 !== null) return isBlockedIPv4(v4);
  // Link-local fe80::/10
  if (ipv6HasPrefix(bytes, [0xfe, 0x80], 10)) return true;
  // Unique local fc00::/7
  if (ipv6HasPrefix(bytes, [0xfc], 7)) return true;
  // Multicast ff00::/8
  if (ipv6HasPrefix(bytes, [0xff], 8)) return true;
  return false;
}

function isIPAddress(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.startsWith("[") || /^[0-9a-fA-F:]+$/.test(host)) return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

export interface ValidatedEndpoint {
  /** Parsed, validated URL */
  url: URL;
  /**
   * The IP address we resolved and validated. Use this — not a fresh DNS
   * lookup — when making the actual outbound connection to close the TOCTOU
   * gap between validation and request.
   *
   * null for literal-IP URLs (the hostname IS the IP).
   */
  resolvedIP: string;
}

/**
 * Validate `rawUrl`, resolve its hostname to an IP, check that IP against the
 * block list, and return both the parsed URL and the pinned resolved IP.
 *
 * Throws `SsrfBlockedError` for any blocked target.
 *
 * The caller MUST use `resolvedIP` (not a fresh DNS lookup) when making the
 * actual outbound connection. See `pinnedHttpsRequest`.
 */
export async function validateAndResolvePublicHttpsUrl(
  rawUrl: string,
  label = "url",
): Promise<ValidatedEndpoint> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(`${label} is not a valid URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new SsrfBlockedError(
      `${label} must use HTTPS (got: ${parsed.protocol.replace(":", "")})`,
    );
  }

  const host = parsed.hostname;
  if (!host) throw new SsrfBlockedError(`${label} has no hostname`);

  // Literal IP — check immediately; resolvedIP = the literal IP itself.
  if (isIPAddress(host)) {
    const bare = host.replace(/^\[/, "").replace(/\]$/, "");
    if (bare.includes(":")) {
      if (isBlockedIPv6(bare)) {
        throw new SsrfBlockedError(
          `${label} uses a reserved/private IPv6 address (${host})`,
        );
      }
    } else {
      if (isBlockedIPv4(bare)) {
        throw new SsrfBlockedError(
          `${label} uses a reserved/private IPv4 address (${host})`,
        );
      }
    }
    return { url: parsed, resolvedIP: bare };
  }

  // Reject known internal hostnames before DNS
  const lowerHost = host.toLowerCase();
  if (
    ["localhost", "metadata.google.internal", "metadata", "169.254.169.254"].includes(lowerHost) ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".internal")
  ) {
    throw new SsrfBlockedError(`${label} hostname "${host}" is not a public host`);
  }

  // DNS resolution — capture the address for use in the actual connection
  let resolvedIP: string;
  try {
    const result = await dnsLookup(host, { verbatim: false });
    resolvedIP = result.address;
  } catch (e) {
    throw new SsrfBlockedError(
      `${label} hostname "${host}" could not be resolved: ${String(e)}`,
    );
  }

  if (resolvedIP.includes(":")) {
    if (isBlockedIPv6(resolvedIP)) {
      throw new SsrfBlockedError(
        `${label} hostname "${host}" resolves to a private/reserved IPv6 address (${resolvedIP})`,
      );
    }
  } else {
    if (isBlockedIPv4(resolvedIP)) {
      throw new SsrfBlockedError(
        `${label} hostname "${host}" resolves to a private/reserved IPv4 address (${resolvedIP})`,
      );
    }
  }

  return { url: parsed, resolvedIP };
}

/**
 * Backward-compat wrapper — returns just the parsed URL.
 * Prefer `validateAndResolvePublicHttpsUrl` when you also need the resolved IP.
 */
export async function validatePublicHttpsUrl(rawUrl: string, label = "url"): Promise<URL> {
  const { url } = await validateAndResolvePublicHttpsUrl(rawUrl, label);
  return url;
}

// ── Pinned HTTPS client ───────────────────────────────────────────────────────

export interface PinnedResponse {
  status: number;
  statusText: string;
  ok: boolean;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/**
 * Make an HTTPS request to `resolvedIP` while presenting `originalHostname`
 * for TLS SNI and the Host header.  This closes the TOCTOU gap: validation
 * and connection use the same IP address.
 *
 * `rejectUnauthorized: true` is always set — TLS certificates are verified
 * against `originalHostname`, not the raw IP.
 */
export function pinnedHttpsRequest(
  originalUrl: string,
  resolvedIP: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<PinnedResponse> {
  const parsed = new URL(originalUrl);
  const port = parsed.port ? parseInt(parsed.port, 10) : 443;
  const hostname = parsed.hostname;
  const timeoutMs = init.timeoutMs ?? 10_000;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => req.destroy(new Error(`Request to ${hostname} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    const req = https.request(
      {
        host: resolvedIP,       // Connect to the validated IP — no re-resolution
        port,
        path: parsed.pathname + parsed.search,
        method: init.method ?? "GET",
        headers: {
          Host: hostname,       // HTTP/1.1 Host header → original hostname
          ...init.headers,
        },
        servername: hostname,   // TLS SNI → original hostname (cert verification)
        rejectUnauthorized: true,
      },
      (res) => {
        clearTimeout(timer);
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          resolve({
            status,
            statusText: res.statusMessage ?? "",
            ok: status >= 200 && status < 300,
            json: async () => JSON.parse(body),
            text: async () => body,
          });
        });
        res.on("error", (e) => { clearTimeout(timer); reject(e); });
      },
    );

    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    if (init.body) req.write(init.body);
    req.end();
  });
}

/**
 * Returns a `fetch` wrapper that:
 *  - Enforces a hard timeout (default 10 s)
 *  - Does NOT follow redirects (redirect: "error")
 *
 * For unauthenticated probes where TOCTOU risk is acceptable (no credentials
 * sent). For authenticated requests use `pinnedHttpsRequest` instead.
 */
export function createHardenedFetch(timeoutMs = 10_000) {
  return async function hardenedFetch(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    } finally {
      clearTimeout(timer);
    }
  };
}
