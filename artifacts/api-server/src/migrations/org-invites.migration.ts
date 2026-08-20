import { sql } from "drizzle-orm";

/**
 * org_invites migration — tenant-scoped team invitations.
 *
 * Ordering matters: this MUST run before runTenantRlsMigration(), which
 * discovers every public table carrying an integer org_id column and installs
 * the tenant_isolation policy on it. Creating the table afterwards would leave
 * it outside row-level security until the next boot.
 *
 * Statements are issued one at a time on purpose. drizzle's sql`` template uses
 * the extended query protocol, which refuses multi-statement strings.
 *
 * Idempotent: safe to run on every boot.
 */
export async function runOrgInvitesMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_invites (
      id               SERIAL PRIMARY KEY,
      org_id           INTEGER NOT NULL,
      email            TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'analyst',
      token_hash       TEXT NOT NULL UNIQUE,
      status           TEXT NOT NULL DEFAULT 'pending',
      expires_at       TIMESTAMPTZ NOT NULL,
      invited_by       TEXT NOT NULL,
      invited_by_email TEXT,
      accepted_at      TIMESTAMPTZ,
      accepted_by      TEXT,
      revoked_at       TIMESTAMPTZ,
      last_sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resend_count     INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON org_invites (org_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_org_invites_status ON org_invites (org_id, status)
  `);

  // At most one live invitation per address per org. Accepted, revoked and
  // expired rows are retained as access-provisioning evidence, so this is a
  // partial index rather than a plain UNIQUE (org_id, email).
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invites_pending
      ON org_invites (org_id, lower(email))
      WHERE status = 'pending'
  `);
}
