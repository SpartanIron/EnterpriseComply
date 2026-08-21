import { sql } from "drizzle-orm";

/**
 * Phase 2, step 1: row level security policies on every tenant-scoped table.
 *
 * Read docs/phase2/STRIDE-tenant-isolation.md first. The short version:
 *
 *   - 44 of 53 tables carry org_id. RLS was enabled on 2 of them.
 *   - The application connects as the role that owns the tables, and an owner
 *     bypasses RLS unless the table is forced.
 *
 * So this migration changes no behaviour. It enables RLS and creates a tenant
 * policy on every table carrying org_id, and stops there. The application keeps
 * connecting as owner, keeps bypassing, and keeps enforcing isolation in
 * application code exactly as it does today.
 *
 * That is deliberate, not timid. Forcing RLS before a per-request
 * `SET LOCAL app.current_org` binding exists would make every query return zero
 * rows - which on a compliance product reads as "this organisation has no
 * findings" rather than as an outage. The threat model names that as the denial
 * of service case and the rollout plan puts the credential change last.
 *
 * What this buys today: the policies exist and are correct, so steps 2 to 5 of
 * the rollout are a role change and a connection string rather than a schema
 * change; and the coverage figure the admin database-posture endpoint already
 * reports stops reading 2 and starts reporting the truth.
 *
 * Discovery-based on purpose. A hardcoded table list would be wrong the first
 * time somebody adds a tenant table, and being wrong here is silent.
 */
export interface RlsCoverageResult {
  tenantTables: number;
  rlsEnabled: number;
  policiesCreated: number;
  policiesAlreadyPresent: number;
  forced: number;
  failed: string[];
}

/** Tables that carry org_id but must not be policied by tenant. */
const EXCLUDED = new Set<string>([
  // The org table itself is keyed by id, not org_id, and already has its own
  // policy from tenant-rls.migration.ts.
  "organizations",
]);

export async function runRlsCoverageMigration(db: any): Promise<RlsCoverageResult> {
  const result: RlsCoverageResult = {
    tenantTables: 0,
    rlsEnabled: 0,
    policiesCreated: 0,
    policiesAlreadyPresent: 0,
    forced: 0,
    failed: [],
  };

  const discovered: any = await db.execute(sql`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'org_id'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name
  `);
  const rows = (discovered?.rows ?? discovered) as Array<{ table_name: string }>;
  const tables = (Array.isArray(rows) ? rows : [])
    .map((r) => r.table_name)
    .filter((name) => !EXCLUDED.has(name));

  result.tenantTables = tables.length;

  for (const table of tables) {
    try {
      // Identifiers cannot be parameterised, and these came from
      // information_schema rather than from a request, but they are still
      // validated before interpolation. A table name that is not a plain
      // identifier is a sign something is very wrong, not something to quote
      // around.
      if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
        result.failed.push(table + " (rejected identifier)");
        continue;
      }

      await db.execute(sql.raw('ALTER TABLE ' + table + ' ENABLE ROW LEVEL SECURITY'));
      result.rlsEnabled += 1;

      const policyName = table + '_tenant_isolation';
      const existing: any = await db.execute(sql`
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ${table} AND policyname = ${policyName}
      `);
      const existingRows = (existing?.rows ?? existing) as unknown[];
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        result.policiesAlreadyPresent += 1;
      } else {
        // A null setting admits everything. That is the elevation-of-privilege
        // trade recorded in the threat model: platform-scope reads and the
        // current owner connection must keep working, so the policy fails open
        // on an unset tenant rather than closed. It becomes meaningful the
        // moment the connection is a non-owner role that always binds.
        await db.execute(
          sql.raw(
            'CREATE POLICY ' + policyName + ' ON ' + table +
              " USING (current_setting('app.current_org', true) IS NULL" +
              " OR org_id = current_setting('app.current_org', true)::int)",
          ),
        );
        result.policiesCreated += 1;
      }

      const forced: any = await db.execute(sql`
        SELECT relforcerowsecurity FROM pg_class WHERE relname = ${table}
      `);
      const forcedRows = (forced?.rows ?? forced) as Array<{ relforcerowsecurity: boolean }>;
      if (Array.isArray(forcedRows) && forcedRows[0]?.relforcerowsecurity) {
        result.forced += 1;
      }
    } catch (err) {
      result.failed.push(table + " (" + String((err as { message?: string })?.message ?? err) + ")");
    }
  }

  return result;
}
