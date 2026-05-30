// EC BetterAuth migration script
// BetterAuth uses camelCase column names (expiresAt, createdAt, updatedAt)
// This script ensures all BetterAuth tables have the correct schema
const { Client } = require('pg');

async function migrate() {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      try {
              await client.connect();
              console.log('EC Migration: connected to database');

        // verification table - BetterAuth needs camelCase columns
        // Drop and recreate to ensure correct schema (no user data here)
        await client.query(`
              CREATE TABLE IF NOT EXISTS verification (
                      id TEXT PRIMARY KEY,
                              identifier TEXT NOT NULL,
                                      value TEXT NOT NULL,
                                              "expiresAt" TIMESTAMPTZ NOT NULL,
                                                      "createdAt" TIMESTAMPTZ,
                                                              "updatedAt" TIMESTAMPTZ
                                                                    )
                                                                        `);
              // Add camelCase columns if table already existed without them
        await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`);
              await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ`);
              await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ`);
              console.log('EC Migration: verification table ensured');

        // user table - BetterAuth camelCase columns
        await client.query(`
              CREATE TABLE IF NOT EXISTS "user" (
                      id TEXT PRIMARY KEY,
                              name TEXT NOT NULL,
                                      email TEXT NOT NULL UNIQUE,
                                              "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
                                                      image TEXT,
                                                              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                                      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                                              role TEXT DEFAULT 'member',
                                                                                      "orgId" INTEGER,
                                                                                              "clerkUserId" TEXT
                                                                                                    )
                                                                                                        `);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT FALSE`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS image TEXT`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "orgId" INTEGER`);
              await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT`);
              console.log('EC Migration: user table ensured');

        // session table - BetterAuth camelCase columns
        await client.query(`
              CREATE TABLE IF NOT EXISTS session (
                      id TEXT PRIMARY KEY,
                              "expiresAt" TIMESTAMPTZ NOT NULL,
                                      token TEXT NOT NULL UNIQUE,
                                              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                              "ipAddress" TEXT,
                                                                      "userAgent" TEXT,
                                                                              "userId" TEXT NOT NULL
                                                                                    )
                                                                                        `);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ`);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "ipAddress" TEXT`);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "userAgent" TEXT`);
              await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS "userId" TEXT`);
              console.log('EC Migration: session table ensured');

        // account table - BetterAuth camelCase columns
        await client.query(`
              CREATE TABLE IF NOT EXISTS account (
                      id TEXT PRIMARY KEY,
                              "accountId" TEXT NOT NULL,
                                      "providerId" TEXT NOT NULL,
                                              "userId" TEXT NOT NULL,
                                                      "accessToken" TEXT,
                                                              "refreshToken" TEXT,
                                                                      "idToken" TEXT,
                                                                              "accessTokenExpiresAt" TIMESTAMPTZ,
                                                                                      "refreshTokenExpiresAt" TIMESTAMPTZ,
                                                                                              scope TEXT,
                                                                                                      password TEXT,
                                                                                                              "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                                                                                      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                                                                                                                            )
                                                                                                                                `);
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
              console.log('EC Migration: account table ensured');

        console.log('EC Migration complete: all BetterAuth tables verified');
      } catch (err) {
              console.error('EC Migration error:', err.message);
      } finally {
              await client.end();
      }
}

migrate();
