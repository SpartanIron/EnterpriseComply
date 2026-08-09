/**
 * rate-limit-cleanup.service.ts — Periodic pruning of stale rate-limit rows.
 *
 * Tables covered:
 *   • throttle_hits         — nightly at 03:00 UTC (fixed-window rows, 1 day safety buffer)
 *   • ip_failure_tracker    — nightly at 03:00 UTC (15-min window, 1 day safety buffer)
 *   • ip_magic_link_rate    — hourly (1-min window; needs more frequent pruning to
 *                             prevent bot traffic from filling the table)
 *
 * Each cleanup only removes rows that are fully expired plus a safety buffer,
 * so active blocks and live windows are never touched.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { getRateLimitPool } from "../../lib/pg-pool.js";

// Safety buffer for magic-link rows: 60 seconds past full expiry.
const MAGIC_LINK_SAFETY_MS = BigInt(60 * 1000);

@Injectable()
export class RateLimitCleanupService {
  private readonly logger = new Logger(RateLimitCleanupService.name);

  /**
   * Prune stale throttle_hits and ip_failure_tracker rows.
   *
   * Runs nightly at 03:00 UTC.  A row is safe to delete when its window or
   * block expired more than one full day ago — active or recently expired
   * entries are left untouched.
   */
  @Cron("0 3 * * *", { name: "rate-limit-cleanup-nightly" })
  async pruneStaleRows(): Promise<void> {
    const pool = getRateLimitPool();
    const oneDayAgoMs = BigInt(Date.now()) - BigInt(24 * 60 * 60 * 1000);

    this.logger.log("[rate-limit-cleanup] Starting nightly stale-row pruning …");

    try {
      // ── throttle_hits ────────────────────────────────────────────────────────
      // Delete rows where BOTH the rate-limit window AND the block have expired
      // more than 1 day ago.  Checking only expire_at is insufficient: a row
      // can have a stale window (expire_at old) but a still-active block
      // (block_expire_at in the future).  Deleting such a row would silently
      // lift an active throttle block mid-session.
      // expire_at and block_expire_at are epoch-ms stored as BIGINT.
      // Note: block_expire_at defaults to 0 (no block), so 0 < oneDayAgoMs
      // is always true for unblocked rows — the AND predicate is safe.
      const throttleResult = await pool.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM throttle_hits
           WHERE expire_at       < $1
             AND block_expire_at < $1
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
        "[rate-limit-cleanup] Nightly pruning failed — tables were NOT modified.",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Prune stale ip_magic_link_rate rows.
   *
   * Runs once per hour (at minute 0).  The magic-link window is only 1 minute,
   * so rows expire quickly; under sustained bot traffic the table can grow to
   * millions of rows within days if not pruned frequently.
   *
   * A row is deleted only when BOTH:
   *   • blocked_until < now() - 60 s  (any block has fully expired + buffer)
   *   • window_start  < now() - 60 s  (the counting window has also expired)
   *
   * This 60-second buffer ensures no in-flight request can land on a row that
   * was just deleted mid-UPSERT.
   */
  @Cron("0 * * * *", { name: "magic-link-rate-cleanup-hourly" })
  async pruneMagicLinkRateRows(): Promise<void> {
    const pool = getRateLimitPool();
    // Threshold: everything older than (now - 60 s) is safe to remove.
    const cutoffMs = BigInt(Date.now()) - MAGIC_LINK_SAFETY_MS;

    this.logger.log("[magic-link-rate-cleanup] Starting hourly ip_magic_link_rate pruning …");

    try {
      const result = await pool.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM ip_magic_link_rate
           WHERE blocked_until < $1
             AND window_start  < $1
           RETURNING 1
         )
         SELECT count(*)::text AS count FROM deleted`,
        [cutoffMs],
      );
      const deleted = result.rows[0]?.count ?? "0";

      this.logger.log(
        `[magic-link-rate-cleanup] Done — ip_magic_link_rate: ${deleted} rows deleted.`,
      );
    } catch (err) {
      this.logger.error(
        "[magic-link-rate-cleanup] Hourly pruning failed — ip_magic_link_rate was NOT modified.",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
