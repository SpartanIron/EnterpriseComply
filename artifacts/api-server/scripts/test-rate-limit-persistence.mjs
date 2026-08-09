/**
 * test-rate-limit-persistence.mjs — Regression test for task #52
 *
 * Verifies that the Postgres-backed auth-failure-tracker and ThrottlerStorage
 * survive a simulated process restart (i.e. re-reading from the DB reflects
 * previously written state).
 *
 * Usage:
 *   node --import @swc-node/register/esm-register \
 *     artifacts/api-server/scripts/test-rate-limit-persistence.mjs
 *
 * Required env:
 *   DATABASE_URL — PostgreSQL connection string
 *
 * Exit code: 0 = all checks passed, 1 = one or more checks failed
 */

import {
  recordAuthFailure,
  isIpBlocked,
  blockRemainingSeconds,
  resetIpFailures,
  BLOCK_SECONDS,
} from "../src/lib/auth-failure-tracker.ts";
import { PgThrottlerStorage } from "../src/lib/pg-throttler-storage.ts";
import pg from "pg";

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("[fatal] DATABASE_URL not set");
  process.exit(1);
}

// ── Test accounting ───────────────────────────────────────────────────────────

let total  = 0;
let passed = 0;
let failed = 0;
const failures = [];

function check(label, got, ...expected) {
  total++;
  const ok = expected.includes(got);
  if (ok) {
    passed++;
    process.stdout.write(`  ✓  ${label.padEnd(65)} ${got}\n`);
  } else {
    failed++;
    const msg = `  ✗  ${label.padEnd(65)} got=${got} expected=${expected.join("|")}`;
    failures.push(msg);
    process.stdout.write(msg + "\n");
  }
}

function section(title) {
  console.log(`\n${"─".repeat(75)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(75));
}

// ── Test 1: auth-failure-tracker persistence ─────────────────────────────────

const TEST_IP = `127.99.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

async function runAuthFailureTrackerTests() {
  section("auth-failure-tracker: Postgres persistence");

  // Clean slate
  await resetIpFailures(TEST_IP);

  // 1a. IP starts unblocked
  check("IP starts unblocked", await isIpBlocked(TEST_IP), false);

  // 1b. Record 9 failures — should NOT trigger block yet
  let blocked = false;
  for (let i = 0; i < 9; i++) {
    blocked = await recordAuthFailure(TEST_IP);
  }
  check("9 failures: not yet blocked", blocked, false);
  check("isIpBlocked after 9 failures", await isIpBlocked(TEST_IP), false);

  // 1c. 10th failure crosses threshold
  blocked = await recordAuthFailure(TEST_IP);
  check("10th failure: blocked", blocked, true);
  check("isIpBlocked after 10 failures", await isIpBlocked(TEST_IP), true);

  // 1d. Simulate restart: create a fresh Pool to read from DB (bypasses module-level cache)
  //     The key test: block state must survive a process restart (new Pool = new process).
  section("auth-failure-tracker: Simulated restart (fresh DB connection)");

  const freshPool = new Pool({ connectionString: DB_URL, max: 1 });
  const { rows } = await freshPool.query(
    "SELECT count, blocked_until FROM ip_failure_tracker WHERE ip = $1",
    [TEST_IP],
  );
  await freshPool.end();

  check("DB row exists after failures", rows.length, 1);
  if (rows.length > 0) {
    check("DB count = 10", rows[0].count, 10);
    check("DB blocked_until > 0", Number(rows[0].blocked_until) > 0, true);
    check(
      "DB blocked_until is in the future",
      Number(rows[0].blocked_until) > Date.now(),
      true,
    );
  }

  // 1e. Remaining seconds is non-zero
  const remaining = await blockRemainingSeconds(TEST_IP);
  check("blockRemainingSeconds > 0", remaining > 0, true);
  check("blockRemainingSeconds ≤ BLOCK_SECONDS", remaining <= BLOCK_SECONDS, true);

  // 1f. Additional failures while blocked still return true (re-check)
  blocked = await recordAuthFailure(TEST_IP);
  check("recordAuthFailure while blocked returns true", blocked, true);

  // Cleanup
  await resetIpFailures(TEST_IP);
  check("IP unblocked after reset", await isIpBlocked(TEST_IP), false);
}

// ── Test 2: PgThrottlerStorage persistence ───────────────────────────────────

async function runThrottlerStorageTests() {
  section("PgThrottlerStorage: Postgres persistence");

  const storage = new PgThrottlerStorage();
  const testKey = `test-key-${Date.now()}`;
  const TTL     = 60_000; // 1 min
  const LIMIT   = 5;
  const BLOCK   = 60_000;
  const NAME    = "test";

  const pool = new Pool({ connectionString: DB_URL, max: 1 });

  // 2a. First hit — also triggers ensureSchema so the table exists for cleanup
  let record = await storage.increment(testKey, TTL, LIMIT, BLOCK, NAME);
  check("First hit: totalHits = 1",  record.totalHits, 1);
  check("First hit: isBlocked = false", record.isBlocked, false);

  // 2b. Hits 2-5 — all within limit, none should be blocked
  for (let i = 0; i < 4; i++) {
    record = await storage.increment(testKey, TTL, LIMIT, BLOCK, NAME);
  }
  check("After 5 hits: totalHits = 5", record.totalHits, 5);
  check("After 5 hits (at limit): isBlocked = false", record.isBlocked, false);

  // 2c. Hit 6 — exceeds limit (> 5), triggers block
  record = await storage.increment(testKey, TTL, LIMIT, BLOCK, NAME);
  check("Hit 6 (exceeds limit): totalHits = 6", record.totalHits, 6);
  check("Hit 6 (exceeds limit): isBlocked = true", record.isBlocked, true);
  // timeToBlockExpire and timeToExpire must be in SECONDS (matching stock ThrottlerStorageService)
  // A 60-second window returns ~60, not ~60000; a 60-second block returns ~60, not ~60000.
  check("timeToBlockExpire in seconds (> 0, ≤ 60)", record.timeToBlockExpire > 0 && record.timeToBlockExpire <= 60, true);
  check("timeToExpire in seconds (> 0, ≤ 60)",      record.timeToExpire > 0    && record.timeToExpire <= 60,      true);

  // 2d. Persist check via fresh DB query (simulates restart)
  section("PgThrottlerStorage: Simulated restart (fresh DB connection)");

  const { rows } = await pool.query(
    "SELECT total_hits, block_expire_at FROM throttle_hits WHERE key = $1 AND throttler_name = $2",
    [testKey, NAME],
  );

  check("DB row exists", rows.length, 1);
  if (rows.length > 0) {
    check("DB total_hits = 6",         rows[0].total_hits, 6);
    check("DB block_expire_at > 0",    Number(rows[0].block_expire_at) > 0, true);
    check(
      "DB block_expire_at in future",
      Number(rows[0].block_expire_at) > Date.now(),
      true,
    );
  }

  // 2e. Fresh storage instance reads persisted block (simulates restart)
  const storage2 = new PgThrottlerStorage();
  record = await storage2.increment(testKey, TTL, LIMIT, BLOCK, NAME);
  check(
    "Fresh instance: still blocked after simulated restart",
    record.isBlocked,
    true,
  );

  // Cleanup
  await pool.query(
    "DELETE FROM throttle_hits WHERE key = $1 AND throttler_name = $2",
    [testKey, NAME],
  );
  await pool.end();
}

// ── Test 3: Concurrent writes don't lose counts ───────────────────────────────

async function runConcurrencyTests() {
  section("Concurrency: parallel failures are not silently dropped");

  const CONC_IP = `127.88.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  await resetIpFailures(CONC_IP);

  // Fire 10 failures in parallel — all should be counted; none should be lost
  const results = await Promise.all(
    Array.from({ length: 10 }, () => recordAuthFailure(CONC_IP)),
  );

  // At least one call must have crossed the threshold and returned true
  const anyBlocked = results.some(Boolean);
  check("At least one parallel call returns blocked=true", anyBlocked, true);
  check("isIpBlocked after 10 parallel failures", await isIpBlocked(CONC_IP), true);

  // Verify the DB count is exactly 10 (no duplicates, no drops)
  const pool2 = new Pool({ connectionString: DB_URL, max: 1 });
  const { rows } = await pool2.query(
    "SELECT count FROM ip_failure_tracker WHERE ip = $1",
    [CONC_IP],
  );
  await pool2.end();
  check("DB count = 10 after 10 parallel failures (no lost updates)", rows[0]?.count, 10);

  await resetIpFailures(CONC_IP);

  // Throttler storage: 6 parallel hits at limit=5 — at least one should be blocked
  // (stock @nestjs/throttler uses > limit; first 5 pass, 6th and beyond are blocked)
  section("Concurrency: PgThrottlerStorage parallel hits");

  const storage3 = new PgThrottlerStorage();
  const concKey  = `conc-key-${Date.now()}`;
  const concResults = await Promise.all(
    Array.from({ length: 6 }, () =>
      storage3.increment(concKey, 60_000, 5, 60_000, "test-conc"),
    ),
  );

  const maxHits = Math.max(...concResults.map((r) => r.totalHits));
  check("Max totalHits after 6 parallel increments = 6", maxHits, 6);

  const anyThrottleBlocked = concResults.some((r) => r.isBlocked);
  check("At least one of 6 parallel results reports isBlocked=true", anyThrottleBlocked, true);

  // Clean up
  const pool3 = new Pool({ connectionString: DB_URL, max: 1 });
  await pool3.query(
    "DELETE FROM throttle_hits WHERE key = $1 AND throttler_name = $2",
    [concKey, "test-conc"],
  );
  await pool3.end();
}

// ── Run all tests ─────────────────────────────────────────────────────────────

(async () => {
  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("  Rate-limit persistence tests (task #52)");
  console.log("═══════════════════════════════════════════════════════════════════════════");

  try {
    await runAuthFailureTrackerTests();
    await runThrottlerStorageTests();
    await runConcurrencyTests();
  } catch (err) {
    console.error("\n[FATAL] Unexpected error during tests:", err);
    process.exit(1);
  }

  console.log(`\n${"═".repeat(75)}`);
  console.log(`  Results: ${passed}/${total} passed`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    for (const f of failures) console.log(f);
  }
  console.log("═".repeat(75));

  process.exit(failed > 0 ? 1 : 0);
})();
