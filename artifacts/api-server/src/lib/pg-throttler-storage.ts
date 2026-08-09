/**
 * pg-throttler-storage.ts — Postgres-backed ThrottlerStorage for @nestjs/throttler.
 *
 * Replaces the default in-memory ThrottlerStorageService so that rate-limit
 * hit counters survive a rolling Railway deploy or process restart.
 *
 * The `throttle_hits` table is created automatically on first use (idempotent DDL).
 * Each row represents one (IP-route-key, throttlerProfile) combination.
 *
 * Implements the ThrottlerStorage interface from @nestjs/throttler v6.
 *
 * Window policy: FIXED WINDOW (not per-hit sliding window).
 *   The stock in-memory ThrottlerStorageService uses per-hit sliding windows —
 *   each individual hit expires after its TTL, so a burst at the end of a window
 *   can "slide" through to the next.  Implementing that faithfully in Postgres
 *   would require one row per hit plus a cleanup job.  Instead this implementation
 *   uses a fixed window: a single window_start timestamp shared by all hits in the
 *   same window.  When the window expires the count resets on the next request.
 *   Fixed windows occasionally permit up to 2× the limit across a window boundary;
 *   this trade-off is acceptable for the Railway single-instance deployment.
 *
 * Return units: timeToExpire and timeToBlockExpire are returned in SECONDS,
 *   matching the stock ThrottlerStorageService (Math.ceil(ms / 1000)).  The guard
 *   writes these values directly to X-RateLimit-Reset and Retry-After headers.
 *
 * Concurrency: the entire increment is a single atomic UPSERT — no separate
 *   SELECT.  Concurrent first-requests for the same key can both attempt an
 *   INSERT; the loser triggers ON CONFLICT and increments from the winner's
 *   committed row, so no hit is ever silently dropped.
 */

import type { ThrottlerStorage } from "@nestjs/throttler";
import { getRateLimitPool } from "./pg-pool.js";

/** Mirrors ThrottlerStorageRecord from @nestjs/throttler (not re-exported by v6). */
interface StorageRecord {
  totalHits:         number;
  timeToExpire:      number; // SECONDS until window expires (matches stock storage)
  isBlocked:         boolean;
  timeToBlockExpire: number; // SECONDS until block expires (matches stock storage)
}

// ── Schema bootstrap ──────────────────────────────────────────────────────────

let _schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  const pool = getRateLimitPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS throttle_hits (
      key             TEXT    NOT NULL,
      throttler_name  TEXT    NOT NULL,
      expire_at       BIGINT  NOT NULL,
      block_expire_at BIGINT  NOT NULL DEFAULT 0,
      total_hits      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, throttler_name)
    );
  `);
  _schemaReady = true;
}

// ── ThrottlerStorage implementation ──────────────────────────────────────────

export class PgThrottlerStorage implements ThrottlerStorage {
  /**
   * Atomically increment the hit counter for a (key, throttlerName) pair.
   *
   * A single UPSERT computes the new state entirely inside Postgres, so
   * concurrent requests racing on the same key always produce correct counts:
   * - If no row exists yet, INSERT with count=1.
   * - If a row exists but the window has expired, reset count to 1.
   * - Otherwise increment count and apply a block if the limit is crossed.
   *
   * @param key           Unique string for this IP+route combo
   * @param ttl           Window duration in milliseconds
   * @param limit         Maximum hits allowed before blocking
   * @param blockDuration How long to block (ms) once limit is crossed
   * @param throttlerName Name of the throttler profile ("default", "auth", "webhook")
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    await ensureSchema();
    const pool = getRateLimitPool();
    const now  = BigInt(Date.now());
    const newExpireAt = now + BigInt(ttl);

    // One atomic UPSERT — no separate SELECT.
    // On conflict the CASE expressions reference the committed row values
    // (throttle_hits.*) and the proposed insert values (EXCLUDED.*).
    // RETURNING gives us the final committed state.
    const { rows } = await pool.query<{
      total_hits:      number;
      expire_at:       string;
      block_expire_at: string;
    }>(
      `INSERT INTO throttle_hits (key, throttler_name, expire_at, block_expire_at, total_hits)
       VALUES ($1, $2, $3, 0, 1)
       ON CONFLICT (key, throttler_name) DO UPDATE SET
         total_hits = CASE
           WHEN throttle_hits.expire_at <= $4 THEN 1
           ELSE throttle_hits.total_hits + 1
         END,
         expire_at = CASE
           WHEN throttle_hits.expire_at <= $4 THEN EXCLUDED.expire_at
           ELSE throttle_hits.expire_at
         END,
         block_expire_at = CASE
           WHEN throttle_hits.block_expire_at > $4 THEN throttle_hits.block_expire_at
           WHEN (CASE WHEN throttle_hits.expire_at <= $4 THEN 1
                      ELSE throttle_hits.total_hits + 1 END) > $5
             THEN $4 + $6
           ELSE 0
         END
       RETURNING total_hits, expire_at, block_expire_at`,
      [key, throttlerName, newExpireAt, now, limit, BigInt(blockDuration)],
    );

    const row          = rows[0];
    const expireAt     = BigInt(row.expire_at);
    const blockExpAt   = BigInt(row.block_expire_at);

    // Return SECONDS (not ms) — stock ThrottlerStorageService uses Math.ceil(ms/1000)
    // and the throttler guard writes these directly to X-RateLimit-Reset / Retry-After.
    return {
      totalHits:         row.total_hits,
      timeToExpire:      Math.ceil(Number(expireAt > now ? expireAt - now : 0n) / 1000),
      isBlocked:         blockExpAt > now,
      timeToBlockExpire: Math.ceil(Number(blockExpAt > now ? blockExpAt - now : 0n) / 1000),
    };
  }
}
