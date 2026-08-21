#!/usr/bin/env node
/**
 * Rollback for fisma-fips199.migration.ts  (Phase 1c)
 *
 * Committed before the forward migration, as the migration-safety protocol
 * requires, and run in CI on the fresh-database job so that "there is a
 * rollback" is a test result rather than a claim.
 *
 * What the forward migration does, in full:
 *
 *   1. ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fips_199_impact TEXT
 *
 * That is the whole of it. One nullable column, no backfill, no index, no data
 * rewrite, nothing dropped. FISMA itself needs no schema: it is served as a
 * pass-through of the existing NIST SP 800-53 mappings, declared in code, so no
 * mapping rows are created and there is nothing about it to reverse.
 *
 * The reverse therefore drops one column. That is destructive by definition -
 * whatever impact level an operator recorded is lost - which is why it lives in
 * a script somebody has to run deliberately rather than in any automatic path.
 *
 * Usage:
 *   node artifacts/api-server/scripts/rollback-fisma-fips199.cjs --dry-run
 *   node artifacts/api-server/scripts/rollback-fisma-fips199.cjs --confirm
 *
 * --dry-run reports what would happen and changes nothing. It is the default:
 * running this script with no arguments does not drop anything.
 */

const { Client } = require("pg");

const DRY_RUN = !process.argv.includes("--confirm");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Refusing to guess a database.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const present = await client.query(
      "SELECT column_name FROM information_schema.columns " +
        "WHERE table_name = 'organizations' AND column_name = 'fips_199_impact'",
    );

    if (present.rowCount === 0) {
      console.log("organizations.fips_199_impact is not present. Nothing to reverse.");
      return;
    }

    const recorded = await client.query(
      "SELECT count(*)::int AS n FROM organizations WHERE fips_199_impact IS NOT NULL",
    );
    const n = recorded.rows[0].n;

    console.log("organizations.fips_199_impact exists.");
    console.log(n + " organisation(s) have an impact level recorded.");

    if (DRY_RUN) {
      console.log("");
      console.log("DRY RUN. Nothing was changed.");
      console.log("Dropping the column would discard those " + n + " value(s).");
      console.log("Re-run with --confirm to drop it.");
      return;
    }

    if (n > 0) {
      // Printed rather than exported to a file: this is a small, high-value set
      // and the operator running a rollback should see it, not find it later.
      const rows = await client.query(
        "SELECT id, slug, fips_199_impact FROM organizations " +
          "WHERE fips_199_impact IS NOT NULL ORDER BY id",
      );
      console.log("");
      console.log("Recording the values about to be lost:");
      for (const row of rows.rows) {
        console.log("  org " + row.id + " (" + row.slug + "): " + row.fips_199_impact);
      }
      console.log("");
    }

    // MIGRATION-APPROVED: reverse of the Phase 1c additive column. Runs only
    // under --confirm, never at boot, and the values it discards are printed
    // above first.
    await client.query("ALTER TABLE organizations DROP COLUMN IF EXISTS fips_199_impact");
    console.log("Dropped organizations.fips_199_impact.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Rollback failed:", err);
  process.exit(1);
});
