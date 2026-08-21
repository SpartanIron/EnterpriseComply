#!/usr/bin/env node
/**
 * Rollback for mapping-consolidation.migration.ts  (Phase 1b)
 *
 * Committed BEFORE the forward migration, as the Phase 1 migration-safety
 * protocol requires, and exercised in CI on every run of the fresh-database
 * job so that "we have a rollback" is a test result rather than a claim.
 *
 * The forward migration is additive only. It adds three columns, backfills two
 * of them on rows that already existed, creates one unique index, and inserts
 * rows that carry mapping_source = 'dod-sprs-methodology'. It deletes nothing
 * and it rewrites no pre-existing identifier. That is what makes the reverse
 * safe: the reverse only ever removes things the forward step created.
 *
 * Reversal order is the mirror of application order, so the table is valid at
 * every intermediate step:
 *
 *   1. delete the relocated rows, identified by mapping_source, never by
 *      framework_key - deleting by framework would take the ten catalog rows
 *      with them
 *   2. drop the unique index
 *   3. drop the three added columns
 *
 * What is NOT rolled back, by design:
 *
 *   Nothing. Unlike the risk-seed rollback there is no backfill of a column
 *   that existed beforehand, because scoring_control_id and framework_revision
 *   are themselves new. Dropping the columns discards the backfill with them,
 *   which is exactly correct.
 *
 * The source-level half of expand-contract - deleting UCO_TO_NIST_MAP from
 * sprs.service.ts - is reverted by redeploying the previous image, not by this
 * script. The forward migration is additive, so the previous image runs
 * correctly against the migrated schema. That ordering is deliberate: it means
 * a bad deploy is recoverable by a Railway rollback alone, with no database
 * step and no window in which code and schema disagree.
 *
 * Usage:
 *   node scripts/rollback-mapping-consolidation.cjs            # dry run
 *   node scripts/rollback-mapping-consolidation.cjs --confirm  # apply
 */

const { Client } = require("pg");

const TABLE = "uco_framework_mappings";
const UNIQUE_INDEX = "uco_framework_mappings_triple_uniq";
const RELOCATED_SOURCE = "dod-sprs-methodology";
const ADDED_COLUMNS = ["framework_revision", "scoring_control_id", "mapping_source"];

async function columnExists(client, column) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    [TABLE, column],
  );
  return res.rowCount > 0;
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Refusing to run.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const hasSourceColumn = await columnExists(client, "mapping_source");

    if (!hasSourceColumn) {
      console.log(
        "No mapping_source column on " + TABLE + ", so the forward migration " +
          "has never run against this database. Nothing to roll back.",
      );
      return;
    }

    const relocated = await client.query(
      "SELECT COUNT(*)::int AS n FROM " + TABLE + " WHERE mapping_source = $1",
      [RELOCATED_SOURCE],
    );
    const relocatedRows = relocated.rows[0].n;

    const retained = await client.query(
      "SELECT COUNT(*)::int AS n FROM " + TABLE + " WHERE mapping_source IS DISTINCT FROM $1",
      [RELOCATED_SOURCE],
    );
    const retainedRows = retained.rows[0].n;

    const indexPresent = await client.query(
      "SELECT 1 FROM pg_indexes WHERE indexname = $1",
      [UNIQUE_INDEX],
    );

    console.log("Rollback plan for " + TABLE + ":");
    console.log("  relocated rows to delete : " + relocatedRows);
    console.log("  rows to leave untouched  : " + retainedRows);
    console.log("  unique index to drop     : " + (indexPresent.rowCount ? UNIQUE_INDEX : "absent"));
    console.log("  columns to drop          : " + ADDED_COLUMNS.join(", "));

    if (!confirm) {
      console.log("");
      console.log("Dry run. Re-run with --confirm to apply.");
      return;
    }

    await client.query("BEGIN");

    // 1. Remove only what the forward migration inserted. Scoping on
    //    mapping_source rather than framework_key is the whole safety property
    //    here: the ten catalog rows for nist-800-171 share the framework but
    //    not the source, and they must survive.
    const deleted = await client.query(
      "DELETE FROM " + TABLE + " WHERE mapping_source = $1",
      [RELOCATED_SOURCE],
    );

    // 2. Drop the index before the columns it does not depend on, so that a
    //    failure between the two leaves a table with no partially-enforced
    //    constraint.
    await client.query("DROP INDEX IF EXISTS " + UNIQUE_INDEX);

    // 3. Drop the added columns last. Postgres handles this transactionally,
    //    so an error here rolls the deletion back with it.
    for (const column of ADDED_COLUMNS) {
      await client.query("ALTER TABLE " + TABLE + " DROP COLUMN IF EXISTS " + column);
    }

    const remaining = await client.query("SELECT COUNT(*)::int AS n FROM " + TABLE);

    if (remaining.rows[0].n !== retainedRows) {
      await client.query("ROLLBACK");
      console.error(
        "Row count after rollback is " + remaining.rows[0].n + " but " +
          retainedRows + " rows were expected to remain. Rolled back, nothing changed.",
      );
      process.exit(1);
    }

    await client.query("COMMIT");

    console.log("");
    console.log("Rolled back.");
    console.log("  deleted " + deleted.rowCount + " relocated rows");
    console.log("  " + remaining.rows[0].n + " rows remain, matching the pre-migration count");
    console.log("");
    console.log(
      "Redeploy the pre-Phase-1b image to restore the code that reads the " +
        "hardcoded map. The schema is now back to its original shape, so that " +
        "image will run against it unchanged.",
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* the connection may already be gone; the transaction is discarded either way */
    }
    console.error("Rollback failed, nothing was changed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
