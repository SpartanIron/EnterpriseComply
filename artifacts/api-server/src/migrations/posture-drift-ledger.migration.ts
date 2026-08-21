import { sql } from "drizzle-orm";

/**
 * Durable drift ledger. Phase 1c.
 *
 * The Phase 1 exit criterion was "a dashboard, not a memory". What shipped was a
 * process-memory ring buffer, which is a memory: it resets on every deploy, and
 * a deploy is exactly when a computation is most likely to start disagreeing
 * with the one it replaced. This table is the missing half.
 *
 * Additive and idempotent: one CREATE TABLE IF NOT EXISTS and two indexes.
 * Nothing existing is altered. The reverse is
 * scripts/rollback-posture-drift-ledger.cjs, committed before this file.
 *
 * Write volume is deliberately not one row per request. See recordPostureDrift
 * in lib/posture-drift.ts: every observation with drift is written, and clean
 * observations at most once per heartbeat interval per org. A ledger that
 * inserted on every dashboard poll would measure traffic, not drift.
 */
export async function runPostureDriftLedgerMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS posture_drift_observations (
      id                    SERIAL PRIMARY KEY,
      org_id                INTEGER NOT NULL,
      observed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      schema                TEXT NOT NULL,
      divergence_count      INTEGER NOT NULL DEFAULT 0,
      divergences           JSONB NOT NULL DEFAULT '[]'::jsonb,
      unrecognised_statuses JSONB NOT NULL DEFAULT '{}'::jsonb,
      orphaned_results      INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS posture_drift_org_time_idx
        ON posture_drift_observations (org_id, observed_at DESC)`,
  );

  // Partial index: the interesting rows are the ones with drift, and they are
  // the minority. Reading "has this org ever drifted" should not scan the clean
  // heartbeats.
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS posture_drift_drifted_idx
        ON posture_drift_observations (org_id, observed_at DESC)
        WHERE divergence_count > 0`,
  );
}
