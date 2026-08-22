import { sql } from "drizzle-orm";

/**
 * Creates org_remediation_tasks if it is missing.
 *
 * The table was declared in lib/db/src/schema/orgRemediation.ts and queried by
 * RemediationService from the day the module shipped, but the only CREATE TABLE
 * for it lived in lib/db/src/migrate-new-tables.ts, which no runtime path
 * executes. The result was a hard 500 on GET /orgs/:orgId/remediation in
 * production: not an empty list, an error. That is the same defect class as
 * org_audit_shares, and the capability baseline check added alongside this
 * migration is what makes the class visible instead of waiting for the next
 * customer to find it.
 *
 * The column list is copied from the statement in migrate-new-tables.ts rather
 * than re-derived from the Drizzle schema, so a database created by either path
 * ends up with the same shape.
 *
 * Statements are issued one at a time. Batching them into a single call makes a
 * partial failure ambiguous, and this runs on every boot.
 */
export async function runRemediationTasksMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_remediation_tasks (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL,
      uco_control_id TEXT NOT NULL,
      control_name TEXT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      assignee_name TEXT,
      assignee_email TEXT,
      effort_days INTEGER,
      due_date TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      frameworks_benefited TEXT[],
      action_steps TEXT[],
      quick_win BOOLEAN NOT NULL DEFAULT FALSE,
      blocker_reason TEXT,
      notes TEXT,
      re_test_requested BOOLEAN NOT NULL DEFAULT FALSE,
      re_test_at TIMESTAMPTZ,
      re_test_result TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Every read path filters by org_id, and the board view filters by status
  // within an org, so those are the two indexes that earn their keep.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_remediation_tasks_org
      ON org_remediation_tasks (org_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_remediation_tasks_org_status
      ON org_remediation_tasks (org_id, status)
  `);
}
