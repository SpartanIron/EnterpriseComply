/**
 * BetterAuth integration provider.
 *
 * Uses only the documented BetterAuth admin API endpoints:
 *   GET /api/auth/admin/list-users            — list/count users
 *   GET /api/auth/admin/list-user-sessions    — per-user sessions (requires ?userId=)
 *
 * Authentication: Bearer token in the Authorization header.
 *
 * SSRF mitigation:
 *   All authenticated requests use `pinnedHttpsRequest`, which connects to the
 *   DNS-resolved IP captured at validation time rather than re-resolving the
 *   hostname. This closes the TOCTOU gap between validation and fetch.
 *   The unauthenticated admin-protection probe uses `createHardenedFetch`
 *   (no credentials sent, so TOCTOU risk is acceptable).
 */

import {
  validateAndResolvePublicHttpsUrl,
  pinnedHttpsRequest,
  createHardenedFetch,
  SsrfBlockedError,
} from "../../../lib/ssrf-guard.js";

export interface BetterAuthCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: string;
}

export interface BetterAuthEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "betterauth";
}

export interface BetterAuthSyncResult {
  controlResults: BetterAuthCheckResult[];
  evidenceItems: BetterAuthEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const hardenedFetch = createHardenedFetch(10_000);

/**
 * Make an authenticated request to the BetterAuth admin API using the pinned
 * HTTPS client so the same validated IP is used for the actual connection.
 */
async function baRequest<T = unknown>(
  apiKey: string,
  cleanBase: string,
  resolvedIP: string,
  path: string,
): Promise<T> {
  const url = `${cleanBase}${path}`;
  const res = await pinnedHttpsRequest(url, resolvedIP, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    throw new Error(`BetterAuth API ${path}: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export async function runBetterAuthChecks(
  apiKey: string,
  baseUrl: string,
): Promise<BetterAuthSyncResult> {
  // Validate the URL and capture the resolved IP in one step.
  // All subsequent authenticated requests use `resolvedIP` to prevent TOCTOU.
  let cleanBase: string;
  let resolvedIP: string;
  try {
    const validated = await validateAndResolvePublicHttpsUrl(baseUrl, "baseUrl");
    cleanBase = validated.url.origin; // e.g. https://auth.example.com
    resolvedIP = validated.resolvedIP;
  } catch (err) {
    throw err instanceof SsrfBlockedError
      ? err
      : new Error(`Invalid baseUrl: ${String(err)}`);
  }

  const controlResults: BetterAuthCheckResult[] = [];
  const evidenceItems: BetterAuthEvidenceItem[] = [];

  // ── Check 1: Auth service reachability and user roster (UCO-AI-001) ─────────
  // Uses the documented `list-users` endpoint with a small page limit to verify
  // connectivity, validate the API key, and gather user-count evidence.
  let totalUsers = 0;
  let firstUserId: string | null = null;

  try {
    const usersData = await baRequest<{
      users?: Array<{ id: string; email?: string; createdAt?: string }>;
      total?: number;
    }>(apiKey, cleanBase, resolvedIP, "/api/auth/admin/list-users?limit=100&offset=0");

    const users = usersData?.users ?? [];
    totalUsers = usersData?.total ?? users.length;
    firstUserId = users[0]?.id ?? null;

    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: "passing",
      result: `BetterAuth admin API verified: ${totalUsers} registered users found. Auth service reachable at ${cleanBase} and admin credentials are valid.`,
      integrationKey: "betterauth",
    });

    evidenceItems.push({
      ucoControlId: "UCO-AI-001",
      title: "BetterAuth — User Roster & Auth Service Availability",
      description: `BetterAuth authentication service confirmed reachable via ${cleanBase}. Admin API returned ${totalUsers} registered users. Credential validity confirmed by successful admin API access.`,
      type: "auto",
      source: "betterauth",
    });
  } catch (err) {
    if (err instanceof SsrfBlockedError) throw err;

    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: "failing",
      result: `BetterAuth admin API verification failed: ${String(err)}. Check that the API key is valid and the base URL is correct.`,
      integrationKey: "betterauth",
    });
    // Cannot proceed without connectivity — return early.
    return { controlResults, evidenceItems, checksRun: 1, checksPassed: 0 };
  }

  // ── Check 2: Session audit via per-user session listing (UCO-AL-001) ────────
  // BetterAuth documents `list-user-sessions?userId=` for per-user session data.
  // We check the first returned user (if any) as a representative sample.
  if (firstUserId) {
    try {
      const sessData = await baRequest<{
        sessions?: Array<{
          id: string;
          userId: string;
          expiresAt?: string;
          createdAt?: string;
          userAgent?: string;
        }>;
        total?: number;
      }>(
        apiKey,
        cleanBase,
        resolvedIP,
        `/api/auth/admin/list-user-sessions?userId=${encodeURIComponent(firstUserId)}&limit=10`,
      );

      const sessions = sessData?.sessions ?? [];
      const now = Date.now();
      const activeSessions = sessions.filter(
        (s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now,
      );

      controlResults.push({
        ucoControlId: "UCO-AL-001",
        status: "passing",
        result: `BetterAuth session audit API is operational. Sample user has ${sessions.length} session record(s) (${activeSessions.length} active). Per-user session audit trail is available via admin API.`,
        integrationKey: "betterauth",
      });

      evidenceItems.push({
        ucoControlId: "UCO-AL-001",
        title: "BetterAuth — Session Audit Trail Availability",
        description: `BetterAuth admin API confirmed session auditing is available. Sample user has ${sessions.length} session record(s), of which ${activeSessions.length} are currently active. Per-user session history is accessible for access review purposes.`,
        type: "auto",
        source: "betterauth",
      });
    } catch (err) {
      if (err instanceof SsrfBlockedError) throw err;

      controlResults.push({
        ucoControlId: "UCO-AL-001",
        status: "warning",
        result: `BetterAuth session audit endpoint returned an error: ${String(err)}. Verify the admin plugin is enabled and /api/auth/admin/list-user-sessions is available.`,
        integrationKey: "betterauth",
      });
    }
  } else {
    // No users yet — service is fresh but reachable
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: "passing",
      result: `BetterAuth auth service has no users yet. Session audit trail is available via /api/auth/admin/list-user-sessions once users are added.`,
      integrationKey: "betterauth",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AL-001",
      title: "BetterAuth — Session Audit Trail Availability",
      description: `BetterAuth admin API confirmed. No users registered yet, so session history is empty. Session auditing via /api/auth/admin/list-user-sessions will be available once users sign up.`,
      type: "auto",
      source: "betterauth",
    });
  }

  // ── Check 3: Admin API access control posture (UCO-AC-002) ──────────────────
  // Sends an unauthenticated request to verify the admin route rejects it.
  // Uses hardenedFetch (not the pinned client) since no credentials are sent.
  // Note: hardenedFetch re-resolves DNS, but TOCTOU is acceptable here because
  // no secret is transmitted on this probe.
  try {
    const unauthRes = await hardenedFetch(
      `${cleanBase}/api/auth/admin/list-users?limit=1`,
      { headers: { "Content-Type": "application/json" } },
    );
    const adminProtected = unauthRes.status === 401 || unauthRes.status === 403;

    controlResults.push({
      ucoControlId: "UCO-AC-002",
      status: adminProtected ? "passing" : "failing",
      result: adminProtected
        ? "BetterAuth admin API correctly rejects unauthenticated requests (HTTP 401/403). Admin endpoint is protected."
        : `BetterAuth admin API returned HTTP ${unauthRes.status} without credentials — admin routes may not be properly protected. Review admin route authentication middleware.`,
      integrationKey: "betterauth",
    });

    evidenceItems.push({
      ucoControlId: "UCO-AC-002",
      title: "BetterAuth — Admin API Access Control",
      description: `Unauthenticated probe of ${cleanBase}/api/auth/admin/list-users returned HTTP ${unauthRes.status}. ${adminProtected ? "Admin API correctly requires authentication." : "Admin API may be accessible without credentials — review auth middleware configuration."}`,
      type: "auto",
      source: "betterauth",
    });
  } catch {
    // hardenedFetch rejects redirects (redirect:"error") — a 3xx from the admin
    // route may indicate misconfiguration, treat as unknown.
    controlResults.push({
      ucoControlId: "UCO-AC-002",
      status: "warning",
      result:
        "BetterAuth admin API access control check inconclusive (network error or redirect). Manually verify that /api/auth/admin/* routes require authentication.",
      integrationKey: "betterauth",
    });
  }

  // ── Check 4: Auth event logging guidance (UCO-AI-003) ───────────────────────
  // BetterAuth does not expose an event telemetry endpoint by default.
  // Report as a configuration guidance item so the org knows what to enable.
  controlResults.push({
    ucoControlId: "UCO-AI-003",
    status: "warning",
    result:
      `BetterAuth does not expose authentication event telemetry (sign-ins, failed attempts) via the admin API by default. To satisfy UCO-AI-003, enable server-side auth event logging (e.g. via the BetterAuth logger plugin or application-level middleware) and forward events to your SIEM.`,
    integrationKey: "betterauth",
  });
  evidenceItems.push({
    ucoControlId: "UCO-AI-003",
    title: "BetterAuth — Auth Event Telemetry Configuration Guidance",
    description:
      `BetterAuth admin API (v1 documented endpoints) does not provide an event log endpoint. Auth event telemetry must be enabled via the logger plugin or application-level middleware. Configure structured auth event logging and forward to your SIEM to fully satisfy UCO-AI-003.`,
    type: "auto",
    source: "betterauth",
  });

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return {
    controlResults,
    evidenceItems,
    checksRun: controlResults.length,
    checksPassed,
  };
}
