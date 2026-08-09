/**
 * rate-limit-cleanup.service.ts — Nightly pruning of stale rate-limit rows.
 *
 * The `throttle_hits` and `ip_failure_tracker` tables accumulate one row per
 * unique IP+route combination and never shrink on their own.  After months of
 * production traffic this grows unboundedly and adds latency to every
 * rate-limit check.
 *
 * This service runs at 03:00 UTC every night and deletes rows whose windows or
 * blocks expired at least one full day ago — so any active limit is never
 * touched.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { getRateLimitPool } from "../../lib/pg-pool.js";

@Injectable()
export class RateLimitCleanupService {
  private readonly logger = new Logger(RateLimitCleanupService.name);

  /**
   * Prune stale throttle_hits rows.
   *
   * A row is safe to delete when expire_at is more than one day in the past
   * (i.e. the fixed window expired over 24 hours ago).  Active or recently
   * expired windows are left untouched.
   */
  @Cron("0 3 * * *", { name: "rate-limit-cleanup" })
  async pruneStaleRows(): Promise<void> {
    const pool = getRateLimitPool();
    const oneDayAgoMs = BigInt(Date.now()) - BigInt(24 * 60 * 60 * 1000);

    this.logger.log("[rate-limit-cleanup] Starting nightly stale-row pruning …");

    try {
      // ── throttle_hits ────────────────────────────────────────────────────────
      // Delete rows whose window expired more than 1 day ago.
      // expire_at is stored as epoch-ms in a BIGINT column.
      const throttleResult = await pool.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM throttle_hits
           WHERE expire_at < $1
           RETURNING 1
         )
         SELECT count(*)::text AS count FROM deleted`,
        [oneDayAgoMs],
      );
      const throttleDeleted = throttleResult.rows[0]?.count ?? "0";

      // ── ip_failure_tracker ───────────────────────────────────────────────────
      // Delete rows where:
      //   • blocked_until < now() - 1 day  (block well expired), AND
      //   • window_start  < now() - 1 day  (failure window also well expired)
      // This guarantees no active block or live window is removed.
      const ipResult = await pool.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM ip_failure_tracker
           WHERE blocked_until < $1
             AND window_start  < $1
           RETURNING 1
         )
         SELECT count(*)::text AS count FROM deleted`,
        [oneDayAgoMs],
      );
      const ipDeleted = ipResult.rows[0]?.count ?? "0";

      this.logger.log(
        `[rate-limit-cleanup] Done — throttle_hits: ${throttleDeleted} rows deleted, ` +
          `ip_failure_tracker: ${ipDeleted} rows deleted.`,
      );
    } catch (err) {
      this.logger.error(
        "[rate-limit-cleanup] Pruning failed — tables were NOT modified.",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
