#!/usr/bin/env node
/**
 * Rollback for risk-seed-dedupe.migration.ts  (Phase 1 - data integrity)
 *
 * Committed BEFORE the forward migration, as the Phase 1 migration-safety
 * protocol requires. Reverses the two structural things the forward migration
 * does, in the order that keeps the table valid at every intermediate step.
 *
 * The forward migration is deliberately non-destructive: for each duplicate
 * group it copies the losing row into org_risks_dedupe_quarantine as a JSONB
 * snapshot of the whole record, and only then deletes it from org_risks. This
 * script replays those snapshots back with their original primary keys, so any
 * bookmarked /risks/:id URL or stored reference still resolves afterwards.
 *
 * What is NOT rolled back, by design:
 *
 *   The review_date backfill. The forward migration fills review_date only
 *   where it was NULL, computing created_at + 90 days. Reverting that would
 *   mean clearing review dates without being able to tell a backfilled value
 *   apart from one a user set to the same day, so the safe asymmetry is to
 *   leave it. Filling a NULL is additive; clearing a date a human may rely on
 *   is not. This is an accepted, documented limitation, not an oversight.
 *
 * Usage:
 *   node artifacts/api-server/scripts/rollback-risk-seed-dedupe.cjs
 *       Dry run. Prints exactly what would change and exits without writing.
 *
 *   node artifacts/api-server/scripts/rollback-risk-seed-dedupe.cjs --confirm
 *       Performs the restore inside a single transaction.
 *
 * Requires DATABASE_URL. Exit code 0 on success, 1 on failure.
 */

const { Client } = require("pg");

const UNIQUE_INDEX = "org_risks_org_title_uniq";
const QUARANTINE = "org_risks_dedupe_quarantine";

async function main() {
  const confirm = process.argv.includes("--confirm");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Refusing to run.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const tableExists = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = $1",
      [QUARANTINE],
    );

    if (tableExists.rowCount === 0) {
      console.log(
        `No ${QUARANTINE} table on this database, so the forward migration has ` +
          "never run here. Nothing to roll back.",
      );
      return;
    }

    const held = await client.query(`SELECT COUNT(*)::int AS n FROM ${QUARANTINE}`);
    const quarantinedRows = held.rows[0].n;

    const indexPresent = await client.query(
      "SELECT 1 FROM pg_indexes WHERE indexname = $1",
      [UNIQUE_INDEX],
    );

    const defaultPresent = await client.query(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = 'org_risks' AND column_name = 'review_date'`,
    );

    console.log("Rollback plan for risk-seed-dedupe");
    console.log(`  rows held in quarantine : ${quarantinedRows}`);
    console.log(`  unique index present    : ${indexPresent.rowCount > 0 ? "yes" : "no"}`);
    console.log(
      `  review_date default     : ${defaultPresent.rows[0] && defaultPresent.rows[0].column_default ? defaultPresent.rows[0].column_default : "none"}`,
    );

    if (!confirm) {
      console.log("");
      console.log("Dry run only. Re-run with --confirm to:");
      console.log(`  1. DROP INDEX IF EXISTS ${UNIQUE_INDEX}`);
      console.log("  2. ALTER TABLE org_risks ALTER COLUMN review_date DROP DEFAULT");
      console.log(`  3. restore ${quarantinedRows} row(s) from ${QUARANTINE} into org_risks`);
      console.log("  4. clear the restored rows out of the quarantine table");
      return;
    }

    await client.query("BEGIN");

    // The index has to go first. Restoring the duplicates is precisely the thing
    // it exists to forbid, so with it in place step 3 would abort.
    await client.query(`DROP INDEX IF EXISTS ${UNIQUE_INDEX}`);
    await client.query("ALTER TABLE org_risks ALTER COLUMN review_date DROP DEFAULT");

    // jsonb_populate_record rebuilds the row from the snapshot using org_risks'
    // own column types, so this stays correct if the table gains a column later:
    // an absent key simply comes back as NULL rather than shifting every value
    // one position left, which is what an explicit column list would risk.
    const restored = await client.query(
      `INSERT INTO org_risks
         SELECT (jsonb_populate_record(NULL::org_risks, q.row)).*
         FROM ${QUARANTINE} q
         WHERE NOT EXISTS (SELECT 1 FROM org_risks r WHERE r.id = q.original_id)`,
    );

    // Only clear what is now demonstrably back in org_risks. A snapshot whose
    // id somehow failed to reappear stays in quarantine for a human to look at.
    const cleared = await client.query(
      `DELETE FROM ${QUARANTINE} q
        WHERE EXISTS (SELECT 1 FROM org_risks r WHERE r.id = q.original_id)`,
    );

    await client.query("COMMIT");

    console.log("");
    console.log(`Restored ${restored.rowCount} row(s) into org_risks.`);
    console.log(`Cleared  ${cleared.rowCount} row(s) from ${QUARANTINE}.`);

    const remaining = await client.query(`SELECT COUNT(*)::int AS n FROM ${QUARANTINE}`);
    if (remaining.rows[0].n > 0) {
      console.log(
        `WARNING: ${remaining.rows[0].n} snapshot(s) could not be matched back and ` +
          "were left in quarantine. Inspect them before re-applying the migration.",
      );
    }
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_ignored) {
      // The transaction may never have opened; the original error is what matters.
    }
    console.error("Rollback failed, no changes committed:", err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
