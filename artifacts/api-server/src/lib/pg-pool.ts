/**
 * pg-pool.ts — Shared pg.Pool singleton for operational tables that live
 * outside Drizzle's schema (rate-limit counters, IP failure blocks, etc.).
 *
 * Uses the same DATABASE_URL as the rest of the application.  Kept separate
 * from the Drizzle pool so schema tooling doesn't touch these tables.
 */

import pg from "pg";
const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getRateLimitPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "[rate-limit] DATABASE_URL is not set — cannot initialise persistent rate-limit storage",
      );
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Keep the pool small; these tables are only hit on every request —
      // the default 10-connection pool is more than enough.
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    _pool.on("error", (err) => {
      console.error("[rate-limit-pool] idle client error", err.message);
    });
  }
  return _pool;
}
