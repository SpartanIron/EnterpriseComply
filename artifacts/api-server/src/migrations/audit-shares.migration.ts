import { sql } from "drizzle-orm";

/**
 * org_audit_shares migration — auditor share links.
 *
 * Why this exists: lib/db/src/schema/orgRemediation.ts already defines
 * orgAuditSharesTable, AuditSharesService already queries it, and
 * lib/db/src/migrate-new-tables.ts already contains a matching CREATE TABLE.
 * Nothing runs that file. StartupService creates 67 tables on boot and
 * org_audit_shares is not one of them, so every read of the table fails.
 * Measured before this change, against production:
 *
 *   GET /api/orgs/1/audit-shares            -> 500 Internal server error
 *   GET /api/audit/<any-token>              -> 500 Internal server error
 *
 * Both fail, which is what distinguishes a missing table from a bug in the
 * list handler: a present-but-empty table would have answered 200 with an
 * empty array and 404 for an unknown token.
 *
 * Ordering matters. This runs from AuditSharesModule.onModuleInit(), which
 * NestJS executes during module initialisation — before
 * StartupService.onApplicationBootstrap(), where the tenant RLS discovery pass
 * lives. Creating the table earlier means the RLS pass finds it and installs
 * the tenant_isolation policy on it in the same boot. Creating it later would
 * leave a tenant-scoped table outside row-level security until the next
 * restart, which is the failure mode org-invites.migration.ts warns about.
 *
 * There is no foreign key to organizations(id). That is deliberate and matches
 * the existing SQL in migrate-new-tables.ts: this migration runs before the
 * base tables are created, and adding the constraint here would make boot
 * order load-bearing for no isolation benefit, since org_id is already the
 * column the RLS policy keys on.
 *
 * Statements are issued one at a time on purpose. drizzle-orm's sql template
 * uses the extended query protocol, which refuses multi-statement strings.
 *
 * Idempotent: safe to run on every boot. Additive only — it creates and never
 * alters or drops. The reverse is scripts/rollback-audit-shares-table.cjs,
 * committed before this file.
 */
export async function runAuditSharesMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_audit_shares (
      id                   SERIAL PRIMARY KEY,
      org_id               INTEGER NOT NULL,
      share_token          TEXT NOT NULL UNIQUE,
      auditor_name         TEXT,
      auditor_email        TEXT,
      auditor_firm         TEXT,
      framework_keys       TEXT[],
      include_evidence     BOOLEAN NOT NULL DEFAULT TRUE,
      include_test_results BOOLEAN NOT NULL DEFAULT TRUE,
      include_policies     BOOLEAN NOT NULL DEFAULT TRUE,
      include_poam         BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at           TIMESTAMPTZ NOT NULL,
      is_active            BOOLEAN NOT NULL DEFAULT TRUE,
      access_count         INTEGER NOT NULL DEFAULT 0,
      max_accesses         INTEGER,
      last_accessed_at     TIMESTAMPTZ,
      last_accessed_ip     TEXT,
      created_by           TEXT NOT NULL,
      revoked_at           TIMESTAMPTZ,
      revoked_by           TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_audit_shares_org_id
      ON org_audit_shares(org_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_audit_shares_token
      ON org_audit_shares(share_token)
  `);
}
