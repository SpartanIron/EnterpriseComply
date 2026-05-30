// EC BetterAuth migration script
// BetterAuth uses camelCase column names (expiresAt, createdAt, updatedAt)
// Fix: add camelCase columns AND remove NOT NULL from old snake_case columns
const { Client } = require('pg');

async function migrate() {
        const client = new Client({ connectionString: process.env.DATABASE_URL });
        try {
                  await client.connect();
                  console.log('EC Migration: connected to database');

          // verification table
          await client.query(`CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ)`);
                  await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`);
                  await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ`);
                  await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ`);
                  // Remove NOT NULL from old snake_case columns (BetterAuth won't populate them)
          await client.query(`ALTER TABLE verification ALTER COLUMN expires_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE verification ALTER COLUMN created_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE verification ALTER COLUMN updated_at DROP NOT NULL`).catch(() => {});
                  console.log('EC Migration: verification table ensured');

          // user table
          await client.query(`CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE, image TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), role TEXT DEFAULT 'member', "orgId" INTEGER, "clerkUserId" TEXT)`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT FALSE`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS image TEXT`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "orgId" INTEGER`);
                  await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT`);
                  // Remove NOT NULL from old snake_case columns
          await client.query(`ALTER TABLE "user" ALTER COLUMN created_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE "user" ALTER COLUMN updated_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE "user" ALTER COLUMN email_verified DROP NOT NULL`).catch(() => {});
                  console.log('EC Migration: user table ensured');

          // session table
          await client.query(`CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, "expiresAt" TIMESTAMPTZ NOT NULL, token TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL)`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "ipAddress" TEXT`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "userAgent" TEXT`);
                  await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "userId" TEXT`);
                  await client.query(`ALTER TABLE session ALTER COLUMN expires_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE session ALTER COLUMN created_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE session ALTER COLUMN updated_at DROP NOT NULL`).catch(() => {});
                  console.log('EC Migration: session table ensured');

          // account table
          await client.query(`CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMPTZ, "refreshTokenExpiresAt" TIMESTAMPTZ, scope TEXT, password TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "accountId" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "providerId" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "userId" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "accessToken" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "refreshToken" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "idToken" TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMPTZ`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMPTZ`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS scope TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS password TEXT`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
                  await client.query(`ALTER TABLE account ALTER COLUMN created_at DROP NOT NULL`).catch(() => {});
                  await client.query(`ALTER TABLE account ALTER COLUMN updated_at DROP NOT NULL`).catch(() => {});
                  console.log('EC Migration: account table ensured');

          console.log('EC Migration complete: all BetterAuth tables verified');

                    // twoFactor table
                    await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT FALSE`);
                    await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "activeOrganizationId" TEXT`);
                    await client.query(`CREATE TABLE IF NOT EXISTS "twoFactor" (id TEXT PRIMARY KEY, secret TEXT NOT NULL, "backupCodes" TEXT NOT NULL, "userId" TEXT NOT NULL UNIQUE)`);
                    await client.query(`ALTER TABLE "twoFactor" ADD COLUMN IF NOT EXISTS secret TEXT`);
                    await client.query(`ALTER TABLE "twoFactor" ADD COLUMN IF NOT EXISTS "backupCodes" TEXT`);
                    await client.query(`ALTER TABLE "twoFactor" ADD COLUMN IF NOT EXISTS "userId" TEXT`);
                    console.log('EC Migration: twoFactor table ensured');
                    // organization tables
                    await client.query(`CREATE TABLE IF NOT EXISTS organization (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE, logo TEXT, metadata TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
                    await client.query(`CREATE TABLE IF NOT EXISTS member (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "userId" TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
                    await client.query(`CREATE TABLE IF NOT EXISTS invitation (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, email TEXT NOT NULL, role TEXT DEFAULT 'member', status TEXT NOT NULL DEFAULT 'pending', "expiresAt" TIMESTAMPTZ NOT NULL, "inviterId" TEXT NOT NULL)`);
                    console.log('EC Migration: org/member/invitation tables ensured');
        } catch (err) {
                  console.error('EC Migration error:', err.message);
        } finally {
                  await client.end();
        }
}

migrate();
