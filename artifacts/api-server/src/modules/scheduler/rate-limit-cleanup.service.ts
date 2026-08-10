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
 *   Additionally, if RESEND_API_KEY is set and consecutive failures reach
 *   SCHEDULER_ALERT_THRESHOLD (default 2), an email alert is sent via Resend.
 *
 * Health tracking:
 *   Both cron methods record their last-run outcome in memory AND persist to the
 *   scheduler_job_health DB table.  On startup (OnModuleInit), persisted state is
 *   loaded so /healthz/scheduler survives process restarts.
 *   The pool factory is overridable via _setPoolFactory() so tests can inject a
 *   broken pool and exercise the real catch paths without subclassing.
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Pool } from "pg";
import { getRateLimitPool } from "../../lib/pg-pool.js";
import { SlackAlertService } from "../notifications/slack-alert.service.js";
import {
  THROTTLE_HITS_CAP_SQL,
  IP_FAILURE_CAP_SQL,
  THROTTLE_HITS_PRUNE_SQL,
  IP_FAILURE_PRUNE_SQL,
  EMAIL_MAGIC_LINK_PRUNE_SQL,
} from "./cleanup-sql.js";

// Safety buffer for magic-link rows: 60 seconds past full expiry.
const MAGIC_LINK_SAFETY_MS = BigInt(60 * 1000);

// ── Alert thresholds ────────────────────────────────────────────────────────
const ALERT_THRESHOLD = Number(process.env.SCHEDULER_ALERT_THRESHOLD ?? 2);
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between duplicate alerts

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

/** Persisted health loaded from DB at startup. */
interface PersistedJobHealth {
  consecutiveFailures: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

@Injectable()
export class RateLimitCleanupService implements OnModuleInit {
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

  // ── Persisted health (loaded at startup) ──────────────────────────────────

  private persistedHealth: Map<string, PersistedJobHealth> = new Map();

  // ── Alert deduplication: lastAlertSentAt per job ──────────────────────────

  private lastAlertSentAt: Map<string, number> = new Map();

  private readonly slackAlert: SlackAlertService;
  constructor(slackAlert: SlackAlertService) {
    this.slackAlert = slackAlert;
  }

  async onModuleInit(): Promise<void> {
    await this.loadPersistedHealth();
  }

  /**
   * Load persisted job health from DB into memory at startup.
   * This ensures /healthz/scheduler reflects the true last-known state
   * even after a process restart.
   */
  private async loadPersistedHealth(): Promise<void> {
    try {
      const pool = this.poolFactory();
      // Ensure the table exists (idempotent).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scheduler_job_health (
          job_name TEXT PRIMARY KEY,
          last_run_at TIMESTAMPTZ,
          last_success_at TIMESTAMPTZ,
          consecutive_failures INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const { rows } = await pool.query<{
        job_name: string;
        last_run_at: string | null;
        last_success_at: string | null;
        consecutive_failures: number;
        last_error: string | null;
      }>(`SELECT job_name, last_run_at, last_success_at, consecutive_failures, last_error FROM scheduler_job_health`);

      for (const row of rows) {
        this.persistedHealth.set(row.job_name, {
          consecutiveFailures: row.consecutive_failures,
          lastRunAt: row.last_run_at,
          lastSuccessAt: row.last_success_at,
          lastError: row.last_error,
        });
      }

      // Seed in-memory state from DB so getHealth() is accurate immediately.
      const nightly = this.persistedHealth.get("rate-limit-cleanup-nightly");
      if (nightly) {
        this.nightlyHealth = {
          lastRunAt: nightly.lastRunAt,
          lastSuccess: nightly.consecutiveFailures === 0 && nightly.lastRunAt !== null
            ? true
            : nightly.consecutiveFailures > 0 ? false : null,
          lastErrorInternal: nightly.lastError,
          errorCount: nightly.consecutiveFailures,
        };
      }

      const magicLink = this.persistedHealth.get("magic-link-rate-cleanup-hourly");
      if (magicLink) {
        this.magicLinkHealth = {
          lastRunAt: magicLink.lastRunAt,
          lastSuccess: magicLink.consecutiveFailures === 0 && magicLink.lastRunAt !== null
            ? true
            : magicLink.consecutiveFailures > 0 ? false : null,
          lastErrorInternal: magicLink.lastError,
          errorCount: magicLink.consecutiveFailures,
        };
      }

      this.logger.log(`[scheduler-health] Loaded persisted health for ${rows.length} job(s) from DB`);
    } catch (err) {
      // Non-fatal — health will degrade to in-memory only
      this.logger.warn(
        `[scheduler-health] Could not load persisted health from DB (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Persist job health state to scheduler_job_health table.
   * Called after every job run, success or failure.
   */
  private async persistJobHealth(jobName: string, success: boolean, error?: string): Promise<void> {
    try {
      const pool = this.poolFactory();
      const errorText = error ?? null;
      await pool.query(
        `INSERT INTO scheduler_job_health (job_name, last_run_at, last_success_at, consecutive_failures, last_error, updated_at)
         VALUES ($1, NOW(), CASE WHEN $2 THEN NOW() ELSE NULL END, CASE WHEN $2 THEN 0 ELSE 1 END, $3, NOW())
         ON CONFLICT (job_name) DO UPDATE SET
           last_run_at = NOW(),
           last_success_at = CASE WHEN $2 THEN NOW() ELSE scheduler_job_health.last_success_at END,
           consecutive_failures = CASE WHEN $2 THEN 0 ELSE scheduler_job_health.consecutive_failures + 1 END,
           last_error = $3,
           updated_at = NOW()`,
        [jobName, success, errorText],
      );

      // Refresh our local cache of persisted state.
      const { rows } = await pool.query<{
        consecutive_failures: number;
        last_run_at: string | null;
        last_success_at: string | null;
        last_error: string | null;
      }>(
        `SELECT consecutive_failures, last_run_at, last_success_at, last_error FROM scheduler_job_health WHERE job_name = $1`,
        [jobName],
      );
      if (rows[0]) {
        this.persistedHealth.set(jobName, {
          consecutiveFailures: rows[0].consecutive_failures,
          lastRunAt: rows[0].last_run_at,
          lastSuccessAt: rows[0].last_success_at,
          lastError: rows[0].last_error,
        });
      }
    } catch (persistErr) {
      this.logger.warn(
        `[scheduler-health] Failed to persist job health for ${jobName}: ${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
      );
    }
  }

  /**
   * Send an email alert via Resend if consecutive failures exceed threshold.
   * Deduplicates: skips if an alert was already sent within the last hour.
   */
  private async sendEmailAlertIfNeeded(jobName: string, consecutiveFailures: number, error: string): Promise<void> {
    if (consecutiveFailures < ALERT_THRESHOLD) return;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      this.logger.warn(
        `[scheduler-alert] WARNING: ${jobName} has failed ${consecutiveFailures} consecutive times but RESEND_API_KEY is not set — cannot send email alert.`,
      );
      return;
    }

    const now = Date.now();
    const lastSent = this.lastAlertSentAt.get(jobName) ?? 0;
    if (now - lastSent < ALERT_COOLDOWN_MS) {
      this.logger.log(`[scheduler-alert] Skipping duplicate alert for ${jobName} (last sent < 1 hour ago)`);
      return;
    }

    const alertTo = process.env.ALERT_EMAIL || process.env.RESEND_FROM_EMAIL;
    if (!alertTo) {
      this.logger.warn(`[scheduler-alert] No ALERT_EMAIL or RESEND_FROM_EMAIL set — cannot send alert for ${jobName}`);
      return;
    }

    const subject = `🚨 Scheduler Alert: ${jobName} failed ${consecutiveFailures} consecutive times`;
    const body = [
      `Job: ${jobName}`,
      `Consecutive failures: ${consecutiveFailures}`,
      `Last error: ${error}`,
      `Timestamp: ${new Date().toISOString()}`,
      ``,
      `Recommendation: Check /healthz/scheduler for current status and review application logs.`,
    ].join("\n");

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "alerts@grc.colorcodesolutions.com",
          to: alertTo,
          subject,
          text: body,
        }),
      });

      if (response.ok) {
        this.lastAlertSentAt.set(jobName, now);
        this.logger.log(`[scheduler-alert] Email alert sent for ${jobName} to ${alertTo}`);
      } else {
        const text = await response.text();
        this.logger.error(`[scheduler-alert] Resend API returned ${response.status}: ${text}`);
      }
    } catch (alertErr) {
      this.logger.error(
        `[scheduler-alert] Failed to send email alert for ${jobName}: ${alertErr instanceof Error ? alertErr.message : String(alertErr)}`,
      );
    }
  }

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
   *
   * Uses persisted consecutiveFailures as the source of truth for errorCount
   * (survives process restarts), while lastRunAt and lastSuccess reflect the
   * most recent in-memory run merged with startup-loaded persisted state.
   */
  getHealth(): SchedulerHealth {
    const toPublic = (h: InternalJobHealth, jobName: string): CleanupJobHealth => {
      const persisted = this.persistedHealth.get(jobName);
      // Use persisted consecutive_failures as source of truth
      // Use persisted count if available and defined; fall back to in-memory count.
      const errorCount = persisted?.consecutiveFailures ?? h.errorCount;
      return {
        lastRunAt: h.lastRunAt,
        lastSuccess: h.lastSuccess,
        failed: h.lastSuccess === false,
        errorCount,
      };
    };

    const nightly = toPublic(this.nightlyHealth, "rate-limit-cleanup-nightly");
    const magicLinkHourly = toPublic(this.magicLinkHealth, "magic-link-rate-cleanup-hourly");

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
   *
   * Also enforces safety caps to prevent unbounded table growth regardless
   * of cron health.
   */
  @Cron("0 3 * * *", { name: "rate-limit-cleanup-nightly" })
  async pruneStaleRows(): Promise<void> {
    const pool = this.poolFactory();
    const oneDayAgoMs = BigInt(Date.now()) - BigInt(24 * 60 * 60 * 1000);
    const runAt = new Date().toISOString();
    const JOB_NAME = "rate-limit-cleanup-nightly";

    this.logger.log("[rate-limit-cleanup] Starting nightly stale-row pruning …");

    try {
      // ── Safety cap: never let tables grow past hard limits regardless of cron health ──
      // These caps run BEFORE the time-based cleanup so that even if the nightly
      // job has been failing, the tables cannot accumulate indefinitely.

      // Cap throttle_hits at 100,000 rows — delete oldest first.
      await pool.query(
        THROTTLE_HITS_CAP_SQL,
      );

      // Cap ip_failure_tracker at 50,000 rows — delete oldest first.
      await pool.query(
        IP_FAILURE_CAP_SQL,
      );

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
        THROTTLE_HITS_PRUNE_SQL,
        [oneDayAgoMs],
      );
      const throttleDeleted = throttleResult.rows[0]?.count ?? "0";

      // ── ip_failure_tracker ───────────────────────────────────────────────────
      // Delete rows where:
      //   • blocked_until < now() - 1 day  (block well expired), AND
      //   • window_start  < now() - 1 day  (failure window also well expired)
      // This guarantees no active block or live window is removed.
      const ipResult = await pool.query<{ count: string }>(
        IP_FAILURE_PRUNE_SQL,
        [oneDayAgoMs],
      );
      const ipDeleted = ipResult.rows[0]?.count ?? "0";

    // Per-email magic-link windows are persisted too, so they need pruning
    // on the same schedule or the table grows for the life of the product.
    const emailRateResult = await pool.query<{ count: string }>(
      EMAIL_MAGIC_LINK_PRUNE_SQL,
      [oneDayAgoMs],
    );
    const emailRateDeleted = emailRateResult.rows[0]?.count ?? "0";
    void emailRateDeleted;

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

      // Persist success to DB (Task A).
      await this.persistJobHealth(JOB_NAME, true);
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

      // ── Persist failure to DB (Task A) ──────────────────────────────────────
      await this.persistJobHealth(JOB_NAME, false, message);

      // ── On-call email alert (Task B) ─────────────────────────────────────────
      // Get the up-to-date consecutive failures from persisted state.
      const persisted = this.persistedHealth.get(JOB_NAME);
      const consecutiveFailures = persisted ? persisted.consecutiveFailures : newCount;
      void this.sendEmailAlertIfNeeded(JOB_NAME, consecutiveFailures, message);

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
    const JOB_NAME = "magic-link-rate-cleanup-hourly";

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

      // Persist success to DB (Task A).
      await this.persistJobHealth(JOB_NAME, true);
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

      // ── Persist failure to DB (Task A) ──────────────────────────────────────
      await this.persistJobHealth(JOB_NAME, false, message);

      // ── On-call email alert (Task B) ─────────────────────────────────────────
      const persisted = this.persistedHealth.get(JOB_NAME);
      const consecutiveFailures = persisted ? persisted.consecutiveFailures : newCount;
      void this.sendEmailAlertIfNeeded(JOB_NAME, consecutiveFailures, message);

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
