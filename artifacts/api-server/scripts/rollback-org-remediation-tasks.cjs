#!/usr/bin/env node
/**
 * Rollback for the org_remediation_tasks table created by
 * src/migrations/remediation-tasks.migration.ts.
 *
 * Written and committed before the forward migration, because a schema change
 * is not ready until the way back is runnable by someone who did not write it.
 *
 * The default is a dry run: it reports what it found and exits 0 without
 * touching the schema. --confirm performs the drop.
 *
 * This table holds remediation tasks a customer typed by hand, so dropping it
 * destroys their work. The script always prints the row count first, and
 * refuses to drop a non-empty table unless --force is also supplied.
 *
 *   node scripts/rollback-org-remediation-tasks.cjs
 *   node scripts/rollback-org-remediation-tasks.cjs --confirm
 *   node scripts/rollback-org-remediation-tasks.cjs --confirm --force
 */

const { Client } = require("pg");

const TABLE = "org_remediation_tasks";
const INDEXES = [
  "idx_org_remediation_tasks_org",
  "idx_org_remediation_tasks_org_status",
];

async function main() {
  const args = new Set(process.argv.slice(2));
  const confirm = args.has("--confirm");
  const force = args.has("--force");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Refusing to guess which database to change.",
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const present = await client.query(
      "SELECT to_regclass($1) IS NOT NULL AS present",
      [TABLE],
    );
    if (!present.rows[0].present) {
      console.log(TABLE + " does not exist. Nothing to roll back.");
      return;
    }

    const counted = await client.query(
      "SELECT COUNT(*)::int AS n FROM " + TABLE,
    );
    const rows = counted.rows[0].n;
    console.log(TABLE + " exists and holds " + rows + " row(s).");

    if (!confirm) {
      console.log(
        "Dry run. Re-run with --confirm to drop the table and its indexes.",
      );
      return;
    }

    if (rows > 0 && !force) {
      console.error(
        "Refusing to drop " +
          TABLE +
          " while " +
          rows +
          " row(s) of customer remediation work exist. Re-run with --confirm --force if that loss is intended.",
      );
      process.exit(1);
    }

    for (const index of INDEXES) {
      await client.query("DROP INDEX IF EXISTS " + index);
      console.log("dropped index " + index + " (if it existed)");
    }

    await client.query("DROP TABLE IF EXISTS " + TABLE);
    console.log("dropped table " + TABLE);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
