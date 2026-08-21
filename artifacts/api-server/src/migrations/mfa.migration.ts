import { sql } from "drizzle-orm";

/**
 * MFA / TOTP schema. Idempotent, so it is safe on every boot.
 *
 * Three concerns:
 *
 *  1. mfa_enrollment holds the secret for a setup that has been started but not yet
 *     confirmed. It deliberately lives apart from two_factor, because the enforcement
 *     guard reads "a row in two_factor" as "this user is enrolled". An abandoned
 *     half-finished setup must never land there and make someone look compliant.
 *
 *  2. two_factor gains what this app needs on top of the four columns better-auth
 *     originally defined: when enrolment was confirmed, and the highest TOTP counter
 *     already spent, so a code observed in transit cannot be replayed inside its own
 *     30 second window.
 *
 *  3. session gains mfa_verified_at. Step-up state belongs on the session row rather
 *     than in a separate signed cookie: it is revoked exactly when the session is,
 *     signing out genuinely clears it, and there is no second source of truth about
 *     whether the second factor was satisfied.
 *
 * Statements are issued one at a time because the drizzle sql template uses the
 * extended query protocol, which rejects multi-statement strings.
 */
export async function runMfaMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mfa_enrollment (
      user_id    TEXT PRIMARY KEY,
      secret     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS mfa_enrollment_expires_idx ON mfa_enrollment (expires_at)`,
  );

  await db.execute(sql`ALTER TABLE two_factor ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE two_factor ADD COLUMN IF NOT EXISTS last_counter BIGINT`);
  await db.execute(
    sql`ALTER TABLE two_factor ADD COLUMN IF NOT EXISTS backup_codes_used INTEGER NOT NULL DEFAULT 0`,
  );

  // scripts/migrate.cjs already adds this column, but that script is not part of the
  // boot path. Restating it here means a database that has only ever seen StartupService
  // still has the flag the settings page and the onboarding checklist read.
  await db.execute(
    sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT FALSE`,
  );

  await db.execute(sql`ALTER TABLE session ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ`);

  // An expired setup is worthless. Clearing it on boot stops the table accumulating
  // secrets nobody can ever use.
  await db.execute(sql`DELETE FROM mfa_enrollment WHERE expires_at < NOW()`);
}
