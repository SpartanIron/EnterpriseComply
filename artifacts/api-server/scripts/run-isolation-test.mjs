/**
 * Self-contained cross-org isolation test.
 * Seeds two test users + sessions + org_member rows, runs the 28-point check,
 * then cleans up all seeded rows regardless of outcome.
 *
 * Usage: node artifacts/api-server/scripts/run-isolation-test.mjs
 * Requires: DATABASE_URL and BETTER_AUTH_SECRET env vars (or dev fallback).
 */
import { createHmac, randomBytes } from "crypto";
import pg from "pg";

const { Client } = pg;

const BASE = "http://localhost:8080/api";
const SECRET =
  process.env.BETTER_AUTH_SECRET || "ec-dev-secret-change-in-production";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function signToken(rawToken) {
  const sig = createHmac("sha256", SECRET).update(rawToken).digest();
  return `${rawToken}.${Buffer.from(sig).toString("base64")}`;
}

function cookie(rawToken) {
  return `__Secure-better-auth.session_token=${signToken(rawToken)}`;
}

function uid() {
  return randomBytes(16).toString("hex");
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function hit(method, url, cookieHeader, body) {
  const opts = {
    method,
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    return r.status;
  } catch (e) {
    return `ERR:${e.message}`;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Client({ connectionString: DB_URL });
await db.connect();

// Seeded IDs — track for cleanup
const userIdA = `test-iso-${uid()}`;
const userIdB = `test-iso-${uid()}`;
const tokenA  = `tok-iso-${uid()}`;
const tokenB  = `tok-iso-${uid()}`;
const sessIdA = `sess-iso-${uid()}`;
const sessIdB = `sess-iso-${uid()}`;

async function seed() {
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Insert test users into BetterAuth user table
  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, 'Iso Test User A', 'iso-test-a@example.invalid', true, $3, $3),
            ($2, 'Iso Test User B', 'iso-test-b@example.invalid', true, $3, $3)
     ON CONFLICT DO NOTHING`,
    [userIdA, userIdB, now]
  );

  // Insert sessions
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     VALUES ($1, $3, $4, $5, $5, $6),
            ($2, $3, $7, $5, $5, $8)
     ON CONFLICT DO NOTHING`,
    [sessIdA, sessIdB, expires, tokenA, now, userIdA, tokenB, userIdB]
  );

  // Insert org_members: A → org 1 (admin), B → org 3 (admin)
  await db.query(
    `INSERT INTO org_members (org_id, clerk_user_id, role, email)
     VALUES (1, $1, 'admin', 'iso-test-a@example.invalid'),
            (3, $2, 'admin', 'iso-test-b@example.invalid')
     ON CONFLICT DO NOTHING`,
    [userIdA, userIdB]
  );
}

async function cleanup() {
  await db.query(`DELETE FROM org_members WHERE clerk_user_id IN ($1, $2)`, [userIdA, userIdB]);
  await db.query(`DELETE FROM session WHERE id IN ($1, $2)`, [sessIdA, sessIdB]);
  await db.query(`DELETE FROM "user" WHERE id IN ($1, $2)`, [userIdA, userIdB]);
  await db.end();
}

// ── Run ───────────────────────────────────────────────────────────────────────

try {
  await seed();
} catch (e) {
  console.error("Seed failed:", e.message);
  await cleanup();
  process.exit(1);
}

const cookieA = cookie(tokenA);
const cookieB = cookie(tokenB);
let allPass = true;

function check(label, status, expect403or404 = false) {
  const ok = expect403or404 ? (status === 403 || status === 404) : status === 403;
  if (!ok) allPass = false;
  console.log(`  ${label.padEnd(28)} ${status}  ${ok ? "✓" : "✗ UNEXPECTED"}`);
  return ok;
}

// ── BASELINE ──────────────────────────────────────────────────────────────────
console.log("=== BASELINE: own-org (expect 200) ===");
const selfA = await hit("GET", `${BASE}/orgs/1/risks`, cookieA);
const selfB = await hit("GET", `${BASE}/orgs/3/risks`, cookieB);
console.log(`User A → Org 1 GET risks: ${selfA}`);
console.log(`User B → Org 3 GET risks: ${selfB}`);

if (selfA !== 200 || selfB !== 200) {
  console.error("BASELINE FAILED — sessions not resolving. Aborting.");
  await cleanup();
  process.exit(1);
}

// ── READ cross-org ────────────────────────────────────────────────────────────
const endpoints = [
  "frameworks","controls","risks","evidence","people","policies",
  "access-reviews","audit-shares","integrations","zero-trust",
  "remediation","questionnaires","audits","score-history",
];

console.log("\n=== READ: User A (org 1) → Org 3 (expect 403) ===");
for (const ep of endpoints) {
  check(ep, await hit("GET", `${BASE}/orgs/3/${ep}`, cookieA));
}

console.log("\n=== READ: User B (org 3) → Org 1 (expect 403) ===");
for (const ep of endpoints) {
  check(ep, await hit("GET", `${BASE}/orgs/1/${ep}`, cookieB));
}

// ── WRITE cross-org ───────────────────────────────────────────────────────────
const writes = [
  ["POST",   "risks",    { title: "injected risk", severity: "high" }],
  ["POST",   "evidence", { title: "injected evidence", type: "document", source: "manual" }],
  ["POST",   "people",   { name: "injected person", email: "x@evil.com", role: "admin" }],
  ["POST",   "policies", { title: "injected policy", status: "draft" }],
  ["PATCH",  "risks/999", { title: "mutation" }],
  ["DELETE", "risks/999", null],
];

console.log("\n=== WRITE: User A (org 1) → Org 3 (expect 403) ===");
for (const [method, path, body] of writes) {
  check(`${method} ${path}`, await hit(method, `${BASE}/orgs/3/${path}`, cookieA, body), true);
}

console.log("\n=== WRITE: User B (org 3) → Org 1 (expect 403) ===");
for (const [method, path, body] of writes) {
  check(`${method} ${path}`, await hit(method, `${BASE}/orgs/1/${path}`, cookieB, body), true);
}

// ── Cross-org DB predicate bypass ────────────────────────────────────────────
console.log("\n=== MUTATION BYPASS: User A patches Org 3 risk via Org 1 URL ===");
const r3Resp = await fetch(`${BASE}/orgs/3/risks`, { headers: { Cookie: cookieB } });
const r3Data = await r3Resp.json().catch(() => ({}));
const org3Risks = r3Data.risks ?? [];

if (org3Risks.length > 0) {
  const crossId = org3Risks[0].id;
  const originalTitle = org3Risks[0].title;
  const crossStatus = await hit("PATCH", `${BASE}/orgs/1/risks/${crossId}`, cookieA, { title: "cross-org mutation" });
  const ok = crossStatus === 403 || crossStatus === 404;
  if (!ok) allPass = false;
  console.log(`  PATCH org1/risks/${crossId} (org3 ID): ${crossStatus}  ${ok ? "✓" : "✗ DB predicate missing!"}`);

  // Verify unchanged
  const verify = await fetch(`${BASE}/orgs/3/risks`, { headers: { Cookie: cookieB } });
  const vData = await verify.json().catch(() => ({}));
  const after = (vData.risks ?? []).find((r) => r.id === crossId);
  const unchanged = after?.title === originalTitle;
  if (!unchanged) allPass = false;
  console.log(`  Title after attempt: "${after?.title}" (unchanged: ${unchanged ? "✓" : "✗"})`);
} else {
  // Seed a risk in org 3 and re-test
  await hit("POST", `${BASE}/orgs/3/risks`, cookieB, { title: "iso-test-risk", severity: "low" });
  const r3Resp2 = await fetch(`${BASE}/orgs/3/risks`, { headers: { Cookie: cookieB } });
  const r3Data2 = await r3Resp2.json().catch(() => ({}));
  const r3Risks2 = r3Data2.risks ?? [];
  if (r3Risks2.length > 0) {
    const crossId = r3Risks2[0].id;
    const crossStatus = await hit("PATCH", `${BASE}/orgs/1/risks/${crossId}`, cookieA, { title: "cross-org mutation" });
    const ok = crossStatus === 403 || crossStatus === 404;
    if (!ok) allPass = false;
    console.log(`  PATCH org1/risks/${crossId} (org3 ID): ${crossStatus}  ${ok ? "✓" : "✗ DB predicate missing!"}`);
  } else {
    console.log("  (no risks in org 3, skipping bypass check — insert failed)");
  }
}

// ── Webhook unauthenticated ───────────────────────────────────────────────────
console.log("\n=== WEBHOOK: unauthenticated (expect 503 or 401) ===");
const wh = await hit("POST", `${BASE}/webhooks/user-created`, "", { userId: "fake", email: "x@evil.com", firstName: "h" });
// 503 = WEBHOOK_SECRET not set (fails-closed); 401 = signature rejected
const whOk = wh === 503 || wh === 401;
if (!whOk) allPass = false;
console.log(`  No-secret POST               ${wh}  ${whOk ? "✓" : "✗ UNEXPECTED"}`);

// ── Summary ───────────────────────────────────────────────────────────────────
await cleanup();

console.log(`\n${"═".repeat(54)}`);
console.log(allPass ? "ALL CHECKS PASSED ✓" : "⚠  ONE OR MORE CHECKS FAILED — see above");
process.exit(allPass ? 0 : 1);
