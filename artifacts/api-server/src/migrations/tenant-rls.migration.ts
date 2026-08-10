import { sql } from "drizzle-orm";

/**
 * Tenant Row-Level Security migration.
 *
 * EnterpriseComply enforces tenant isolation in three independent layers:
 *
 *   1. Application layer  - OrgContextGuard + per-query org_id predicates.
 *                           Proven by the isolation/RBAC regression suite.
 *   2. Database layer     - PostgreSQL RLS policies installed by this module.
 *   3. Role layer         - a NOSUPERUSER / NOBYPASSRLS application role
 *                           (see scripts/provision-app-role.cjs).
 *
 * Layer 2 is installed unconditionally so the policies are always present and
 * auditable. It only becomes *enforcing* once the API connects as a role that
 * does not carry BYPASSRLS, which is why readDbSecurityPosture() reports the
 * enforcement state rather than assuming it.
 *
 * We deliberately do NOT issue FORCE ROW LEVEL SECURITY: the table owner would
 * then be subject to the policy too, and the current production role owns the
 * schema. Forcing it before the role cutover would take the platform down.
 */

/** Tables that legitimately hold no org_id and must never get a tenant policy. */
export const RLS_EXEMPT_TABLES = new Set<string>([
  // Deliberately empty.
  //
  // The discovery query already restricts itself to tables carrying an
  // integer org_id column, and a table with an org_id column *is* tenant
  // data by definition. An allow-list here would be a place for a table to
  // quietly opt out of isolation, which is exactly the failure mode this
  // control exists to prevent. Anything that genuinely needs to be global
  // must not carry an org_id column.
]);

export const TENANT_POLICY_NAME = "tenant_isolation";

/** GUC the application sets per request once the least-privilege role is live. */
export const ORG_GUC = "app.current_org_id";

export interface RlsMigrationResult {
  discovered: number;
  enabled: number;
  policiesCreated: number;
  skipped: string[];
  errors: string[];
}

/**
 * Discover every public table carrying an integer org_id column, plus the
 * organizations table itself, and make sure each one has RLS enabled and a
 * tenant_isolation policy bound to the app.current_org_id GUC.
 *
 * Idempotent: safe to run on every boot.
 */
export async function runTenantRlsMigration(db: any): Promise<RlsMigrationResult> {
  const result: RlsMigrationResult = {
    discovered: 0,
    enabled: 0,
    policiesCreated: 0,
    skipped: [],
    errors: [],
  };

  const discovered = await db.execute(sql`
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN pg_class pc ON pc.relname = c.table_name
      JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
     WHERE c.table_schema = 'public'
       AND c.column_name = 'org_id'
       AND c.data_type = 'integer'
       AND pc.relkind = 'r'
     ORDER BY 1
  `);

  const tables: string[] = (discovered.rows as Array<{ table_name: string }>).map(
    (r) => r.table_name,
  );

  for (const table of tables) {
    if (RLS_EXEMPT_TABLES.has(table)) {
      result.skipped.push(table);
      continue;
    }
    result.discovered++;
    try {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
      result.enabled++;
      await db.execute(
        sql.raw(`DROP POLICY IF EXISTS ${TENANT_POLICY_NAME} ON "${table}"`),
      );
      await db.execute(
        sql.raw(
          `CREATE POLICY ${TENANT_POLICY_NAME} ON "${table}" ` +
            `USING (org_id = NULLIF(current_setting('${ORG_GUC}', true), '')::int) ` +
            `WITH CHECK (org_id = NULLIF(current_setting('${ORG_GUC}', true), '')::int)`,
        ),
      );
      result.policiesCreated++;
    } catch (err) {
      result.errors.push(`${table}: ${(err as any)?.message ?? String(err)}`);
    }
  }

  // organizations keys on id, not org_id. It already had RLS enabled with no
  // policy attached, which is a latent deny-all once BYPASSRLS is dropped.
  try {
    result.discovered++;
    await db.execute(sql.raw(`ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY`));
    result.enabled++;
    await db.execute(
      sql.raw(`DROP POLICY IF EXISTS ${TENANT_POLICY_NAME} ON "organizations"`),
    );
    await db.execute(
      sql.raw(
        `CREATE POLICY ${TENANT_POLICY_NAME} ON "organizations" ` +
          `USING (id = NULLIF(current_setting('${ORG_GUC}', true), '')::int) ` +
          `WITH CHECK (id = NULLIF(current_setting('${ORG_GUC}', true), '')::int)`,
      ),
    );
    result.policiesCreated++;
  } catch (err) {
    result.errors.push(`organizations: ${(err as any)?.message ?? String(err)}`);
  }

  return result;
}

export interface DbSecurityPosture {
  role: string;
  isSuperuser: boolean;
  bypassesRls: boolean;
  /** True only when the connected role is actually subject to the policies. */
  rlsEnforced: boolean;
  tenantTables: number;
  tablesWithRls: number;
  tablesWithPolicy: number;
  tablesMissingPolicy: string[];
  wormTriggers: string[];
  sslInUse: boolean;
  serverVersion: string;
  checkedAt: string;
}

/**
 * Read-only posture snapshot used by the super-admin console and by the
 * isolation regression suite. Never mutates anything.
 */
export async function readDbSecurityPosture(db: any): Promise<DbSecurityPosture> {
  const roleRow = await db.execute(sql`
    SELECT current_user AS role, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user
  `);
  const role = roleRow.rows[0] ?? {};

  const tenant = await db.execute(sql`
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN pg_class pc ON pc.relname = c.table_name
      JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
     WHERE c.table_schema = 'public' AND c.column_name = 'org_id'
       AND c.data_type = 'integer' AND pc.relkind = 'r'
  `);

  const rlsOn = await db.execute(sql`
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  `);

  const policies = await db.execute(sql`
    SELECT tablename FROM pg_policies
     WHERE schemaname = 'public' AND policyname = ${TENANT_POLICY_NAME}
  `);

  const triggers = await db.execute(sql`
    SELECT DISTINCT trigger_name FROM information_schema.triggers
     WHERE trigger_schema = 'public' AND trigger_name LIKE '%worm%'
  `);

  const ssl = await db.execute(sql`SELECT current_setting('ssl', true) AS ssl`);
  const ver = await db.execute(sql`SELECT current_setting('server_version') AS v`);

  const tenantTables = (tenant.rows as Array<{ table_name: string }>)
    .map((r) => r.table_name)
    .filter((t) => !RLS_EXEMPT_TABLES.has(t));
  const withPolicy = new Set(
    (policies.rows as Array<{ tablename: string }>).map((r) => r.tablename),
  );
  const withRls = new Set((rlsOn.rows as Array<{ relname: string }>).map((r) => r.relname));

  const bypassesRls = role.rolbypassrls === true || role.rolsuper === true;

  return {
    role: String(role.role ?? "unknown"),
    isSuperuser: role.rolsuper === true,
    bypassesRls,
    rlsEnforced: !bypassesRls,
    tenantTables: tenantTables.length,
    tablesWithRls: tenantTables.filter((t) => withRls.has(t)).length,
    tablesWithPolicy: tenantTables.filter((t) => withPolicy.has(t)).length,
    tablesMissingPolicy: tenantTables.filter((t) => !withPolicy.has(t)),
    wormTriggers: (triggers.rows as Array<{ trigger_name: string }>).map(
      (r) => r.trigger_name,
    ),
    sslInUse: String(ssl.rows[0]?.ssl ?? "off") === "on",
    serverVersion: String(ver.rows[0]?.v ?? "unknown"),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Evidence retention columns.
 *
 * The WORM trigger rejects DELETE on org_evidence, so the application needs a
 * non-destructive way to retire an artefact. These columns carry that state
 * plus a legal-hold flag that blocks retirement entirely.
 *
 * Idempotent.
 */
export async function runEvidenceRetentionMigration(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE org_evidence
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS deleted_by TEXT,
      ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
      ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS org_evidence_active_idx
      ON org_evidence (org_id) WHERE deleted_at IS NULL
  `);
}

/**
 * Organisation-level security settings.
 *
 * mfa_enforced already existed but nothing read it, so the toggle was
 * decorative. These two columns give enforcement a safe rollout: switching
 * the policy on stamps mfa_enforced_at and members get mfa_grace_days to
 * enrol before they are refused. Without that, enabling MFA on a tenant
 * where nobody has enrolled locks every user out instantly.
 */
export async function runOrgSecuritySettingsMigration(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS mfa_enforced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS mfa_grace_days INTEGER NOT NULL DEFAULT 14
  `);
}
