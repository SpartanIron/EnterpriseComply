#!/usr/bin/env node
/**
 * Rollback for posture-drift-ledger.migration.ts  (Phase 1c)
 *
 * Committed before the forward migration and exercised as a dry run in CI.
 *
 * The forward migration creates one table, posture_drift_observations, and two
 * indexes on it. It alters nothing that existed before, so the reverse is a
 * single DROP TABLE.
 *
 * That drop is destructive in a way worth stating plainly: the table is the only
 * durable record of when the posture computation disagreed with the legacy
 * figures. Losing it does not affect any score, but it does lose the evidence
 * that drift was being watched, which is the reason the ledger exists.
 *
 * Usage:
 *   node artifacts/api-server/scripts/rollback-posture-drift-ledger.cjs --dry-run
 *   node artifacts/api-server/scripts/rollback-posture-drift-ledger.cjs --confirm
 *
 * Dry run is the default. Running with no arguments drops nothing.
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
      "SELECT to_regclass('public.posture_drift_observations') AS t",
    );
    if (!present.rows[0].t) {
      console.log("posture_drift_observations does not exist. Nothing to reverse.");
      return;
    }

    const counted = await client.query(
      "SELECT count(*)::int AS n, " +
        "count(*) FILTER (WHERE divergence_count > 0)::int AS drifted, " +
        "min(observed_at) AS first_seen, max(observed_at) AS last_seen " +
        "FROM posture_drift_observations",
    );
    const row = counted.rows[0];

    console.log("posture_drift_observations exists.");
    console.log("  observations: " + row.n);
    console.log("  with drift:   " + row.drifted);
    console.log("  first seen:   " + (row.first_seen || "none"));
    console.log("  last seen:    " + (row.last_seen || "none"));

    if (DRY_RUN) {
      console.log("");
      console.log("DRY RUN. Nothing was changed.");
      console.log("Dropping the table would discard " + row.n + " observation(s).");
      console.log("Re-run with --confirm to drop it.");
      return;
    }

    // MIGRATION-APPROVED: reverse of the Phase 1c drift ledger. Runs only under
    // --confirm, never at boot. The counts it discards are printed above first.
    await client.query("DROP TABLE IF EXISTS posture_drift_observations");
    console.log("Dropped posture_drift_observations.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Rollback failed:", err);
  process.exit(1);
});
