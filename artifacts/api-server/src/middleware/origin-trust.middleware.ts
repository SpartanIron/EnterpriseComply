import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Origin trust: only serve traffic that arrived through an approved front door.
 *
 * Railway hands every service a public `*.up.railway.app` hostname that resolves
 * straight to the container, bypassing Cloudflare entirely - and with it the WAF,
 * the rate limits, bot controls and Under Attack mode. Authenticated Origin Pulls
 * (mTLS from the edge) cannot be completed on Railway because we do not control
 * client-certificate verification at the origin, so we enforce the equivalent in
 * the application:
 *
 *   1. Host allow-list. A request whose Host header is not an approved public
 *      hostname is refused. This alone closes the `*.up.railway.app` bypass.
 *   2. Optional shared secret. When EDGE_SHARED_SECRET is set, the request must
 *      also carry it in `x-ec-edge-auth`, which a Cloudflare Transform Rule adds
 *      at the edge. That proves the request actually transited Cloudflare rather
 *      than merely claiming the right Host.
 *
 * Modes (ORIGIN_TRUST_MODE): "off" | "report" | "enforce".
 * Production defaults to "report" so that turning this on can never black-hole
 * live traffic before the observed-hosts list has been reviewed at
 * GET /api/admin/origin-trust.
 */

export type OriginTrustMode = "off" | "report" | "enforce";

export interface OriginTrustObservation {
  host: string;
  requests: number;
  refused: number;
  firstSeen: string;
  lastSeen: string;
}

export const EDGE_SECRET_HEADER = "x-ec-edge-auth";

/** Railway's own health probe does not go through Cloudflare and has no Host we control. */
const EXEMPT_PREFIXES = ["/healthz", "/health", "/api/healthz", "/api/health"];

const DEFAULT_TRUSTED_HOSTS = [
  "app.enterprisecomply.com",
  "grc.colorcodesolutions.com",
];

const MAX_OBSERVED_HOSTS = 200;

const observed = new Map<string, OriginTrustObservation>();

export function resolveOriginTrustMode(
  env: NodeJS.ProcessEnv = process.env,
): OriginTrustMode {
  const raw = (env.ORIGIN_TRUST_MODE ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "report" || raw === "enforce") return raw;
  return env.NODE_ENV === "production" ? "report" : "off";
}

export function resolveTrustedHosts(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const out = new Set<string>();
  for (const part of (env.TRUSTED_HOSTS ?? "").split(",")) {
    const value = part.trim().toLowerCase();
    if (value) out.add(value);
  }
  for (const key of ["PUBLIC_APP_URL", "APP_URL", "FRONTEND_URL", "PUBLIC_BASE_URL"]) {
    const value = env[key];
    if (!value) continue;
    try {
      out.add(new URL(value).host.toLowerCase());
    } catch {
      // A malformed URL in config must not take the service down.
    }
  }
  if (out.size === 0) for (const host of DEFAULT_TRUSTED_HOSTS) out.add(host);
  if ((env.NODE_ENV ?? "development") !== "production") {
    out.add("localhost");
    out.add("127.0.0.1");
  }
  return [...out];
}

/**
 * An allow-list entry without a port matches that host on any port; an entry
 * with a port must match exactly. Comparison is on the literal Host header, not
 * on X-Forwarded-Host, because the latter is attacker-controlled.
 */
export function hostMatches(host: string, allowed: string): boolean {
  if (!host || !allowed) return false;
  if (host === allowed) return true;
  if (allowed.includes(":")) return false;
  const closingBracket = host.lastIndexOf("]");
  const portSeparator = host.indexOf(":", closingBracket + 1);
  if (portSeparator < 0) return false;
  return host.slice(0, portSeparator) === allowed;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Still burn a comparison so length does not leak through timing.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function record(host: string, refused: boolean): void {
  const now = new Date().toISOString();
  let entry = observed.get(host);
  if (!entry) {
    if (observed.size >= MAX_OBSERVED_HOSTS) return;
    entry = { host, requests: 0, refused: 0, firstSeen: now, lastSeen: now };
    observed.set(host, entry);
  }
  entry.requests += 1;
  entry.lastSeen = now;
  if (refused) entry.refused += 1;
}

export function readOriginTrustPosture(env: NodeJS.ProcessEnv = process.env) {
  const mode = resolveOriginTrustMode(env);
  const trustedHosts = resolveTrustedHosts(env);
  const edgeSecretConfigured = (env.EDGE_SHARED_SECRET ?? "") !== "";
  const observedHosts = [...observed.values()].sort(
    (a, b) => b.requests - a.requests,
  );
  return {
    mode,
    trustedHosts,
    edgeSecretConfigured,
    edgeSecretHeader: EDGE_SECRET_HEADER,
    exemptPrefixes: EXEMPT_PREFIXES,
    observedHosts,
    refusedTotal: observedHosts.reduce((sum, o) => sum + o.refused, 0),
    findings:
      mode === "enforce"
        ? []
        : [
            {
              severity: mode === "report" ? "medium" : "high",
              control: "SC-7 / SC-8",
              finding:
                "Origin trust is not enforcing. Requests that bypass the CDN by " +
                "addressing the origin hostname directly are still served.",
              remediation:
                "Review observedHosts, then set ORIGIN_TRUST_MODE=enforce.",
            },
          ],
  };
}

/** Test seam: lets a suite assert on a clean observation window. */
export function resetOriginTrustObservations(): void {
  observed.clear();
}

export function originTrustMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const mode = resolveOriginTrustMode();
  if (mode === "off") {
    next();
    return;
  }

  const path = req.path || req.url || "";
  for (const prefix of EXEMPT_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + "/")) {
      next();
      return;
    }
  }

  const host = String(req.headers.host ?? "").trim().toLowerCase();
  const hostOk = resolveTrustedHosts().some((allowed) =>
    hostMatches(host, allowed),
  );

  const expectedSecret = process.env.EDGE_SHARED_SECRET ?? "";
  const secretOk =
    expectedSecret === "" ||
    constantTimeEquals(String(req.headers[EDGE_SECRET_HEADER] ?? ""), expectedSecret);

  const trusted = hostOk && secretOk;
  record(host || "(no host header)", !trusted);

  if (trusted) {
    next();
    return;
  }

  if (mode === "report") {
    res.setHeader("x-origin-trust", "report-only-violation");
    next();
    return;
  }

  res.setHeader("x-origin-trust", "refused");
  res.status(421).json({
    statusCode: 421,
    error: "Misdirected Request",
    message: "This hostname is not an approved entry point for this service.",
  });
}
