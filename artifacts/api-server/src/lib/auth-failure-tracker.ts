/**
 * auth-failure-tracker.ts — Postgres-backed IP auth failure block.
 *
 * After FAILURE_THRESHOLD consecutive auth failures from the same source IP
 * within FAILURE_WINDOW_MS, that IP is blocked for BLOCK_DURATION_MS.
 * Blocked IPs should receive HTTP 429 with Retry-After: BLOCK_SECONDS.
 *
 * NIST AC-7: limit consecutive invalid logon attempts.
 *
 * State is persisted in the `ip_failure_tracker` Postgres table so that
 * a rolling Railway deploy or process restart does NOT reset counters.
 * The schema is created automatically on first use (idempotent DDL).
 *
 * Concurrency: recordAuthFailure uses a single atomic UPSERT — no separate
 * SELECT — so concurrent first-requests for the same IP cannot both compute
 * count=1 and overwrite each other; every failure is counted.
 */

import { getRateLimitPool } from "./pg-pool.js";

const FAILURE_WINDOW_MS  = 15 * 60 * 1000; // 15-minute sliding window
const FAILURE_THRESHOLD  = 10;             // failures before block
const BLOCK_DURATION_MS  = 15 * 60 * 1000; // block duration after threshold
export const BLOCK_SECONDS = 900;          // Retry-After value (seconds)

// ── Schema bootstrap ─────────────────────────────────────────────────────────

let _schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  const pool = getRateLimitPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ip_failure_tracker (
      ip            TEXT    PRIMARY KEY,
      count         INTEGER NOT NULL DEFAULT 0,
      window_start  BIGINT  NOT NULL,
      blocked_until BIGINT  NOT NULL DEFAULT 0
    );
  `);
  _schemaReady = true;
}

// ── Public API (all async — use await at call sites) ─────────────────────────

/**
 * Record one auth failure for an IP.
 *
 * Uses a single atomic UPSERT so concurrent failures from the same IP are
 * never silently dropped — every call increments or resets exactly once.
 *
 * @returns true if the IP is now blocked (crossed threshold on THIS call or was already blocked)
 */
export async function recordAuthFailure(ip: string): Promise<boolean> {
  await ensureSchema();
  const pool         = getRateLimitPool();
  const now          = BigInt(Date.now());
  const windowMs     = BigInt(FAILURE_WINDOW_MS);
  const blockDurMs   = BigInt(BLOCK_DURATION_MS);
  const threshold    = FAILURE_THRESHOLD;

  // One atomic UPSERT — no separate SELECT.
  // ON CONFLICT expressions reference the committed row values (ip_failure_tracker.*)
  // so all arithmetic is serialised inside Postgres and no update is lost.
  const { rows } = await pool.query<{
    count:         number;
    blocked_until: string;
  }>(
    `INSERT INTO ip_failure_tracker (ip, count, window_start, blocked_until)
     VALUES ($1, 1, $2, 0)
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE
         WHEN ip_failure_tracker.blocked_until > $2 THEN ip_failure_tracker.count
         WHEN $2 - ip_failure_tracker.window_start > $3  THEN 1
         ELSE ip_failure_tracker.count + 1
       END,
       window_start = CASE
         WHEN ip_failure_tracker.blocked_until > $2 THEN ip_failure_tracker.window_start
         WHEN $2 - ip_failure_tracker.window_start > $3  THEN $2
         ELSE ip_failure_tracker.window_start
       END,
       blocked_until = CASE
         WHEN ip_failure_tracker.blocked_until > $2 THEN ip_failure_tracker.blocked_until
         WHEN $2 - ip_failure_tracker.window_start > $3  THEN 0
         WHEN ip_failure_tracker.count + 1 >= $4           THEN $2 + $5
         ELSE 0
       END
     RETURNING count, blocked_until`,
    [ip, now, windowMs, threshold, blockDurMs],
  );

  const row = rows[0];
  return BigInt(row.blocked_until) > now;
}

/**
 * Check if an IP is currently blocked without recording a failure.
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  await ensureSchema();
  const pool = getRateLimitPool();
  const now  = Date.now();
  const { rows } = await pool.query<{ blocked_until: string }>(
    "SELECT blocked_until FROM ip_failure_tracker WHERE ip = $1",
    [ip],
  );
  if (!rows[0]) return false;
  return Number(rows[0].blocked_until) > now;
}

/**
 * Seconds remaining until the block expires (for the Retry-After header).
 */
export async function blockRemainingSeconds(ip: string): Promise<number> {
  await ensureSchema();
  const pool = getRateLimitPool();
  const now  = Date.now();
  const { rows } = await pool.query<{ blocked_until: string }>(
    "SELECT blocked_until FROM ip_failure_tracker WHERE ip = $1",
    [ip],
  );
  if (!rows[0]) return BLOCK_SECONDS;
  const bu = Number(rows[0].blocked_until);
  return bu > now ? Math.ceil((bu - now) / 1000) : 0;
}

/** Reset a specific IP — used in automated tests to clear state between runs. */
export async function resetIpFailures(ip: string): Promise<void> {
  await ensureSchema();
  const pool = getRateLimitPool();
  await pool.query("DELETE FROM ip_failure_tracker WHERE ip = $1", [ip]);
}

export interface BlockedIpEntry {
  ip: string;
  failureCount: number;
  blockedUntil: string; // ISO-8601
  secondsRemaining: number;
}

/**
 * List all IPs that are currently blocked (blocked_until > now).
 * Used by the super-admin rate-limit dashboard.
 */
export async function listBlocked(): Promise<BlockedIpEntry[]> {
  await ensureSchema();
  const pool = getRateLimitPool();
  const now = Date.now();
  const { rows } = await pool.query<{
    ip: string;
    count: number;
    blocked_until: string;
  }>(
    `SELECT ip, count, blocked_until
     FROM ip_failure_tracker
     WHERE blocked_until > $1
     ORDER BY blocked_until DESC`,
    [BigInt(now)],
  );
  return rows.map(r => {
    const bu = Number(r.blocked_until);
    return {
      ip: r.ip,
      failureCount: r.count,
      blockedUntil: new Date(bu).toISOString(),
      secondsRemaining: Math.max(0, Math.ceil((bu - now) / 1000)),
    };
  });
}

/**
 * Clear the block for a specific IP (deletes the row entirely).
 * Used by the super-admin unblock action.
 */
export async function clearBlock(ip: string): Promise<void> {
  await ensureSchema();
  const pool = getRateLimitPool();
  await pool.query("DELETE FROM ip_failure_tracker WHERE ip = $1", [ip]);
}
