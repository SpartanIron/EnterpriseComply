// Migration script: add missing columns to verification table for BetterAuth 1.2.7
// Run with: node artifacts/api-server/scripts/migrate.cjs
const { Client } = require('pg');

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query('ALTER TABLE verification ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');
    await client.query('ALTER TABLE verification ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()');
    console.log('EC Migration complete: verification columns ensured');
  } catch (err) {
    console.error('EC Migration error:', err.message);
  } finally {
        await client.end();
}
}

migrate();
