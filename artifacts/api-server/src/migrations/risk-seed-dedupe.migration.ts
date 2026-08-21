import { sql } from "drizzle-orm";

/**
 * Phase 1 - collapse the duplicated common-risk seed and make it un-repeatable.
 *
 * WHY THIS EXISTS
 *
 * StartupService.seedCommonRisks() inserts twenty common risks per organization
 * on every boot. It reads a COUNT(*) into riskCnt and then never looks at it,
 * and its per-row try/catch is labelled "skip duplicates" even though nothing in
 * the schema makes a duplicate an error. Its two immediate neighbours,
 * seedSubProcessors() and seedComplianceCalendar(), both end their count check
 * with "if (cnt > 0) continue;". That one line is the whole difference, and its
 * absence is why org 1 accumulated 560 rows: 20 titles times 28 boots.
 *
 * WHAT THIS DOES, IN EXPAND-CONTRACT ORDER
 *
 *   1. expand   - create the quarantine table that holds the rows we remove
 *   2. expand   - snapshot every losing duplicate into it as JSONB
 *   3. contract - delete the snapshotted rows from org_risks
 *   4. expand   - backfill the review_date nobody was ever given
 *   5. expand   - give review_date a default so new rows always have one
 *   6. contract - add the uniqueness the seed always assumed it had
 *   7. expand   - record a seed marker per org so the seeder stands down
 *
 * No step destroys data. Step 3 only removes ids that step 2 has already
 * snapshotted, so rollback-risk-seed-dedupe.cjs can put every one of them back
 * with its original primary key. Step 6 is skipped, not failed, if duplicates
 * somehow survive, because a boot that cannot serve traffic is worse than a
 * boot that leaves the index for the next attempt.
 *
 * Every statement is idempotent. Running it twice changes nothing the second
 * time, which is the property that matters most here: this runs on every boot.
 *
 * WHICH ROW SURVIVES A DUPLICATE GROUP
 *
 * Preference goes to any row that shows a human touched it - a status other
 * than 'open', an owner email, a due date, a review date, or an updated_at that
 * has moved away from created_at. Only when no row in the group looks edited
 * does the oldest id win. The seed writes identical values every time, so in
 * practice the groups are indistinguishable and the oldest row survives; the
 * curation test exists so that the one org where somebody did triage a risk
 * does not silently lose that work.
 */

const UNIQUE_INDEX = "org_risks_org_title_uniq";

export interface RiskSeedDedupeResult {
  quarantined: number;
  deleted: number;
  reviewDatesBackfilled: number;
  uniqueIndexPresent: boolean;
  remainingDuplicateGroups: number;
  seedMarkersInserted: number;
}

function rowCount(result: unknown): number {
  const r = result as { rowCount?: number | null; rows?: unknown[] };
  if (typeof r?.rowCount === "number") return r.rowCount;
  if (Array.isArray(r?.rows)) return r.rows.length;
  return 0;
}

function firstNumber(result: unknown, key: string): number {
  const r = result as { rows?: Array<Record<string, unknown>> };
  const rows = Array.isArray(r?.rows) ? r.rows : (result as Array<Record<string, unknown>>);
  const value = Array.isArray(rows) && rows.length > 0 ? rows[0][key] : 0;
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function runRiskSeedDedupeMigration(db: any): Promise<RiskSeedDedupeResult> {
  // 1. EXPAND - the quarantine table. Holds a whole-row JSONB snapshot so a
  // restore does not depend on org_risks still having the same columns.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_risks_dedupe_quarantine (
      id             BIGSERIAL PRIMARY KEY,
      original_id    INTEGER NOT NULL,
      org_id         INTEGER NOT NULL,
      title          TEXT NOT NULL,
      row            JSONB NOT NULL,
      quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // The unique index on original_id is what makes step 2 idempotent.
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS org_risks_dedupe_quarantine_original_idx
        ON org_risks_dedupe_quarantine (original_id)`,
  );

  // Present in MIGRATION_SQL already; created defensively so this migration is
  // also correct when run against a database that predates it.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_risks_seeded (
      id        SERIAL PRIMARY KEY,
      org_id    INTEGER NOT NULL UNIQUE,
      seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 2. EXPAND - snapshot the losers. Titles are compared case-folded and
  // trimmed, matching the uniqueness rule added in step 6, so the two can never
  // disagree about what counts as a duplicate.
  const quarantined = await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        org_id,
        title,
        ROW_NUMBER() OVER (
          PARTITION BY org_id, LOWER(BTRIM(title))
          ORDER BY
            CASE
              WHEN status <> 'open'
                OR owner_email IS NOT NULL
                OR due_date IS NOT NULL
                OR review_date IS NOT NULL
                OR updated_at > created_at + INTERVAL '1 second'
              THEN 0
              ELSE 1
            END,
            id
        ) AS rn
      FROM org_risks
    )
    INSERT INTO org_risks_dedupe_quarantine (original_id, org_id, title, row)
    SELECT ranked.id, ranked.org_id, ranked.title, to_jsonb(org_risks)
    FROM ranked
    JOIN org_risks ON org_risks.id = ranked.id
    WHERE ranked.rn > 1
    ON CONFLICT (original_id) DO NOTHING
  `);

  // 3. CONTRACT - remove exactly what step 2 preserved, nothing else.
  // MIGRATION-APPROVED: deletes only ids already snapshotted into
  // org_risks_dedupe_quarantine by the statement above; reversed by
  // scripts/rollback-risk-seed-dedupe.cjs.
  const deleted = await db.execute(sql`
    DELETE FROM org_risks
    WHERE id IN (SELECT original_id FROM org_risks_dedupe_quarantine)
  `);

  // 4. EXPAND - backfill review_date. Runs after the collapse so it only ever
  // touches surviving rows, and after nothing else, so the curation test in
  // step 2 was not reading dates this migration had just written.
  const backfilled = await db.execute(sql`
    UPDATE org_risks
    SET review_date = created_at + INTERVAL '90 days'
    WHERE review_date IS NULL
  `);

  // 5. EXPAND - a default, so a row created without a review date still gets
  // one. Deliberately not NOT NULL: the create-risk API does not send the field
  // yet, and adding the constraint before the writer sends it is how an
  // expand-contract migration turns into an outage.
  await db.execute(
    sql`ALTER TABLE org_risks ALTER COLUMN review_date SET DEFAULT NOW() + INTERVAL '90 days'`,
  );

  // 6. CONTRACT - the uniqueness the seed always assumed. Checked first, so a
  // group this migration could not collapse leaves the index absent rather than
  // aborting startup.
  const remaining = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT 1 FROM org_risks GROUP BY org_id, LOWER(BTRIM(title)) HAVING COUNT(*) > 1
    ) duplicate_groups
  `);
  const remainingDuplicateGroups = firstNumber(remaining, "cnt");

  if (remainingDuplicateGroups === 0) {
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS org_risks_org_title_uniq
          ON org_risks (org_id, LOWER(BTRIM(title)))`,
    );
  }

  const indexPresent = await db.execute(
    sql`SELECT COUNT(*)::int AS cnt FROM pg_indexes WHERE indexname = ${UNIQUE_INDEX}`,
  );

  // 7. EXPAND - mark every org that already has risks as seeded, so the fixed
  // seeder stands down for them instead of re-deriving that from a row count.
  const markers = await db.execute(sql`
    INSERT INTO org_risks_seeded (org_id)
    SELECT DISTINCT org_id FROM org_risks
    ON CONFLICT (org_id) DO NOTHING
  `);

  return {
    quarantined: rowCount(quarantined),
    deleted: rowCount(deleted),
    reviewDatesBackfilled: rowCount(backfilled),
    uniqueIndexPresent: firstNumber(indexPresent, "cnt") > 0,
    remainingDuplicateGroups,
    seedMarkersInserted: rowCount(markers),
  };
}
