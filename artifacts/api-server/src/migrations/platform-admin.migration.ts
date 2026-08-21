import { sql } from "drizzle-orm";

/**
 * Platform-administrator schema. Idempotent, so it is safe on every boot.
 *
 * The problem this replaces
 * -------------------------
 * Platform-staff identity used to be a row in org_members with role
 * "super_admin", and the check was "does this user hold super_admin in ANY
 * org". That has four consequences, all bad:
 *
 *   1. A global privilege was kept in tenant-scoped storage, so one planted row
 *      in any single tenant granted access to every tenant.
 *   2. Platform staff appeared in tenant member lists, member counts and the MFA
 *      coverage denominator. In a GRC product a coverage percentage that silently
 *      includes vendor staff is not cosmetic, it is an audit finding.
 *   3. Every code path that writes org_members roles was one mistake away from
 *      minting a platform administrator, which is why PROTECTED_ROLES had to be
 *      hardcoded into the SSO group sync as a guard.
 *   4. A role that deliberately crosses tenant boundaries lived inside the table
 *      that tenant row-level security is built around.
 *
 * Three tables
 * ------------
 * platform_admins    who MAY elevate. Keyed to the user, not to a tenant.
 *                    Holding a row grants nothing on its own.
 *
 * platform_elevations a time-boxed, reasoned grant of actual access. Break-glass
 *                    rather than standing privilege: staff hold no power until
 *                    they ask for it, say why, prove a second factor, and accept
 *                    that it expires. NIST AC-2(7), AC-6(1), AC-6(9).
 *
 * platform_access_log every privileged request served under an elevation, so the
 *                    question "what did staff look at, and when" has an answer.
 *                    NIST AU-2. Append-only by convention; the WORM trigger that
 *                    protects org_audit_log is org-scoped and does not apply.
 *
 * Legacy rows are copied, never deleted. Removing rows from org_members inside a
 * migration is destructive and unreviewable, so any pre-existing super_admin is
 * copied into platform_admins and left in place, and the operator is warned to
 * remove it by hand. Meanwhile every read that counts tenant members excludes
 * the super_admin role, so the coverage maths is correct either way.
 *
 * Statements are issued one at a time because the drizzle sql template uses the
 * extended query protocol, which rejects multi-statement strings.
 */
export async function runPlatformAdminMigration(db: any): Promise<{
  legacyCopied: number;
}> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_admins (
      user_id    TEXT PRIMARY KEY,
      email      TEXT,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by TEXT,
      note       TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_elevations (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT NOT NULL,
      reason       TEXT NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL,
      ended_at     TIMESTAMPTZ,
      ended_reason TEXT,
      ip_address   TEXT
    )
  `);

  // The hot path is "is there a live elevation for this user right now", which
  // runs on every privileged request.
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS platform_elevations_live_idx ON platform_elevations (user_id, expires_at)`,
  );

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_access_log (
      id           SERIAL PRIMARY KEY,
      elevation_id INTEGER,
      user_id      TEXT NOT NULL,
      operation    TEXT NOT NULL,
      org_id       INTEGER,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS platform_access_log_user_idx ON platform_access_log (user_id, created_at)`,
  );

  // Carry any legacy super_admin membership across. ON CONFLICT DO NOTHING keeps
  // this idempotent, and a later hand-removal of the org_members row will not
  // revoke the platform grant.
  const copied = await db.execute(sql`
    INSERT INTO platform_admins (user_id, email, granted_by, note)
    SELECT DISTINCT m.clerk_user_id, m.email, ${"migration:platform-admin"}, ${"copied from a legacy org_members super_admin row"}
    FROM org_members m
    WHERE m.role = ${"super_admin"}
    ON CONFLICT (user_id) DO NOTHING
  `);

  const legacyCopied = Number((copied as any)?.rowCount ?? 0);
  return { legacyCopied };
}
