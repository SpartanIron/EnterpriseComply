// EC BetterAuth migration script - ensures all BetterAuth tables have correct schema
// Handles pre-existing tables that were created without all required columns
const { Client } = require('pg');

async function migrate() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
          await client.connect();
          console.log('EC Migration: connected to database');

      // verification table - needs created_at, updated_at
      await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE verification ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
          console.log('EC Migration: verification table columns ensured');

      // user table - needs role, org_id, clerk_user_id (custom fields from better-auth.ts)
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS org_id INTEGER`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS image TEXT`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
          console.log('EC Migration: user table columns ensured');

      // session table - ensure all columns exist
      await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS ip_address TEXT`);
          await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS user_agent TEXT`);
          console.log('EC Migration: session table columns ensured');

      // account table - ensure all columns exist
      await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS access_token TEXT`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS id_token TEXT`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS scope TEXT`);
          await client.query(`ALTER TABLE account ADD COLUMN IF NOT EXISTS password TEXT`);
          console.log('EC Migration: account table columns ensured');

      console.log('EC Migration complete: all BetterAuth tables verified');
    } catch (err) {
          console.error('EC Migration error:', err.message);
          // Don't throw - allow app to start even if migration has issues
    } finally {
          await client.end();
    }
}

migrate();
