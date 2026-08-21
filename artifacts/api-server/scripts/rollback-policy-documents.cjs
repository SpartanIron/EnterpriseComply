#!/usr/bin/env node
/**
 * Rollback for policy-documents.migration.ts  (custom policy document upload)
 *
 * Committed before the forward migration and exercised as a dry run in CI.
 *
 * The forward migration is expand-only. It does three things:
 *   1. CREATE TABLE org_policy_documents, plus three indexes on it
 *   2. ALTER TABLE org_policies ADD COLUMN source_type          (nullable)
 *   3. ALTER TABLE org_policies ADD COLUMN current_document_id  (nullable)
 *
 * Nothing that existed before is rewritten, narrowed or dropped, so the reverse
 * is one DROP TABLE and two DROP COLUMNs.
 *
 * That drop is destructive in a way that has to be said out loud rather than
 * buried in a comment. org_policy_documents holds the only copy of every policy
 * document a customer uploaded. It is not a cache of something on disk, it is
 * not reconstructible from a template, and there is no object store behind it.
 * Dropping the table destroys customer content.
 *
 * The dry run therefore prints the document count and the total stored size
 * before anything is decided, so the number is seen in advance rather than
 * discovered afterwards. Export first if the content still matters:
 *
 *   SELECT id, filename, encode(decode(content_base64, 'base64'), 'escape')
 *   FROM org_policy_documents;
 *
 * Usage:
 *   node artifacts/api-server/scripts/rollback-policy-documents.cjs --dry-run
 *   node artifacts/api-server/scripts/rollback-policy-documents.cjs --confirm
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
      "SELECT to_regclass('public.org_policy_documents') AS t",
    );

    if (present.rows[0].t) {
      const counted = await client.query(
        "SELECT count(*)::int AS n, " +
          "coalesce(sum(size_bytes), 0)::bigint AS bytes, " +
          "count(DISTINCT org_id)::int AS orgs, " +
          "min(created_at) AS first_upload, max(created_at) AS last_upload " +
          "FROM org_policy_documents",
      );
      const row = counted.rows[0];

      console.log("org_policy_documents exists.");
      console.log("  documents        : " + row.n);
      console.log("  organisations    : " + row.orgs);
      console.log("  stored bytes     : " + row.bytes);
      console.log("  first upload     : " + (row.first_upload || "none"));
      console.log("  last upload      : " + (row.last_upload || "none"));
      console.log("");
      console.log("Dropping this table destroys " + row.n + " customer-uploaded document(s).");
      console.log("There is no other copy.");
    } else {
      console.log("org_policy_documents does not exist. Nothing to drop.");
    }

    const columns = await client.query(
      "SELECT column_name FROM information_schema.columns " +
        "WHERE table_name = 'org_policies' " +
        "AND column_name IN ('source_type', 'current_document_id')",
    );
    const columnNames = columns.rows.map(function (r) { return r.column_name; });
    console.log("");
    console.log("org_policies columns added by the forward migration and still present: " +
      (columnNames.length ? columnNames.join(", ") : "none"));

    if (columnNames.includes("source_type")) {
      const bySource = await client.query(
        "SELECT coalesce(source_type, '(null)') AS s, count(*)::int AS n " +
          "FROM org_policies GROUP BY 1 ORDER BY 2 DESC",
      );
      bySource.rows.forEach(function (r) {
        console.log("  source_type " + r.s + ": " + r.n + " policy row(s)");
      });
      console.log("  dropping source_type discards the record of which policies were uploaded");
      console.log("  rather than generated from a template. The policies themselves survive.");
    }

    if (DRY_RUN) {
      console.log("");
      console.log("DRY RUN. Nothing was changed. Re-run with --confirm to reverse the migration.");
      return;
    }

    // MIGRATION-APPROVED: deliberate, operator-confirmed reversal of
    // policy-documents.migration.ts. Guarded by --confirm above.
    await client.query("ALTER TABLE org_policies DROP COLUMN IF EXISTS current_document_id");
    await client.query("ALTER TABLE org_policies DROP COLUMN IF EXISTS source_type");
    await client.query("DROP TABLE IF EXISTS org_policy_documents");

    console.log("");
    console.log("Reversed: org_policy_documents dropped, org_policies columns removed.");
  } finally {
    await client.end();
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
