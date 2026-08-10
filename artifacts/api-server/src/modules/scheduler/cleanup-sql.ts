/**
 * cleanup-sql.ts
 *
 * Single source of truth for the SQL that the rate-limit cleanup jobs run.
 *
 * These statements live here, rather than inline in the service, so the
 * regression suite can EXPLAIN every one of them against the real schema.
 * A column rename can therefore never again silently break the nightly job
 * in production while the tests keep passing against re-implemented SQL.
 *
 * Schema reminder (both tables store epoch-ms in BIGINT columns):
 *   throttle_hits       PK (key, throttler_name)  expire_at, block_expire_at, total_hits
 *   ip_failure_tracker  PK (ip)                   count, window_start, blocked_until
 * Neither table has a surrogate `id`, a `created_at` or a `last_attempt_at`.
 */

export const THROTTLE_HITS_ROW_CAP = 100000;
export const IP_FAILURE_ROW_CAP = 50000;

/**
 * Hard row cap on throttle_hits. Evicts the most-expired rows first so an
 * active window or an active block is the last thing to ever be dropped.
 */
export const THROTTLE_HITS_CAP_SQL = `
  DELETE FROM throttle_hits
   WHERE (key, throttler_name) IN (
     SELECT key, throttler_name FROM throttle_hits
      ORDER BY GREATEST(expire_at, block_expire_at) ASC
      LIMIT GREATEST(0, (SELECT COUNT(*) FROM throttle_hits) - ${THROTTLE_HITS_ROW_CAP})
   )`;

/** Hard row cap on ip_failure_tracker, most-expired first. */
export const IP_FAILURE_CAP_SQL = `
  DELETE FROM ip_failure_tracker
   WHERE ip IN (
     SELECT ip FROM ip_failure_tracker
      ORDER BY GREATEST(window_start, blocked_until) ASC
      LIMIT GREATEST(0, (SELECT COUNT(*) FROM ip_failure_tracker) - ${IP_FAILURE_ROW_CAP})
   )`;

/**
 * $1 = cutoff epoch-ms. A row is only removed when BOTH its rate-limit window
 * and its block have expired before the cutoff, so an active block is never
 * lifted early.
 */
export const THROTTLE_HITS_PRUNE_SQL = `
  WITH deleted AS (
    DELETE FROM throttle_hits
     WHERE expire_at       < $1
       AND block_expire_at < $1
    RETURNING 1
  )
  SELECT count(*)::text AS count FROM deleted`;

/** $1 = cutoff epoch-ms. Same both-expired guarantee as above. */
export const IP_FAILURE_PRUNE_SQL = `
  WITH deleted AS (
    DELETE FROM ip_failure_tracker
     WHERE blocked_until < $1
       AND window_start  < $1
    RETURNING 1
  )
  SELECT count(*)::text AS count FROM deleted`;

/**
 * $1 = cutoff epoch-ms. The per-email magic-link window is 10 minutes, so a
 * window that started before the cutoff is long expired and safe to drop.
 */
export const EMAIL_MAGIC_LINK_PRUNE_SQL = `
  WITH deleted AS (
    DELETE FROM email_magic_link_rate
     WHERE window_start < $1
    RETURNING 1
  )
  SELECT count(*)::text AS count FROM deleted`;

/** Every maintenance statement, for schema-contract testing. */
export const SCHEDULER_MAINTENANCE_SQL: {
  name: string;
  sql: string;
  params: unknown[];
}[] = [
  { name: "throttle_hits row cap", sql: THROTTLE_HITS_CAP_SQL, params: [] },
  { name: "ip_failure_tracker row cap", sql: IP_FAILURE_CAP_SQL, params: [] },
  { name: "throttle_hits nightly prune", sql: THROTTLE_HITS_PRUNE_SQL, params: ["0"] },
  { name: "ip_failure_tracker nightly prune", sql: IP_FAILURE_PRUNE_SQL, params: ["0"] },
  { name: "email magic-link rate prune", sql: EMAIL_MAGIC_LINK_PRUNE_SQL, params: ["0"] },
];
