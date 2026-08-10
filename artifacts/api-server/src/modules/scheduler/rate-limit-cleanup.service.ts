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
 *
 * On-call alerting:
 *   When a job fails, SlackAlertService.sendRawMessage() fires a message to the
 *   global SLACK_WEBHOOK_URL (see .env / Railway env vars).  The same webhook is
 *   used for compliance and evidence expiry alerts so no new secrets are needed.
 *   If SLACK_WEBHOOK_URL is not set the alert is silently skipped.
 *
 * Health tracking:
 *   Both cron methods record their last-run outcome in memory.  Callers use
 *   getHealth() to obtain a sanitised summary (no raw error text) suitable for
 *   the /healthz/scheduler endpoint.  The pool factory is overridable via
 *   _setPoolFactory() so tests can inject a broken pool and exercise the real
 *   catch paths without subclassing.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Pool } from "pg";
import { getRateLimitPool } from "../../lib/pg-pool.js";
import { SlackAlertService } from "../notifications/slack-alert.service.js";

// Safety buffer for magic-link rows: 60 seconds past full expiry.
const MAGIC_LINK_SAFETY_MS = BigInt(60 * 1000);

/** Internal state — includes the raw error message for logging. */
interface InternalJobHealth {
  lastRunAt: string | null;
  lastSuccess: boolean | null;
  /** Raw message kept internally; never exposed to the public API. */
  lastErrorInternal: string | null;
  errorCount: number;
}

/** Public shape returned by getHealth() — error text is sanitised. */
export interface CleanupJobHealth {
  lastRunAt: string | null;
  lastSuccess: boolean | null;
  /** true when the last run failed; false/null otherwise. No raw error text is exposed. */
  failed: boolean;
  errorCount: number;
}

export interface SchedulerHealth {
  nightly: CleanupJobHealth;
  magicLinkHourly: CleanupJobHealth;
  healthy: boolean;
}

@Injectable()
export class RateLimitCleanupService {
  private readonly logger = new Logger(RateLimitCleanupService.name);

  // Pool factory — overridable for testing via _setPoolFactory().
  private poolFactory: () => Pool = getRateLimitPool;

  // ── In-memory health state ────────────────────────────────────────────────

  private nightlyHealth: InternalJobHealth = {
    lastRunAt: null,
    lastSuccess: null,
    lastErrorInternal: null,
    errorCount: 0,
  };

  private magicLinkHealth: InternalJobHealth = {
    lastRunAt: null,
    lastSuccess: null,
    lastErrorInternal: null,
    errorCount: 0,
  };

  constructor(private readonly slackAlert: SlackAlertService) {}

  /**
   * Override the pool factory for testing.
   *
   * Pass a function that returns a pool-compatible object (can be a stub that
   * always throws).  The real cron methods call this.poolFactory() at invocation
   * time, so the entire production catch path is exercised.
   *
   * @example
   *   svc._setPoolFactory(() => ({ query: () => Promise.reject(new Error("down")) }));
   *   await svc.pruneStaleRows();   // real production code path, broken pool
   */
  _setPoolFactory(factory: () => Pool): void {
    this.poolFactory = factory;
  }

  /**
   * Returns a sanitised health summary — raw error messages are never exposed.
   * Called by the health controller at GET /healthz/scheduler.
   */
  getHealth(): SchedulerHealth {
    const toPublic = (h: InternalJobHealth): CleanupJobHealth => ({
      lastRunAt: h.lastRunAt,
      lastSuccess: h.lastSuccess,
      failed: h.lastSuccess === false,
      errorCount: h.errorCount,
    });

    const nightly = toPublic(this.nightlyHealth);
    const magicLinkHourly = toPublic(this.magicLinkHealth);

    // healthy = no job has had a failed last run.
    // null (not-yet-run) is treated as healthy (neutral).
    const healthy = !nightly.failed && !magicLinkHourly.failed;

    return { nightly, magicLinkHourly, healthy };
  }

  /**
   * Prune stale throttle_hits and ip_failure_tracker rows.
   *
   * Runs nightly at 03:00 UTC.  A row is safe to delete when its window or
   * block expired more than one full day ago — active or recently expired
   * entries are left untouched.
   */
  @Cron("0 3 * * *", { name: "rate-limit-cleanup-nightly" })
  async pruneStaleRows(): Promise<void> {
    const pool = this.poolFactory();
    const oneDayAgoMs = BigInt(Date.now()) - BigInt(24 * 60 * 60 * 1000);
    const runAt = new Date().toISOString();

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

      // ── Record success ───────────────────────────────────────────────────────
      this.nightlyHealth = {
        lastRunAt: runAt,
        lastSuccess: true,
        lastErrorInternal: null,
        errorCount: this.nightlyHealth.errorCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const newCount = this.nightlyHealth.errorCount + 1;

      this.nightlyHealth = {
        lastRunAt: runAt,
        lastSuccess: false,
        lastErrorInternal: message,
        errorCount: newCount,
      };

      this.logger.error(
        `[rate-limit-cleanup] Nightly pruning failed (errorCount=${newCount}) — tables were NOT modified.`,
        err instanceof Error ? err.stack : String(err),
      );

      // ── On-call alert via Slack ───────────────────────────────────────────
      // Fire-and-forget; alert failure must not suppress the original error.
      void this.slackAlert
        .sendRawMessage(
          `🚨 *Rate-limit nightly cleanup failed* (attempt #${newCount})\n` +
          `The pruneStaleRows() job could not connect to the database or encountered an error.\n` +
          `Tables *throttle_hits* and *ip_failure_tracker* were NOT modified.\n` +
          `Check logs and \`GET /api/healthz/scheduler\` for details.`,
        )
        .catch((alertErr) => {
          this.logger.error("[rate-limit-cleanup] Slack alert also failed", alertErr);
        });
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
    const pool = this.poolFactory();
    // Threshold: everything older than (now - 60 s) is safe to remove.
    const cutoffMs = BigInt(Date.now()) - MAGIC_LINK_SAFETY_MS;
    const runAt = new Date().toISOString();

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

      // ── Record success ───────────────────────────────────────────────────────
      this.magicLinkHealth = {
        lastRunAt: runAt,
        lastSuccess: true,
        lastErrorInternal: null,
        errorCount: this.magicLinkHealth.errorCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const newCount = this.magicLinkHealth.errorCount + 1;

      this.magicLinkHealth = {
        lastRunAt: runAt,
        lastSuccess: false,
        lastErrorInternal: message,
        errorCount: newCount,
      };

      this.logger.error(
        `[magic-link-rate-cleanup] Hourly pruning failed (errorCount=${newCount}) — ip_magic_link_rate was NOT modified.`,
        err instanceof Error ? err.stack : String(err),
      );

      // ── On-call alert via Slack ───────────────────────────────────────────
      void this.slackAlert
        .sendRawMessage(
          `🚨 *Magic-link rate cleanup failed* (attempt #${newCount})\n` +
          `The pruneMagicLinkRateRows() job could not connect to the database or encountered an error.\n` +
          `Table *ip_magic_link_rate* was NOT modified.\n` +
          `Check logs and \`GET /api/healthz/scheduler\` for details.`,
        )
        .catch((alertErr) => {
          this.logger.error("[magic-link-rate-cleanup] Slack alert also failed", alertErr);
        });
    }
  }
}
