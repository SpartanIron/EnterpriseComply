/**
 * magic-link-rate-sql.ts
 *
 * Dependency-free home for the per-email magic-link rate limit: its thresholds,
 * its SQL and its decision rule.
 *
 * It deliberately imports nothing. The regression suite can therefore load it
 * directly and drive the exact statements production runs, instead of
 * re-implementing them and drifting away from the real behaviour.
 */

/** Max magic-link sends per address per window. */
export const EMAIL_LIMIT = 3;

/** Rolling window for the per-address limit. */
export const EMAIL_WINDOW_MS = 10 * 60 * 1000;

export const EMAIL_RATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS email_magic_link_rate (
    email        TEXT    PRIMARY KEY,
    count        INTEGER NOT NULL DEFAULT 0,
    window_start BIGINT  NOT NULL
  )`;

/**
 * $1 = normalised address, $2 = now (epoch-ms), $3 = window length (ms).
 *
 * One atomic statement: the window either rolls over or the counter increments,
 * so two concurrent requests can never both slip past the limit, and every
 * replica shares the same state.
 */
export const EMAIL_RATE_UPSERT_SQL = `
  INSERT INTO email_magic_link_rate (email, count, window_start)
  VALUES ($1, 1, $2)
  ON CONFLICT (email) DO UPDATE SET
    count = CASE
      WHEN $2 - email_magic_link_rate.window_start > $3 THEN 1
      ELSE email_magic_link_rate.count + 1
    END,
    window_start = CASE
      WHEN $2 - email_magic_link_rate.window_start > $3 THEN $2
      ELSE email_magic_link_rate.window_start
    END
  RETURNING count, window_start::text AS window_start`;

/** $1 = normalised address. */
export const EMAIL_RATE_DELETE_SQL = `DELETE FROM email_magic_link_rate WHERE email = $1`;

/** Addresses are compared case-insensitively and trimmed, so variants share one quota. */
export function normaliseRateLimitEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** The single decision rule, shared by the limiter and its tests. */
export function isEmailRateBlocked(
  count: number,
  windowStartMs: number,
  nowMs: number = Date.now(),
): { blocked: boolean; retryAfterMs: number } {
  if (count > EMAIL_LIMIT) {
    return {
      blocked: true,
      retryAfterMs: Math.max(0, windowStartMs + EMAIL_WINDOW_MS - nowMs),
    };
  }
  return { blocked: false, retryAfterMs: 0 };
}
