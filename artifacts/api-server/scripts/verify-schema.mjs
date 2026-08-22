/**
 * Post-migration Schema Verifier — P1-19
 *
 * Connects to the database and checks that the full set of expected tables
 * were created by StartupService. Fails fast with a clear error if any table
 * is missing, making silent migration failures visible in CI.
 *
 * Usage:
 *   node artifacts/api-server/scripts/verify-schema.mjs
 *
 * Requires: DATABASE_URL env var
 * Exit code: 0 = all tables present, 1 = one or more missing
 */

import pg from "pg";

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("[fatal] DATABASE_URL not set"); process.exit(1); }

// Complete list of tables that must exist after StartupService runs migrations.
// Derived from MIGRATION_SQL, MIGRATION_SQL_V2, MIGRATION_SQL_V3, and the
// BetterAuth + Drizzle seed tables in startup.service.ts.
// If you add a migration that creates a new table, add it here too.
const EXPECTED_TABLES = [
  // ── Core compliance ──────────────────────────────────────────────────────
  "organizations",
  "org_members",
  "org_frameworks",
  "org_control_results",
  "org_evidence",
  "org_integrations",
  "org_policies",
  "org_policy_acknowledgments",
  "org_policy_documents",
  "org_risks",
  "org_people",
  "org_vendors",
  "org_questionnaires",
  "org_questionnaire_items",
  "org_poam_items",
  "org_access_reviews",
  "org_remediation_tasks",
  "org_audit_engagements",
  "org_audit_shares",
  // ── UCO catalog ──────────────────────────────────────────────────────────
  "uco_controls",
  "uco_framework_mappings",
  "uco_automated_tests",
  // ── Additional modules ───────────────────────────────────────────────────
  "org_custom_frameworks",
  "org_notifications",
  "org_exceptions",
  "org_training_campaigns",
  "org_training_completions",
  "org_compliance_calendar",
  "org_sub_processors",
  "org_risks_seeded",
  "org_stig_checklists",
  "org_stig_findings",
  "feature_flags",
  "integration_catalog",
  "test_runs",
  "email_drip_log",
  // ── Additional application tables ────────────────────────────────────────
  "org_access_review_items",
  "org_assessments",
  "org_audit_evidence_requests",
  "org_audit_log",
  "org_custom_controls",
  "org_monitoring_jobs",
  "org_notification_settings",
  "org_policy_reviews",
  "org_vendor_assessments",
  "compliance_score_history",
  "integration_sync_log",
  // ── BetterAuth tables ────────────────────────────────────────────────────
  "user",
  "session",
  "account",
  "verification",
  "two_factor",
];

const db = new Client({ connectionString: DB_URL });
await db.connect();

const result = await db.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name`
);
await db.end();

const existing = new Set(result.rows.map(r => r.table_name));
const missing  = EXPECTED_TABLES.filter(t => !existing.has(t));
const extra    = [...existing].filter(t => !EXPECTED_TABLES.includes(t));

const bar = "═".repeat(70);
console.log(`\n[schema-verify] Database: ${DB_URL.replace(/:[^:@]+@/, ":***@")}`);
console.log(`[schema-verify] Expected: ${EXPECTED_TABLES.length} tables  Found: ${existing.size} tables in public schema\n`);

if (missing.length === 0) {
  console.log("  ✓  All expected tables are present.");
} else {
  console.log("  ✗  MISSING TABLES — migration did not run cleanly:\n");
  for (const t of missing) console.log(`       • ${t}`);
}

if (extra.length > 0) {
  console.log(`\n  ℹ  ${extra.length} table(s) exist in DB but not in expected list (OK — may be seeded data or BetterAuth extras):`);
  for (const t of extra) console.log(`       + ${t}`);
}

console.log(`\n${bar}`);
console.log(missing.length === 0
  ? "  ✓ Schema verification passed."
  : `  ✗ Schema verification FAILED — ${missing.length} table(s) missing.`);
console.log(bar);

process.exit(missing.length > 0 ? 1 : 0);
