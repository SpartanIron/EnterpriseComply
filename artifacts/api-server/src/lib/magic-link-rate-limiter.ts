/**
 * magic-link-rate-limiter.ts — Express middleware that enforces a 5 req/min
 * per-IP limit on POST /api/auth/magic-link/send.
 *
 * Why a standalone middleware instead of NestJS @Throttle:
 * BetterAuth's wildcard @All("*path") controller swallows all /api/auth/*
 * sub-routes before NestJS per-route decorators can fire, so per-route
 * @Throttle on /magic-link/send is unreachable.  Registering an Express
 * middleware in main.ts before NestFactory.create runs ahead of NestJS routing
 * and is the correct interception point.
 *
 * State is persisted in Postgres (ip_magic_link_rate table) so that rolling
 * deploys and process restarts do NOT reset the window — a bot cannot bypass
 * the limit by triggering a restart.
 *
 * Additionally, a secondary in-memory per-email rate limit is enforced:
 * max EMAIL_LIMIT sends per email per EMAIL_WINDOW_MS (10 minutes).
 * This prevents a single address from being flooded from multiple IPs.
 *
 * Controls: NIST AC-7 (limit auth attempts), OWASP ASVS 2.5.6 (ambiguous responses)
 */

import type { Request, Response, NextFunction } from "express";
import { getRateLimitPool } from "./pg-pool.js";
import {
  EMAIL_LIMIT,
  EMAIL_WINDOW_MS,
  EMAIL_RATE_TABLE_SQL,
  EMAIL_RATE_UPSERT_SQL,
  EMAIL_RATE_DELETE_SQL,
  normaliseRateLimitEmail,
  isEmailRateBlocked,
} from "./magic-link-rate-sql.js";

export { EMAIL_LIMIT, EMAIL_WINDOW_MS };

const WINDOW_MS   = 60 * 1000;  // 1-minute sliding window
const MAX_REQUESTS = 5;          // requests allowed per window
export const RETRY_AFTER_SECONDS = 60; // Retry-After header value

// ── Per-email rate limit constants ────────────────────────────────────────────


// ── Schema bootstrap ──────────────────────────────────────────────────────────

let _schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  const pool = getRateLimitPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ip_magic_link_rate (
      ip           TEXT   PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      window_start BIGINT  NOT NULL,
      blocked_until BIGINT NOT NULL DEFAULT 0
    );
  `);
  await pool.query(EMAIL_RATE_TABLE_SQL);
  _schemaReady = true;
}

/**
 * Record one magic-link send attempt for an IP.
 *
 * Uses a single atomic UPSERT so concurrent requests from the same IP are
 * never undercounted.
 *
 * @returns true if the IP is now rate-limited (exceeds 5 req/min)
 */
async function recordAndCheck(ip: string): Promise<boolean> {
  await ensureSchema();
  const pool       = getRateLimitPool();
  const now        = BigInt(Date.now());
  const windowMs   = BigInt(WINDOW_MS);
  const blockDurMs = BigInt(RETRY_AFTER_SECONDS * 1000);
  const maxReq     = MAX_REQUESTS;

  const { rows } = await pool.query<{
    count:         number;
    blocked_until: string;
  }>(
    `INSERT INTO ip_magic_link_rate (ip, count, window_start, blocked_until)
     VALUES ($1, 1, $2, 0)
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE
         WHEN ip_magic_link_rate.blocked_until > $2                     THEN ip_magic_link_rate.count
         WHEN $2 - ip_magic_link_rate.window_start > $3                 THEN 1
         ELSE ip_magic_link_rate.count + 1
       END,
       window_start = CASE
         WHEN ip_magic_link_rate.blocked_until > $2                     THEN ip_magic_link_rate.window_start
         WHEN $2 - ip_magic_link_rate.window_start > $3                 THEN $2
         ELSE ip_magic_link_rate.window_start
       END,
       blocked_until = CASE
         WHEN ip_magic_link_rate.blocked_until > $2                     THEN ip_magic_link_rate.blocked_until
         WHEN $2 - ip_magic_link_rate.window_start > $3                 THEN 0
         WHEN ip_magic_link_rate.count + 1 > $4                         THEN $2 + $5
         ELSE 0
       END
     RETURNING count, blocked_until`,
    [ip, now, windowMs, maxReq, blockDurMs],
  );

  const row = rows[0];
  return BigInt(row.blocked_until) > now;
}

/**
 * Record one magic-link send attempt for an email address using in-memory state.
 *
 * Max EMAIL_LIMIT (3) sends per email per EMAIL_WINDOW_MS (10 minutes).
 * Uses a simple sliding window reset: if the window has expired, start fresh.
 *
 * @returns { blocked: boolean; retryAfterMs: number }
 */
export async function recordAndCheckEmail(
  email: string,
): Promise<{ blocked: boolean; retryAfterMs: number }> {
  await ensureSchema();
  const pool = getRateLimitPool();
  const key = normaliseRateLimitEmail(email);
  const now = BigInt(Date.now());
  const windowMs = BigInt(EMAIL_WINDOW_MS);

  // One atomic upsert: the window either rolls over or the counter increments,
  // so two concurrent requests can never both slip past the limit, and the
  // state is shared by every replica instead of living in one process.
  const { rows } = await pool.query<{ count: number; window_start: string }>(
    EMAIL_RATE_UPSERT_SQL,
    [key, now, windowMs],
  );

  const row = rows[0];
  if (!row) return { blocked: false, retryAfterMs: 0 };
  return isEmailRateBlocked(row.count, Number(row.window_start));
}

/** Reset a specific IP — used in automated tests to clear state between runs. */
export async function resetMagicLinkRateForIp(ip: string): Promise<void> {
  await ensureSchema();
  const pool = getRateLimitPool();
  await pool.query("DELETE FROM ip_magic_link_rate WHERE ip = $1", [ip]);
}

/** Reset email rate state for a specific address — used in automated tests. */
export async function resetMagicLinkRateForEmail(email: string): Promise<void> {
  await ensureSchema();
  const pool = getRateLimitPool();
  await pool.query(EMAIL_RATE_DELETE_SQL, [normaliseRateLimitEmail(email)]);
}

export interface MagicLinkThrottleEntry {
  ip: string;
  requestCount: number;
  windowStart: string;  // ISO-8601
  blockedUntil: string | null; // ISO-8601, null if not currently blocked
  secondsRemaining: number;    // 0 if not blocked
}

/**
 * List all IPs that are currently in a live magic-link throttle window
 * (either actively blocked or within their current counting window).
 * Used by the super-admin security dashboard.
 */
export async function listActiveThrottles(): Promise<MagicLinkThrottleEntry[]> {
  await ensureSchema();
  const pool = getRateLimitPool();
  const now = Date.now();
  const windowMs = BigInt(WINDOW_MS);
  // Return IPs blocked right now OR whose window started within the last WINDOW_MS
  const { rows } = await pool.query<{
    ip: string;
    count: number;
    window_start: string;
    blocked_until: string;
  }>(
    `SELECT ip, count, window_start, blocked_until
     FROM ip_magic_link_rate
     WHERE blocked_until > $1
        OR $1 - window_start < $2
     ORDER BY blocked_until DESC, count DESC`,
    [BigInt(now), windowMs],
  );
  return rows.map(r => {
    const bu = Number(r.blocked_until);
    const isBlocked = bu > now;
    return {
      ip: r.ip,
      requestCount: r.count,
      windowStart: new Date(Number(r.window_start)).toISOString(),
      blockedUntil: isBlocked ? new Date(bu).toISOString() : null,
      secondsRemaining: isBlocked ? Math.max(0, Math.ceil((bu - now) / 1000)) : 0,
    };
  });
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Intercept POST /api/auth/magic-link/send before NestJS routing.
 * All other paths and methods pass through immediately (no DB hit).
 *
 * Enforces two rate limits in order:
 *   1. Per-IP limit (Postgres-backed): 5 req/min
 *   2. Per-email limit (in-memory): 3 sends per 10 minutes
 */
export function magicLinkRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only gate the magic-link send endpoint.
  // BetterAuth's magicLink plugin (basePath /api/auth) exposes the send
  // operation at POST /api/auth/sign-in/magic-link (not /magic-link/send).
  if (req.method !== "POST" || !req.path.endsWith("/auth/sign-in/magic-link")) {
    next();
    return;
  }

  // req.ip is populated correctly because main.ts sets "trust proxy" = 1
  const ip = req.ip ?? "unknown";

  recordAndCheck(ip).then(async (limited) => {
    if (limited) {
      res
        .status(429)
        .set("Retry-After", String(RETRY_AFTER_SECONDS))
        .json({
          error: "Too Many Requests",
          message: "Magic link requests are limited to 5 per minute per IP address.",
          retryAfter: RETRY_AFTER_SECONDS,
        });
      return;
    }

    // ── Per-email check ───────────────────────────────────────────────────────
    // Extract email from body. BetterAuth sends JSON body for this endpoint.
    // req.body is populated by express.json() registered in main.ts before this middleware.
    const email: string | undefined = req.body?.email ?? req.body?.identifier;
    if (email) {
      const emailCheck = await recordAndCheckEmail(email);
      if (emailCheck.blocked) {
        const retryAfterSeconds = Math.ceil(emailCheck.retryAfterMs / 1000);
        res
          .status(429)
          .set("Retry-After", String(retryAfterSeconds))
          .json({
            error: "Too Many Requests",
            message: "Too many magic links sent to this address. Try again later.",
            retryAfter: retryAfterSeconds,
          });
        return;
      }
    }

    next();
  }).catch((err) => {
    // If the rate-limit DB is unavailable, fail open to avoid blocking legitimate users.
    // Log the error so operators are alerted.
    console.error("[magic-link-rate-limiter] DB error — failing open:", err?.message ?? err);
    next();
  });
}
