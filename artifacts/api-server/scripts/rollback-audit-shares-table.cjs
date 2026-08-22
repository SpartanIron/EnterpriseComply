#!/usr/bin/env node
/**
 * Rollback for src/migrations/audit-shares.migration.ts
 *
 * Committed before the forward migration, per the expand-contract rule.
 *
 * The forward migration creates one table, org_audit_shares, plus two indexes.
 * It alters nothing that existed before, so the reverse is a single DROP TABLE.
 *
 * Why the table is missing in the first place: the Drizzle schema already
 * defines orgAuditSharesTable (lib/db/src/schema/orgRemediation.ts) and
 * lib/db/src/migrate-new-tables.ts contains a matching CREATE TABLE, but no
 * boot path runs that file. startup.service.ts creates 67 tables on boot and
 * org_audit_shares is not one of them. The measured consequence is that both
 * GET /orgs/:orgId/audit-shares and GET /audit/:token answer HTTP 500 in
 * production.
 *
 * The drop is destructive in a way worth stating plainly: auditor share links
 * are the tokens an external auditor uses to read a scoped compliance package.
 * Dropping the table revokes every live link. That is acceptable only when
 * rolling back a deploy that created the table minutes earlier, which is
 * exactly when this script is meant to run.
 *
 * Usage:
 *   node artifacts/api-server/scripts/rollback-audit-shares-table.cjs --dry-run
 *   node artifacts/api-server/scripts/rollback-audit-shares-table.cjs --confirm
 *
 * Dry run is the default. Running with no arguments drops nothing.
 */

const { Client } = require("pg");

const DRY_RUN = !process.argv.includes("--confirm");
const TABLE = "org_audit_shares";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const reg = await client.query("SELECT to_regclass($1) AS reg", [
      "public." + TABLE,
    ]);
    if (!reg.rows[0].reg) {
      console.log(TABLE + " does not exist. Nothing to roll back.");
      return;
    }

    const total = await client.query(
      "SELECT COUNT(*)::int AS n FROM " + TABLE,
    );
    const live = await client.query(
      "SELECT COUNT(*)::int AS n FROM " + TABLE +
        " WHERE is_active = TRUE AND expires_at > NOW()",
    );
    console.log(
      TABLE + ": " + total.rows[0].n + " row(s), " + live.rows[0].n +
        " still live.",
    );

    if (DRY_RUN) {
      console.log("DRY RUN. Would execute: DROP TABLE IF EXISTS " + TABLE + ";");
      console.log("Re-run with --confirm to actually drop it.");
      return;
    }

    await client.query("DROP TABLE IF EXISTS " + TABLE);
    console.log(
      "Dropped " + TABLE + ". " + total.rows[0].n + " share link(s) revoked.",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
