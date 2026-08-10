#!/usr/bin/env node
/**
 * Provision the EnterpriseComply least-privilege application database role.
 *
 * WHY
 *   The API currently connects as the Postgres superuser. A superuser carries
 *   BYPASSRLS, so every row level security policy on the schema is inert and
 *   a single missed org_id predicate in application code becomes a
 *   cross-tenant data exposure. It also means an SQL injection anywhere in the
 *   codebase is an instant full-database compromise rather than a scoped one.
 *
 * WHAT THIS DOES
 *   Creates (or updates) a role that is:
 *     NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT-safe LOGIN
 *   and grants it only what the application needs:
 *     - USAGE on schema public
 *     - SELECT/INSERT/UPDATE/DELETE on existing tables (no TRUNCATE, no DDL)
 *     - USAGE/SELECT on sequences
 *     - the same defaults for future tables created by the migration owner
 *   It explicitly does NOT grant ownership, so the app cannot DROP a table or
 *   disable an RLS policy.
 *
 * WHAT THIS DOES NOT DO
 *   It does not read, print or modify any existing connection string, and it
 *   does not switch the running service over. Cutover is a deliberate human
 *   step: set DATABASE_URL to the printed template (with your own password)
 *   in Railway and redeploy.
 *
 * USAGE
 *   APP_DB_ROLE=ec_app APP_DB_PASSWORD='<generate one>' \
 *     node scripts/provision-app-role.cjs
 *
 *   Add --dry-run to print the statements without executing them.
 *
 * SAFETY
 *   Idempotent. Re-running only re-grants; it never drops the role, never
 *   drops objects, and never rotates the password unless APP_DB_PASSWORD is
 *   supplied.
 */

const { Client } = require("pg");

const ROLE = process.env.APP_DB_ROLE || "ec_app";
const PASSWORD = process.env.APP_DB_PASSWORD || "";
const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATION_OWNER = process.env.DB_MIGRATION_OWNER || "postgres";

if (!/^[a-z_][a-z0-9_]{2,62}$/.test(ROLE)) {
  console.error("APP_DB_ROLE must be a lowercase identifier, got: " + ROLE);
  process.exit(1);
}
if (!DRY_RUN && PASSWORD.length < 24) {
  console.error(
    "Refusing to provision. Set APP_DB_PASSWORD to at least 24 characters.\n" +
      "Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (must currently be an owner/superuser URL).");
  process.exit(1);
}

const statements = [
  {
    label: "create or update the role",
    sql:
      "DO $$ BEGIN\n" +
      "  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" + ROLE + "') THEN\n" +
      "    CREATE ROLE " + ROLE + " LOGIN;\n" +
      "  END IF;\n" +
      "END $$;",
  },
  {
    label: "strip every superuser-adjacent attribute",
    sql:
      "ALTER ROLE " + ROLE +
      " NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS LOGIN;",
  },
  { label: "connect + schema usage", sql: "GRANT USAGE ON SCHEMA public TO " + ROLE + ";" },
  {
    label: "DML on existing tables (no TRUNCATE, no DDL)",
    sql: "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO " + ROLE + ";",
  },
  {
    label: "sequences",
    sql: "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO " + ROLE + ";",
  },
  {
    label: "same defaults for future tables",
    sql:
      "ALTER DEFAULT PRIVILEGES FOR ROLE " + MIGRATION_OWNER + " IN SCHEMA public " +
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO " + ROLE + ";",
  },
  {
    label: "same defaults for future sequences",
    sql:
      "ALTER DEFAULT PRIVILEGES FOR ROLE " + MIGRATION_OWNER + " IN SCHEMA public " +
      "GRANT USAGE, SELECT ON SEQUENCES TO " + ROLE + ";",
  },
  {
    label: "revoke the implicit public CREATE grant",
    sql: "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
  },
  {
    label: "execute on the WORM / verification functions the app calls",
    sql: "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO " + ROLE + ";",
  },
];

async function main() {
  if (DRY_RUN) {
    console.log("--- DRY RUN: statements that would be executed ---\n");
    for (const s of statements) console.log("-- " + s.label + "\n" + s.sql + "\n");
    console.log("-- set password (value redacted)\nALTER ROLE " + ROLE + " PASSWORD '<APP_DB_PASSWORD>';");
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const s of statements) {
      await client.query(s.sql);
      console.log("ok  " + s.label);
    }
    await client.query("ALTER ROLE " + ROLE + " PASSWORD $1", [PASSWORD]);
    console.log("ok  password set");

    const check = await client.query(
      "SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin " +
        "FROM pg_roles WHERE rolname = $1",
      [ROLE],
    );
    const r = check.rows[0];
    console.log("\n--- verification ---");
    console.log(JSON.stringify(r, null, 2));
    const bad = ["rolsuper", "rolcreatedb", "rolcreaterole", "rolbypassrls"].filter((k) => r[k]);
    if (bad.length) {
      console.error("FAILED: role still holds " + bad.join(", "));
      process.exitCode = 1;
      return;
    }
    if (!r.rolcanlogin) {
      console.error("FAILED: role cannot log in");
      process.exitCode = 1;
      return;
    }

    const url = new URL(process.env.DATABASE_URL);
    console.log("\n--- cutover ---");
    console.log("Role " + ROLE + " is provisioned and carries no RLS bypass.");
    console.log("Set DATABASE_URL in Railway to:\n");
    console.log(
      "  postgresql://" + ROLE + ":<APP_DB_PASSWORD>@" + url.host + url.pathname + "?sslmode=require",
    );
    console.log(
      "\nThen redeploy and confirm GET /api/admin/db-security reports rlsEnforced: true.",
    );
    console.log(
      "Keep the owner/superuser URL for migrations only (Railway pre-deploy command).",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("provision-app-role failed: " + err.message);
  process.exit(1);
});
