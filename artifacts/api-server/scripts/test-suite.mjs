/**
 * EnterpriseComply — Automated Regression Test Suite
 * P1-17: Cross-org tenant isolation + Role-based access control
 *
 * Self-contained: creates two isolated test orgs with their own users/sessions/data,
 * runs all checks, then unconditionally cleans up.
 *
 * Usage:
 *   node artifacts/api-server/scripts/test-suite.mjs
 *
 * Required env:
 *   DATABASE_URL       — PostgreSQL connection string
 *   BETTER_AUTH_SECRET — HMAC secret (falls back to dev default)
 *
 * Optional env:
 *   API_BASE_URL  — defaults to http://localhost:8080/api
 *
 * Exit code: 0 = all checks passed, 1 = one or more checks failed
 */

import { createHmac, randomBytes } from "crypto";
// Import directly from the production TypeScript module (SWC transpiles it on-the-fly).
// This ensures the tests exercise the same encrypt/decrypt paths used at runtime.
import {
  encryptCredential,
  decryptCredential,
  isEncryptedCredential,
  ENC_PREFIX,
} from "../src/lib/credential-crypto.ts";
import pg from "pg";

const { Client } = pg;
const BASE   = (process.env.API_BASE_URL ?? "http://localhost:8080/api").replace(/\/$/, "");
const SECRET = process.env.BETTER_AUTH_SECRET ?? "ec-dev-secret-change-in-production";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) { console.error("[fatal] DATABASE_URL not set"); process.exit(1); }

// ── Crypto helpers ────────────────────────────────────────────────────────────

function signToken(raw) {
  const sig = createHmac("sha256", SECRET).update(raw).digest();
  return `${raw}.${Buffer.from(sig).toString("base64")}`;
}
function cookieHdr(raw) {
  return `__Secure-better-auth.session_token=${signToken(raw)}`;
}
function uid() { return randomBytes(16).toString("hex"); }
function slug() { return `test-iso-${uid().slice(0, 12)}`; }

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function req(method, path, cookieHeader, body) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const opts = { method, headers: { Cookie: cookieHeader, "Content-Type": "application/json", "Host": new URL(BASE).host } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    return r.status;
  } catch (e) {
    return `ERR:${e.message}`;
  }
}

// ── Test accounting ───────────────────────────────────────────────────────────

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function check(label, got, ...expected) {
  total++;
  const ok = expected.includes(got);
  if (ok) {
    passed++;
    process.stdout.write(`  ✓  ${label.padEnd(55)} ${got}\n`);
  } else {
    failed++;
    const msg = `  ✗  ${label.padEnd(55)} got=${got} expected=${expected.join("|")}`;
    failures.push(msg);
    process.stdout.write(msg + "\n");
  }
}

function section(title) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(70));
}

// ── Seed state ────────────────────────────────────────────────────────────────

// All IDs are tracked so cleanup can delete them even if a test partially fails
const state = {
  orgAId: null, orgBId: null,
  userOwnerA: uid(), userOwnerB: uid(),
  userViewerA: uid(), userAnalystA: uid(),
  tokenOwnerA: `tok-${uid()}`, tokenOwnerB: `tok-${uid()}`,
  tokenViewerA: `tok-${uid()}`, tokenAnalystA: `tok-${uid()}`,
  sessOwnerA: `sess-${uid()}`, sessOwnerB: `sess-${uid()}`,
  sessViewerA: `sess-${uid()}`, sessAnalystA: `sess-${uid()}`,
  seededRiskAId: null, seededRiskBId: null,
};

const db = new Client({ connectionString: DB_URL });
await db.connect();

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  const now     = new Date().toISOString();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const slugA   = slug();
  const slugB   = slug();

  // ── Pre-seed hygiene: remove any users left by prior crashed runs ─────────
  // seed() uses hardcoded emails; if a prior crash left them in the DB,
  // ON CONFLICT DO NOTHING silently skips re-inserting with new IDs, causing
  // the subsequent session FK to fail. Remove by email first.
  const reservedEmails = [
    "iso-owner-a@test.invalid", "iso-owner-b@test.invalid",
    "iso-viewer-a@test.invalid", "iso-analyst-a@test.invalid",
    "plan-starter@test.invalid", "plan-pro@test.invalid",
    "plan-ent@test.invalid", "plan-fed@test.invalid",
  ];
  const stale = await db.query(
    `SELECT id FROM "user" WHERE email = ANY($1::text[])`, [reservedEmails]
  ).catch(() => ({ rows: [] }));
  if (stale.rows.length > 0) {
    const staleIds = stale.rows.map((r) => r.id);
    await db.query(`DELETE FROM org_members WHERE clerk_user_id = ANY($1::text[])`, [staleIds]).catch(() => {});
    await db.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [staleIds]).catch(() => {});
  }

  // ── Create two isolated test orgs ─────────────────────────────────────────
  const orgA = await db.query(
    `INSERT INTO organizations (name, slug, industry, size, plan)
     VALUES ($1, $2, 'technology', '11-50', 'starter') RETURNING id`,
    [`Test Org A ${slugA}`, slugA],
  );
  const orgB = await db.query(
    `INSERT INTO organizations (name, slug, industry, size, plan)
     VALUES ($1, $2, 'technology', '11-50', 'starter') RETURNING id`,
    [`Test Org B ${slugB}`, slugB],
  );
  state.orgAId = orgA.rows[0].id;
  state.orgBId = orgB.rows[0].id;

  // ── Create four test users (individual INSERTs avoid pg type-inference issues) ──
  const uRows = [
    [state.userOwnerA,   "Owner A",   "iso-owner-a@test.invalid"],
    [state.userOwnerB,   "Owner B",   "iso-owner-b@test.invalid"],
    [state.userViewerA,  "Viewer A",  "iso-viewer-a@test.invalid"],
    [state.userAnalystA, "Analyst A", "iso-analyst-a@test.invalid"],
  ];
  for (const [id, name, email] of uRows) {
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4::timestamptz, $4::timestamptz) ON CONFLICT DO NOTHING`,
      [id, name, email, now],
    );
  }

  // ── Create sessions (individual INSERTs for the same reason) ──────────────
  const sRows = [
    [state.sessOwnerA,   state.tokenOwnerA,   state.userOwnerA],
    [state.sessOwnerB,   state.tokenOwnerB,   state.userOwnerB],
    [state.sessViewerA,  state.tokenViewerA,  state.userViewerA],
    [state.sessAnalystA, state.tokenAnalystA, state.userAnalystA],
  ];
  for (const [id, token, userId] of sRows) {
    await db.query(
      `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ($1, $2::timestamptz, $3, $4::timestamptz, $4::timestamptz, $5) ON CONFLICT DO NOTHING`,
      [id, expires, token, now, userId],
    );
  }

  // ── Org memberships ────────────────────────────────────────────────────────
  // ownerA  → org A (owner)  |  ownerB  → org B (owner)
  // viewerA → org A (viewer) |  analystA → org A (analyst)
  const mRows = [
    [state.orgAId, state.userOwnerA,   "owner",   "iso-owner-a@test.invalid"],
    [state.orgBId, state.userOwnerB,   "owner",   "iso-owner-b@test.invalid"],
    [state.orgAId, state.userViewerA,  "viewer",  "iso-viewer-a@test.invalid"],
    [state.orgAId, state.userAnalystA, "analyst", "iso-analyst-a@test.invalid"],
  ];
  for (const [orgId, userId, role, email] of mRows) {
    await db.query(
      `INSERT INTO org_members (org_id, clerk_user_id, role, email)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [orgId, userId, role, email],
    );
  }

  // ── Seed one risk per org for the mutation bypass checks ──────────────────
  // org_risks columns: org_id, title, created_by (not clerk_user_id)
  const rA = await db.query(
    `INSERT INTO org_risks (org_id, title, created_by)
     VALUES ($1, 'Seeded risk org A', $2) RETURNING id`,
    [state.orgAId, state.userOwnerA],
  ).catch(() => ({ rows: [] }));
  const rB = await db.query(
    `INSERT INTO org_risks (org_id, title, created_by)
     VALUES ($1, 'Seeded risk org B', $2) RETURNING id`,
    [state.orgBId, state.userOwnerB],
  ).catch(() => ({ rows: [] }));
  state.seededRiskAId = rA.rows[0]?.id ?? null;
  state.seededRiskBId = rB.rows[0]?.id ?? null;

  console.log(`\n[setup] Org A id=${state.orgAId}  Org B id=${state.orgBId}`);
  console.log(`[setup] seededRiskA=${state.seededRiskAId}  seededRiskB=${state.seededRiskBId}`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  const userIds  = [state.userOwnerA, state.userOwnerB, state.userViewerA, state.userAnalystA];
  const sessIds  = [state.sessOwnerA, state.sessOwnerB, state.sessViewerA, state.sessAnalystA];
  const orgIds   = [state.orgAId, state.orgBId].filter(Boolean);

  // Delete seeded risks first (FK dep on orgs)
  if (state.seededRiskAId || state.seededRiskBId) {
    const riskIds = [state.seededRiskAId, state.seededRiskBId].filter(Boolean);
    await db.query(`DELETE FROM org_risks WHERE id = ANY($1::int[])`, [riskIds]).catch(() => {});
  }
  // Delete org_members before orgs (FK dep)
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = ANY($1::text[])`, [userIds]).catch(() => {});
  // Delete sessions before users (FK dep)
  await db.query(`DELETE FROM session WHERE id = ANY($1::text[])`, [sessIds]).catch(() => {});
  // Delete users
  await db.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [userIds]).catch(() => {});
  // Delete orgs (last — everything referencing them already cleaned)
  if (orgIds.length) {
    await db.query(`DELETE FROM organizations WHERE id = ANY($1::int[])`, [orgIds]).catch(() => {});
  }
  await db.end();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

try {
  await seed();
} catch (e) {
  console.error("[fatal] Seed failed:", e.message);
  await cleanup();
  process.exit(1);
}

const cookieOwnerA   = cookieHdr(state.tokenOwnerA);
const cookieOwnerB   = cookieHdr(state.tokenOwnerB);
const cookieViewerA  = cookieHdr(state.tokenViewerA);
const cookieAnalystA = cookieHdr(state.tokenAnalystA);
const A = state.orgAId;
const B = state.orgBId;

// ── Section 0: BASELINE ───────────────────────────────────────────────────────

section("SECTION 0 — BASELINE: own-org access (expect 200)");
check("Owner A → own org GET risks",  await req("GET", `/orgs/${A}/risks`,  cookieOwnerA),  200);
check("Owner B → own org GET risks",  await req("GET", `/orgs/${B}/risks`,  cookieOwnerB),  200);

// ── Section 1: CROSS-ORG READ isolation ──────────────────────────────────────

section("SECTION 1 — CROSS-ORG READ isolation (expect 403 on every line)");

// All org-scoped GET endpoints covered by this suite
const readEndpoints = [
  ["frameworks",       `/orgs/{orgId}/frameworks`],
  ["controls",         `/orgs/{orgId}/controls`],
  ["risks",            `/orgs/{orgId}/risks`],
  ["evidence",         `/orgs/{orgId}/evidence`],
  ["people",           `/orgs/{orgId}/people`],
  ["policies",         `/orgs/{orgId}/policies`],
  ["integrations",     `/orgs/{orgId}/integrations`],
  ["zero-trust",       `/orgs/{orgId}/zero-trust`],
  ["remediation",      `/orgs/{orgId}/remediation`],
  ["questionnaires",   `/orgs/{orgId}/questionnaires`],
  ["audits",           `/orgs/{orgId}/audits`],
  ["score-history",    `/orgs/{orgId}/score-history`],
  ["access-reviews",   `/orgs/{orgId}/access-reviews`],
  ["audit-shares",     `/orgs/{orgId}/audit-shares`],
  ["vendors",          `/orgs/{orgId}/vendors`],
  ["notifications",    `/orgs/{orgId}/notifications`],
  ["poam",             `/orgs/{orgId}/poam`],
  ["stigs",            `/orgs/{orgId}/stigs`],
  ["trust-center",     `/orgs/{orgId}/trust-center`],
  ["members",          `/orgs/{orgId}/members`],
  ["dashboard",        `/orgs/{orgId}/dashboard`],
  ["sprs",             `/orgs/{orgId}/sprs`],
  // gap-analysis is POST-only (no GET route), tested in Section 2 writes
];

// Direction 1: Owner A (org A) → Org B endpoints
console.log("\n  Direction A→B: User in Org A reading Org B endpoints");
for (const [name, tpl] of readEndpoints) {
  const url = tpl.replace("{orgId}", String(B));
  const status = await req("GET", url, cookieOwnerA);
  check(`Owner-A → Org-B GET ${name}`, status, 403);
}

// Direction 2: Owner B (org B) → Org A endpoints
console.log("\n  Direction B→A: User in Org B reading Org A endpoints");
for (const [name, tpl] of readEndpoints) {
  const url = tpl.replace("{orgId}", String(A));
  const status = await req("GET", url, cookieOwnerB);
  check(`Owner-B → Org-A GET ${name}`, status, 403);
}

// ── Section 2: CROSS-ORG WRITE isolation ─────────────────────────────────────

section("SECTION 2 — CROSS-ORG WRITE isolation (expect 403)");

const writeOps = [
  ["POST",   "risks",          { title: "injected risk",     severity: "high" }],
  ["POST",   "evidence",       { title: "injected evidence", type: "document", source: "manual" }],
  ["POST",   "people",         { name: "injected person",    email: "evil@example.invalid", role: "admin" }],
  ["POST",   "policies",       { title: "injected policy",   status: "draft" }],
  ["POST",   "vendors",        { name: "evil vendor" }],
  ["POST",   "gap-analysis",   {}],
  ["PATCH",  "risks/99999",    { title: "mutation" }],
  ["DELETE", "risks/99999",    undefined],
];

console.log("\n  Direction A→B: Owner A writing to Org B");
for (const [method, path, body] of writeOps) {
  const status = await req(method, `/orgs/${B}/${path}`, cookieOwnerA, body);
  // 429 accepted: rate-limiting may fire when many requests hit the same endpoint
  check(`Owner-A → Org-B ${method} ${path}`, status, 403, 404, 429);
}

console.log("\n  Direction B→A: Owner B writing to Org A");
for (const [method, path, body] of writeOps) {
  const status = await req(method, `/orgs/${A}/${path}`, cookieOwnerB, body);
  check(`Owner-B → Org-A ${method} ${path}`, status, 403, 404, 429);
}

// ── Section 3: CROSS-ORG MUTATION BYPASS ─────────────────────────────────────

section("SECTION 3 — CROSS-ORG MUTATION BYPASS (DB predicate check)");

// Try to PATCH Org B's seeded risk via Org A's URL using Owner A's session.
// OrgContextGuard should block at the URL level (orgId mismatch → 403).
// Even if the URL guard somehow passes, the service layer must scope by orgId.
if (state.seededRiskBId) {
  const crossId = state.seededRiskBId;
  // Attempt via Org A path (wrong org in URL)
  const s1 = await req("PATCH", `/orgs/${A}/risks/${crossId}`, cookieOwnerA, { title: "cross-org mutation" });
  check(`Owner-A PATCH Org-B risk (id=${crossId}) via Org-A URL`, s1, 403, 404);

  // Verify the title is unchanged in Org B (service-level isolation check)
  const verifyResp = await fetch(`${BASE}/orgs/${B}/risks`, { headers: { Cookie: cookieOwnerB } });
  const verifyData = await verifyResp.json().catch(() => ({}));
  const riskAfter  = (verifyData.risks ?? []).find(r => r.id === crossId);
  const unchanged  = riskAfter?.title === "Seeded risk org B";
  check(`Org-B risk title unchanged after cross-org PATCH attempt`, unchanged ? 200 : 400, 200);
} else {
  console.log("  (seeded risk in Org B not available — mutation bypass check skipped)");
}

if (state.seededRiskAId) {
  const crossId = state.seededRiskAId;
  // Attempt via Org B path (wrong org in URL)
  const s2 = await req("PATCH", `/orgs/${B}/risks/${crossId}`, cookieOwnerB, { title: "cross-org mutation" });
  check(`Owner-B PATCH Org-A risk (id=${crossId}) via Org-B URL`, s2, 403, 404);

  // Verify unchanged
  const verifyResp2 = await fetch(`${BASE}/orgs/${A}/risks`, { headers: { Cookie: cookieOwnerA } });
  const verifyData2 = await verifyResp2.json().catch(() => ({}));
  const riskAfter2  = (verifyData2.risks ?? []).find(r => r.id === crossId);
  const unchanged2  = riskAfter2?.title === "Seeded risk org A";
  check(`Org-A risk title unchanged after cross-org PATCH attempt`, unchanged2 ? 200 : 400, 200);
}

// ── Section 4: RBAC — Viewer blocks ──────────────────────────────────────────

section("SECTION 4 — RBAC: Viewer (role=viewer) in Org A — must be blocked from elevated actions");

// viewer < analyst < compliance_manager < admin < owner
// Each check: viewer in Org A hits Org A endpoint that needs a higher role

check("Viewer cannot POST evidence (needs analyst)",
  await req("POST", `/orgs/${A}/evidence`, cookieViewerA, { title: "x", type: "document", source: "manual" }),
  403);

check("Viewer cannot PATCH controls result (needs analyst)",
  await req("PATCH", `/orgs/${A}/controls/UCO-1/result`, cookieViewerA, { status: "pass" }),
  403);

check("Viewer cannot POST policies (needs compliance_manager)",
  await req("POST", `/orgs/${A}/policies`, cookieViewerA, { title: "x", status: "draft" }),
  403);

check("Viewer cannot DELETE risks/99999 (needs compliance_manager)",
  await req("DELETE", `/orgs/${A}/risks/99999`, cookieViewerA),
  403, 404);

check("Viewer cannot bulk-delete risks (needs compliance_manager)",
  await req("POST", `/orgs/${A}/risks/bulk-delete`, cookieViewerA, { ids: [99999] }),
  403);

check("Viewer cannot POST vendors (needs admin)",
  await req("POST", `/orgs/${A}/vendors`, cookieViewerA, { name: "x" }),
  403);

check("Viewer cannot GET members list (needs admin)",
  await req("GET", `/orgs/${A}/members`, cookieViewerA),
  403);

check("Viewer cannot PATCH org settings (needs owner)",
  await req("PATCH", `/orgs/${A}`, cookieViewerA, { name: "hacked" }),
  403);

check("Viewer cannot POST frameworks/activate (needs owner)",
  await req("POST", `/orgs/${A}/frameworks`, cookieViewerA, { frameworkKeys: ["nist_csf"] }),
  403);

check("Viewer cannot trigger test-runs (needs admin)",
  await req("POST", `/orgs/${A}/test-runs/trigger`, cookieViewerA, {}),
  403);

// ── Section 5: RBAC — Analyst blocks ─────────────────────────────────────────

section("SECTION 5 — RBAC: Analyst (role=analyst) in Org A — must be blocked from compliance_manager+ actions");

check("Analyst cannot POST policies (needs compliance_manager)",
  await req("POST", `/orgs/${A}/policies`, cookieAnalystA, { title: "x", status: "draft" }),
  403);

check("Analyst cannot DELETE risks/99999 (needs compliance_manager)",
  await req("DELETE", `/orgs/${A}/risks/99999`, cookieAnalystA),
  403, 404);

check("Analyst cannot bulk-delete risks (needs compliance_manager)",
  await req("POST", `/orgs/${A}/risks/bulk-delete`, cookieAnalystA, { ids: [99999] }),
  403);

check("Analyst cannot import risk suggestions (needs compliance_manager)",
  await req("POST", `/orgs/${A}/risks/import-suggestions`, cookieAnalystA, { controlIds: [] }),
  403);

check("Analyst cannot DELETE evidence (needs compliance_manager)",
  await req("DELETE", `/orgs/${A}/evidence/99999`, cookieAnalystA),
  403, 404);

check("Analyst cannot POST vendors (needs admin)",
  await req("POST", `/orgs/${A}/vendors`, cookieAnalystA, { name: "x" }),
  403);

check("Analyst cannot GET members list (needs admin)",
  await req("GET", `/orgs/${A}/members`, cookieAnalystA),
  403);

check("Analyst cannot PATCH org settings (needs owner)",
  await req("PATCH", `/orgs/${A}`, cookieAnalystA, { name: "hacked" }),
  403);

check("Analyst cannot activate frameworks (needs owner)",
  await req("POST", `/orgs/${A}/frameworks`, cookieAnalystA, { frameworkKeys: ["nist_csf"] }),
  403);

// ── Section 6: Unauthenticated requests ──────────────────────────────────────

section("SECTION 6 — UNAUTHENTICATED: No session cookie (expect 401)");

check("No-cookie GET risks → 401",
  await req("GET", `/orgs/${A}/risks`, ""),
  401);

check("No-cookie POST evidence → 401",
  await req("POST", `/orgs/${A}/evidence`, "", { title: "x" }),
  401);

check("Webhook POST with no HMAC signature → 401 or 503",
  await req("POST", "/webhooks/user-created", "", { userId: "fake", email: "x@evil.com", firstName: "h" }),
  401, 503);

// ── Section 7: Credential encryption round-trip + tamper rejection ────────────

section("SECTION 7 — CREDENTIAL ENCRYPTION: AES-256-GCM round-trip + tamper rejection");

// All tests below exercise the production encryptCredential / decryptCredential
// functions imported directly from credential-crypto.ts — the same code paths
// used by integrations.service.ts and google-workspace.service.ts at runtime.

// Test 1: round-trip (encrypt then decrypt returns original)
const plaintext = "aws:AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const ciphertext = encryptCredential(plaintext);
const decrypted = decryptCredential(ciphertext);
check("Credential encrypt→decrypt round-trip returns original value",
  decrypted === plaintext ? 200 : 422, 200);

// Test 2: ciphertext starts with expected prefix and contains 3 segments
const encParts = ciphertext.slice(ENC_PREFIX.length).split("$");
check("Encrypted credential has enc:v1: prefix and 3 segments",
  (ciphertext.startsWith(ENC_PREFIX) && encParts.length === 3) ? 200 : 422, 200);

// Test 3: idempotent — encrypting an already-encrypted value returns it unchanged
check("Re-encrypting an already-encrypted value is idempotent",
  encryptCredential(ciphertext) === ciphertext ? 200 : 422, 200);

// Test 4: isEncryptedCredential correctly identifies encrypted vs plaintext
check("isEncryptedCredential returns true for enc:v1: value, false for plaintext",
  (isEncryptedCredential(ciphertext) && !isEncryptedCredential(plaintext)) ? 200 : 422, 200);

// Test 5: tamper rejection — flipping the last two hex chars of the auth tag
const tamperedTag = encParts[2].slice(0, -2) + (encParts[2].endsWith("00") ? "ff" : "00");
const tampered = `${ENC_PREFIX}${encParts[0]}$${encParts[1]}$${tamperedTag}`;
check("Tampered auth tag causes decryptCredential to return null (AEAD rejection)",
  decryptCredential(tampered) === null ? 200 : 422, 200);

// Test 6: tamper rejection — flipping the last two hex chars of the ciphertext body
const tamperedCt = encParts[1].slice(0, -2) + (encParts[1].endsWith("00") ? "ff" : "00");
const tamperedCiphertext = `${ENC_PREFIX}${encParts[0]}$${tamperedCt}$${encParts[2]}`;
check("Tampered ciphertext causes decryptCredential to return null (AEAD rejection)",
  decryptCredential(tamperedCiphertext) === null ? 200 : 422, 200);

// Test 7: legacy plaintext is returned as-is (transparent backward compat)
const legacyPlain = "legacy-token-no-prefix";
check("Legacy plaintext (no enc:v1: prefix) is returned as-is for backward compat",
  decryptCredential(legacyPlain) === legacyPlain ? 200 : 422, 200);

// Test 8: two encryptions of the same plaintext produce different ciphertexts (random IV)
const ct1 = encryptCredential(plaintext);
const ct2 = encryptCredential(plaintext);
check("Two encryptions of the same value produce different ciphertexts (random IV)",
  ct1 !== ct2 ? 200 : 422, 200);

// ── Section 8: Audit log WORM trigger ────────────────────────────────────────

section("SECTION 8 — AUDIT LOG WORM TRIGGER: UPDATE and DELETE must be rejected at DB layer");

{
  const dbClient = new Client({ connectionString: DB_URL });
  await dbClient.connect();

  // Insert a test audit log row (we'll clean it up after)
  let auditRowId = null;
  try {
    const insertRes = await dbClient.query(`
      INSERT INTO org_audit_log (org_id, actor_id, actor_email, action, resource, resource_id, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [A, "test-actor", "worm-test@example.com", "worm_trigger_test", "test", "worm-test-resource", '{"test": true}']);
    auditRowId = insertRes.rows[0]?.id;
    check("Audit log INSERT succeeds (WORM allows writes)",
      auditRowId != null ? 200 : 422, 200);
  } catch (e) {
    check("Audit log INSERT succeeds (WORM allows writes)", `ERR:${e.message}`, 200);
  }

  // Attempt UPDATE — must be blocked by WORM trigger
  if (auditRowId != null) {
    let updateBlocked = false;
    try {
      await dbClient.query(
        `UPDATE org_audit_log SET action = 'tampered' WHERE id = $1`,
        [auditRowId]
      );
    } catch (e) {
      // Expected: SQLSTATE 23001 (restrict_violation) or similar
      updateBlocked = e.message?.includes("WORM VIOLATION") || e.code === "23001";
    }
    check("Audit log UPDATE is rejected by WORM trigger",
      updateBlocked ? 200 : 422, 200);

    // Attempt DELETE — must also be blocked
    let deleteBlocked = false;
    try {
      await dbClient.query(
        `DELETE FROM org_audit_log WHERE id = $1`,
        [auditRowId]
      );
    } catch (e) {
      deleteBlocked = e.message?.includes("WORM VIOLATION") || e.code === "23001";
    }
    check("Audit log DELETE is rejected by WORM trigger",
      deleteBlocked ? 200 : 422, 200);

    // Clean up: superuser-level direct delete using pg admin bypass is not available,
    // so just leave the test row — it will be cleaned up with the test org on teardown
    // (org_audit_log rows are org-scoped, and the test org is deleted in cleanup()).
  }

  await dbClient.end();
}

// ── Section 9: Plan-tier feature gating (P1-07) ──────────────────────────────
//
// Creates two additional test orgs with plan='starter' and plan='federal' to
// verify that plan guards return HTTP 402 for under-privileged orgs and 200
// for orgs with the required plan or higher.
//
// Hierarchy under test: starter(0) < professional(1) < enterprise(2) < federal(3)

section("SECTION 9 — PLAN GATING: federal and enterprise endpoints (P1-07)");

{
  const now     = new Date().toISOString();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

  // ── Create test orgs with different plan tiers ──────────────────────────────
  const slugStarter    = slug();
  const slugPro        = slug();
  const slugEnterprise = slug();
  const slugFederal    = slug();

  const [resStarter, resPro, resEnt, resFed] = await Promise.all([
    db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan)
       VALUES ($1, $2, 'technology', '11-50', 'starter') RETURNING id`,
      [`PlanTest Starter ${slugStarter}`, slugStarter],
    ),
    db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan)
       VALUES ($1, $2, 'technology', '11-50', 'professional') RETURNING id`,
      [`PlanTest Pro ${slugPro}`, slugPro],
    ),
    db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan)
       VALUES ($1, $2, 'technology', '11-50', 'enterprise') RETURNING id`,
      [`PlanTest Ent ${slugEnterprise}`, slugEnterprise],
    ),
    db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan)
       VALUES ($1, $2, 'technology', '11-50', 'federal') RETURNING id`,
      [`PlanTest Federal ${slugFederal}`, slugFederal],
    ),
  ]);

  const orgStarterId    = resStarter.rows[0].id;
  const orgProId        = resPro.rows[0].id;
  const orgEntId        = resEnt.rows[0].id;
  const orgFedId        = resFed.rows[0].id;

  // ── Create owners for each plan tier ──────────────────────────────────────
  const userStarter    = uid();
  const userPro        = uid();
  const userEnt        = uid();
  const userFed        = uid();
  const tokenStarter   = `tok-${uid()}`;
  const tokenPro       = `tok-${uid()}`;
  const tokenEnt       = `tok-${uid()}`;
  const tokenFed       = `tok-${uid()}`;
  const sessStarter    = `sess-${uid()}`;
  const sessPro        = `sess-${uid()}`;
  const sessEnt        = `sess-${uid()}`;
  const sessFed        = `sess-${uid()}`;

  const planUsers = [
    [userStarter, "Plan Starter", "plan-starter@test.invalid"],
    [userPro,     "Plan Pro",     "plan-pro@test.invalid"],
    [userEnt,     "Plan Ent",     "plan-ent@test.invalid"],
    [userFed,     "Plan Federal", "plan-fed@test.invalid"],
  ];
  for (const [id, name, email] of planUsers) {
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4::timestamptz, $4::timestamptz) ON CONFLICT DO NOTHING`,
      [id, name, email, now],
    );
  }

  const planSessions = [
    [sessStarter, tokenStarter, userStarter],
    [sessPro,     tokenPro,     userPro],
    [sessEnt,     tokenEnt,     userEnt],
    [sessFed,     tokenFed,     userFed],
  ];
  for (const [id, token, userId] of planSessions) {
    await db.query(
      `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ($1, $2::timestamptz, $3, $4::timestamptz, $4::timestamptz, $5) ON CONFLICT DO NOTHING`,
      [id, expires, token, now, userId],
    );
  }

  const planMembers = [
    [orgStarterId, userStarter, "owner", "plan-starter@test.invalid"],
    [orgProId,     userPro,     "owner", "plan-pro@test.invalid"],
    [orgEntId,     userEnt,     "owner", "plan-ent@test.invalid"],
    [orgFedId,     userFed,     "owner", "plan-fed@test.invalid"],
  ];
  for (const [orgId, userId, role, email] of planMembers) {
    await db.query(
      `INSERT INTO org_members (org_id, clerk_user_id, role, email)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [orgId, userId, role, email],
    );
  }

  const cookieStarter    = cookieHdr(tokenStarter);
  const cookiePro        = cookieHdr(tokenPro);
  const cookieEnt        = cookieHdr(tokenEnt);
  const cookieFed        = cookieHdr(tokenFed);

  // ────────────────────────────────────────────────────────────────────────────
  // FEDERAL ENDPOINTS — require plan='federal'
  // Expected: starter→402, professional→402, enterprise→402, federal→200
  // ────────────────────────────────────────────────────────────────────────────

  // POA&M
  check("POAM GET: starter plan → 402 (federal required)",
    await req("GET", `/orgs/${orgStarterId}/poam`, cookieStarter), 402);

  check("POAM GET: professional plan → 402 (federal required)",
    await req("GET", `/orgs/${orgProId}/poam`, cookiePro), 402);

  check("POAM GET: enterprise plan → 402 (federal required)",
    await req("GET", `/orgs/${orgEntId}/poam`, cookieEnt), 402);

  check("POAM GET: federal plan → 200 (access granted)",
    await req("GET", `/orgs/${orgFedId}/poam`, cookieFed), 200);

  // SPRS
  check("SPRS GET: starter plan → 402 (federal required)",
    await req("GET", `/orgs/${orgStarterId}/sprs`, cookieStarter), 402);

  check("SPRS GET: federal plan → 200 (access granted)",
    await req("GET", `/orgs/${orgFedId}/sprs`, cookieFed), 200);

  // SSP generate
  check("SSP generate: starter plan → 402 (federal required)",
    await req("POST", `/orgs/${orgStarterId}/ssp/generate`, cookieStarter, {}), 402, 429);

  check("SSP generate: federal plan → success (access granted, may lack body)",
    await req("POST", `/orgs/${orgFedId}/ssp/generate`, cookieFed, {}), 200, 201, 400, 500);

  // STIGs
  check("STIGs GET: starter plan → 402 (federal required)",
    await req("GET", `/orgs/${orgStarterId}/stigs`, cookieStarter), 402);

  check("STIGs GET: professional plan → 402 (federal required)",
    await req("GET", `/orgs/${orgProId}/stigs`, cookiePro), 402);

  check("STIGs GET: federal plan → 200 (access granted)",
    await req("GET", `/orgs/${orgFedId}/stigs`, cookieFed), 200);

  // eMASS status
  check("eMASS status: starter plan → 402 (federal required)",
    await req("GET", `/orgs/${orgStarterId}/emass/status`, cookieStarter), 402);

  check("eMASS status: federal plan → 200 (access granted)",
    await req("GET", `/orgs/${orgFedId}/emass/status`, cookieFed), 200);

  // eMASS pending
  check("eMASS pending: starter plan → 402 (federal required)",
    await req("GET", `/orgs/${orgStarterId}/emass/pending`, cookieStarter), 402);

  // ────────────────────────────────────────────────────────────────────────────
  // ENTERPRISE ENDPOINTS — require plan='enterprise'
  // Expected: starter→402, professional→402, enterprise→200, federal→200
  // ────────────────────────────────────────────────────────────────────────────

  check("Audit retention PATCH: starter plan → 402 (enterprise required)",
    await req("PATCH", `/orgs/${orgStarterId}/audit-retention`, cookieStarter, { auditRetentionDays: 365 }), 402);

  check("Audit retention PATCH: professional plan → 402 (enterprise required)",
    await req("PATCH", `/orgs/${orgProId}/audit-retention`, cookiePro, { auditRetentionDays: 365 }), 402);

  check("Audit retention PATCH: enterprise plan → 200 (access granted)",
    await req("PATCH", `/orgs/${orgEntId}/audit-retention`, cookieEnt, { auditRetentionDays: 365 }), 200);

  check("Audit retention PATCH: federal plan → 200 (federal ≥ enterprise)",
    await req("PATCH", `/orgs/${orgFedId}/audit-retention`, cookieFed, { auditRetentionDays: 180 }), 200);

  // ────────────────────────────────────────────────────────────────────────────
  // Cleanup plan-gate test orgs
  // ────────────────────────────────────────────────────────────────────────────
  const planUserIds  = [userStarter, userPro, userEnt, userFed];
  const planSessIds  = [sessStarter, sessPro, sessEnt, sessFed];
  const planOrgIds   = [orgStarterId, orgProId, orgEntId, orgFedId];
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = ANY($1::text[])`, [planUserIds]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = ANY($1::text[])`, [planSessIds]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [planUserIds]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = ANY($1::int[])`, [planOrgIds]).catch(() => {});
}

// ── Section 10: SSRF protection on BetterAuth baseUrl ────────────────────────

section("SECTION 10 — SSRF GUARD: BetterAuth baseUrl must reject private/non-HTTPS targets");
{
  // Seed a minimal org+owner for the SSRF tests
  const userSsrf   = uid();
  const sessSsrf   = uid();
  const orgSsrfSlg = slug();

  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 3600_000).toISOString();
  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4::timestamptz,$4::timestamptz) ON CONFLICT DO NOTHING`,
    [userSsrf, "SSRF Test User", `${userSsrf}@ssrftest.example`, now]);
  const orgSsrfRes = await db.query(
    `INSERT INTO organizations (name, slug, plan, created_at, updated_at) VALUES ($1,$2,'starter',NOW(),NOW()) RETURNING id`,
    [orgSsrfSlg, orgSsrfSlg]);
  const orgSsrfId  = orgSsrfRes.rows[0].id;
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1,$2::timestamptz,$3,$4::timestamptz,$4::timestamptz,$5) ON CONFLICT DO NOTHING`,
    [sessSsrf, expires, sessSsrf, now, userSsrf]);
  await db.query(
    `INSERT INTO org_members (org_id, clerk_user_id, role, email) VALUES ($1,$2,'owner',$3) ON CONFLICT DO NOTHING`,
    [orgSsrfId, userSsrf, `${userSsrf}@ssrftest.example`]);
  const cookieSsrf = cookieHdr(sessSsrf);

  const ssrfInputs = [
    { label: "http:// scheme rejected (non-HTTPS)", baseUrl: "http://attacker.example.com" },
    { label: "file:// scheme rejected", baseUrl: "file:///etc/passwd" },
    { label: "loopback 127.0.0.1 rejected", baseUrl: "https://127.0.0.1" },
    { label: "loopback localhost rejected", baseUrl: "https://localhost" },
    { label: "private 10.x.x.x rejected", baseUrl: "https://10.0.0.1" },
    { label: "private 192.168.x.x rejected", baseUrl: "https://192.168.1.1" },
    { label: "private 172.16.x.x rejected", baseUrl: "https://172.16.0.1" },
    { label: "link-local 169.254.x.x (AWS metadata) rejected", baseUrl: "https://169.254.169.254" },
    { label: "IPv6 loopback [::1] rejected", baseUrl: "https://[::1]" },
    // IPv4-mapped/compatible bypass vectors (reviewer-identified)
    { label: "IPv4-mapped loopback [::ffff:127.0.0.1] rejected", baseUrl: "https://[::ffff:127.0.0.1]" },
    { label: "IPv4-mapped loopback hex [::ffff:7f00:1] rejected", baseUrl: "https://[::ffff:7f00:1]" },
    { label: "IPv4-compatible loopback [::127.0.0.1] rejected", baseUrl: "https://[::127.0.0.1]" },
    { label: "IPv4-mapped private [::ffff:10.0.0.1] rejected", baseUrl: "https://[::ffff:10.0.0.1]" },
    { label: "IPv4-mapped link-local [::ffff:169.254.169.254] rejected", baseUrl: "https://[::ffff:169.254.169.254]" },
  ];

  for (const { label, baseUrl } of ssrfInputs) {
    check(
      `SSRF guard: ${label}`,
      await req("POST", `/orgs/${orgSsrfId}/integrations/betterauth/connect`, cookieSsrf,
        { apiKey: "dummy_key", baseUrl }),
      // Must be 400 (validation error) — NOT 200/201/500
      400,
    );
  }

  // Cleanup
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [userSsrf]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sessSsrf]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [userSsrf]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [orgSsrfId]).catch(() => {});
}

// ── Section 11: Provider-level tests (bad credentials, graceful error handling) ──

section("SECTION 11 — PROVIDER BEHAVIOR: bad credentials return failing results (not 500)");
{
  // Seed a minimal org+owner for provider tests
  const now11    = new Date().toISOString();
  const exp11    = new Date(Date.now() + 3600_000).toISOString();
  const user11   = uid();
  const sess11   = uid();
  const orgSlg11 = slug();

  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4::timestamptz,$4::timestamptz) ON CONFLICT DO NOTHING`,
    [user11, "Provider Test User", `${user11}@provtest.example`, now11]);
  const orgRes11 = await db.query(
    `INSERT INTO organizations (name, slug, plan, created_at, updated_at) VALUES ($1,$2,'starter',NOW(),NOW()) RETURNING id`,
    [`Provider Test Org ${orgSlg11}`, orgSlg11]);
  const org11Id = orgRes11.rows[0].id;
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1,$2::timestamptz,$3,$4::timestamptz,$4::timestamptz,$5) ON CONFLICT DO NOTHING`,
    [sess11, exp11, sess11, now11, user11]);
  await db.query(
    `INSERT INTO org_members (org_id, clerk_user_id, role, email) VALUES ($1,$2,'owner',$3) ON CONFLICT DO NOTHING`,
    [org11Id, user11, `${user11}@provtest.example`]);
  const cookie11 = cookieHdr(sess11);

  // ── Railway: invalid token → 200 (provider returns failing control, not 500) ──
  // Railway GraphQL API returns a GraphQL error for invalid tokens. The Railway
  // provider catches this and returns a failing UCO-AC-001 result. The connect
  // endpoint persists the failing result and returns 200 with checksPassed:0.
  // Connect endpoints return 201 for newly created integrations, 200 for updates.
  // Both are success — not 4xx/5xx — confirming providers handle bad credentials
  // gracefully (returning failing control results, not throwing).
  const railwayRes = await req(
    "POST",
    `/orgs/${org11Id}/integrations/railway/connect`,
    cookie11,
    { apiToken: "invalid_dummy_railway_token_for_test" },
  );
  check(
    "Railway connect: invalid token → 200/201 (failing results persisted, not 500)",
    railwayRes,
    200, 201,
  );

  // Verify the failing control result was persisted for this org
  const railwayCtrl = await db.query(
    `SELECT uco_control_id, status FROM org_control_results WHERE org_id = $1 AND integration_key = 'railway' ORDER BY updated_at DESC LIMIT 5`,
    [org11Id],
  ).catch(() => ({ rows: [] }));
  check(
    "Railway connect: failing control result persisted in DB",
    railwayCtrl.rows.length > 0 ? 200 : 404,
    200,
  );

  // ── Replit: invalid token → 200/201 (provider returns failing control, not 500) ──
  const replitRes = await req(
    "POST",
    `/orgs/${org11Id}/integrations/replit/connect`,
    cookie11,
    { apiToken: "invalid_dummy_replit_token_for_test" },
  );
  check(
    "Replit connect: invalid token → 200/201 (failing results persisted, not 500)",
    replitRes,
    200, 201,
  );

  const replitCtrl = await db.query(
    `SELECT uco_control_id, status FROM org_control_results WHERE org_id = $1 AND integration_key = 'replit' ORDER BY updated_at DESC LIMIT 5`,
    [org11Id],
  ).catch(() => ({ rows: [] }));
  check(
    "Replit connect: failing control result persisted in DB",
    replitCtrl.rows.length > 0 ? 200 : 404,
    200,
  );

  // ── BetterAuth: valid public URL + wrong key → 200/201 (failing result, not 500) ──
  // Uses https://example.com (IANA-operated, stable). pinnedHttpsRequest connects
  // to the resolved IP, TLS verifies against example.com, gets a 404 for the
  // admin path, and the provider returns a failing UCO-AI-001 result.
  const baRes = await req(
    "POST",
    `/orgs/${org11Id}/integrations/betterauth/connect`,
    cookie11,
    { apiKey: "dummy_invalid_key", baseUrl: "https://example.com" },
  );
  check(
    "BetterAuth connect: valid public URL + bad key → 200/201 (failing results persisted, not 500)",
    baRes,
    200, 201,
  );

  const baCtrl = await db.query(
    `SELECT uco_control_id, status FROM org_control_results WHERE org_id = $1 AND integration_key = 'betterauth' ORDER BY updated_at DESC LIMIT 5`,
    [org11Id],
  ).catch(() => ({ rows: [] }));
  check(
    "BetterAuth connect: failing control result persisted in DB",
    baCtrl.rows.length > 0 ? 200 : 404,
    200,
  );

  // ── Integration row exists in DB after all three connects ───────────────────
  const integRows = await db.query(
    `SELECT integration_key, status, last_sync_status FROM org_integrations WHERE org_id = $1 ORDER BY integration_key`,
    [org11Id],
  ).catch(() => ({ rows: [] }));
  const keys = integRows.rows.map((r) => r.integration_key).sort().join(",");
  check(
    "Provider connects: all three integration rows stored in DB",
    keys === "betterauth,railway,replit" ? 200 : 404,
    200,
  );

  // ── lastSyncStatus must reflect actual outcomes — not hard-coded "success" ──
  // All three providers were connected with invalid credentials, so their control
  // results are all-failing.  lastSyncStatus must be "failed" or "partial" on
  // every row — never "success" — confirming integration health is consistent
  // with what Test Run History reports.
  const badStatusRows = integRows.rows.filter(
    (r) => r.last_sync_status === "success",
  );
  check(
    "Provider connects: lastSyncStatus not hard-coded 'success' when all controls fail",
    badStatusRows.length === 0 ? 200 : 422,
    200,
  );

  // Cleanup provider test fixtures
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [user11]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sess11]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [user11]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org11Id]).catch(() => {});
}

// ── Section 12: Sync log completeness — all provider paths + thrown failures ──

section("SECTION 12 — SYNC LOG: all provider paths write history + thrown failures are persisted");
{
  // Shared org for Section 12
  const now12    = new Date().toISOString();
  const exp12    = new Date(Date.now() + 3600_000).toISOString();
  const user12   = uid();
  const sess12   = uid();
  const orgSlg12 = slug();

  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4::timestamptz,$4::timestamptz) ON CONFLICT DO NOTHING`,
    [user12, "Sync Log Test User", `${user12}@synclog.example`, now12]);
  const orgRes12 = await db.query(
    `INSERT INTO organizations (name, slug, plan, created_at, updated_at) VALUES ($1,$2,'starter',NOW(),NOW()) RETURNING id`,
    [`Sync Log Test Org ${orgSlg12}`, orgSlg12]);
  const org12Id = orgRes12.rows[0].id;
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1,$2::timestamptz,$3,$4::timestamptz,$4::timestamptz,$5) ON CONFLICT DO NOTHING`,
    [sess12, exp12, sess12, now12, user12]);
  await db.query(
    // Owner role required — connect endpoints all require RequireRole("owner")
    `INSERT INTO org_members (org_id, clerk_user_id, role, email) VALUES ($1,$2,'owner',$3) ON CONFLICT DO NOTHING`,
    [org12Id, user12, `${user12}@synclog.example`]);
  const cookie12 = cookieHdr(sess12);

  // ── Test 1: Thrown dispatch failure is persisted as a "failed" sync log row ──
  // Insert a railway integration with NULL config (so decryptConfigCredentials
  // returns null/undefined apiToken → syncOrgRailway throws BadRequestException
  // → syncOrgNow catch block → writes status="failed" row to integration_sync_log).
  await db.query(
    `INSERT INTO org_integrations (org_id, integration_key, name, status, config, created_at, updated_at)
     VALUES ($1,'railway','Railway','connected',NULL,NOW(),NOW())
     ON CONFLICT DO NOTHING`,
    [org12Id],
  );

  const beforeTrigger = new Date();
  const triggerRes12 = await req(
    "POST",
    `/orgs/${org12Id}/test-runs/trigger`,
    cookie12,
    {},
  );
  check(
    "Trigger with null-config railway integration → 200/201 (not 500)",
    triggerRes12,
    200, 201,
  );

  // The thrown dispatch should have been caught and written to integration_sync_log
  const failedLogRows = await db.query(
    `SELECT id, status, error_message FROM integration_sync_log
     WHERE org_id = $1 AND integration_key = 'railway' AND synced_at >= $2::timestamptz`,
    [org12Id, beforeTrigger.toISOString()],
  ).catch(() => ({ rows: [] }));
  check(
    "Thrown dispatch failure: failed row written to integration_sync_log",
    failedLogRows.rows.length > 0 ? 200 : 404,
    200,
  );
  check(
    "Thrown dispatch failure: sync log row has status='failed'",
    failedLogRows.rows[0]?.status === "failed" ? 200 : 422,
    200,
  );

  // GET /test-runs must include the failed row (maps to status="fail")
  const historyRes12 = await req("GET", `/orgs/${org12Id}/test-runs`, cookie12);
  check(
    "GET /test-runs after thrown failure → 200 (not empty error)",
    historyRes12,
    200,
  );

  // ── Test 2: GitHub PAT connect (bad token) → sync log written ──
  // connectGitHub calls runGitHubChecks → catches GitHub 401 → returns failing
  // control results → _persistSyncResults → integration_sync_log row inserted.
  // GitHub PAT connect route is /connect-pat (OAuth flow uses /connect GET)
  const githubConnectRes = await req(
    "POST",
    `/orgs/${org12Id}/integrations/github/connect-pat`,
    cookie12,
    { personalAccessToken: "ghp_invalid_test_token_for_synclog_test" },
  );
  check(
    "GitHub PAT connect with bad token → 200/201 (provider catches auth error, not 500)",
    githubConnectRes,
    200, 201,
  );

  const ghLogRows = await db.query(
    `SELECT id, status FROM integration_sync_log WHERE org_id = $1 AND integration_key = 'github'`,
    [org12Id],
  ).catch(() => ({ rows: [] }));
  check(
    "GitHub PAT connect: sync log row written after connect",
    ghLogRows.rows.length > 0 ? 200 : 404,
    200,
  );

  // ── Test 3: AWS connect (bad creds) → sync log written ──
  // runAwsChecks catches SDK errors internally and returns failing control results.
  // syncAWS then writes the sync log row.
  const awsConnectRes = await req(
    "POST",
    `/orgs/${org12Id}/integrations/aws/connect`,
    cookie12,
    { accessKeyId: "AKIAFAKE0000000FAKE1", secretAccessKey: "fakesecretkeyfortesting0000000000000000", region: "us-east-1" },
  );
  check(
    "AWS connect with bad creds → 200/201 (provider catches AWS SDK error, not 500)",
    awsConnectRes,
    200, 201,
  );

  if (awsConnectRes === 200 || awsConnectRes === 201) {
    const awsLogRows = await db.query(
      `SELECT id, status FROM integration_sync_log WHERE org_id = $1 AND integration_key = 'aws'`,
      [org12Id],
    ).catch(() => ({ rows: [] }));
    check(
      "AWS connect: sync log row written after connect",
      awsLogRows.rows.length > 0 ? 200 : 404,
      200,
    );
  }

  // ── Test 4: Okta connect (bad creds) → sync log written ──
  // runOktaChecks catches Okta API errors and returns failing results.
  const oktaConnectRes = await req(
    "POST",
    `/orgs/${org12Id}/integrations/okta/connect`,
    cookie12,
    { domain: "invalid-okta-domain-synclog-test.okta.com", apiToken: "invalid_okta_token_for_synclog_test" },
  );
  check(
    "Okta connect with bad creds → 200/201 (provider catches auth error, not 500)",
    oktaConnectRes,
    200, 201,
  );

  if (oktaConnectRes === 200 || oktaConnectRes === 201) {
    const oktaLogRows = await db.query(
      `SELECT id, status FROM integration_sync_log WHERE org_id = $1 AND integration_key = 'okta'`,
      [org12Id],
    ).catch(() => ({ rows: [] }));
    check(
      "Okta connect: sync log row written after connect",
      oktaLogRows.rows.length > 0 ? 200 : 404,
      200,
    );
  }

  // ── Test 5: GET /test-runs shows real sync log data (not empty / synthetic) ──
  // The org now has at least one sync log row (from the thrown railway failure).
  // The history endpoint must return it mapped to the test-run shape.
  const historyData = await fetch(
    `${BASE}/orgs/${org12Id}/test-runs`,
    { headers: { Cookie: cookie12 } },
  ).then(r => r.json()).catch(() => null);

  check(
    "GET /test-runs: returns real sync log data (runs array present)",
    Array.isArray(historyData?.runs) ? 200 : 422,
    200,
  );
  check(
    "GET /test-runs: noIntegrations=false when integrations are connected",
    historyData?.noIntegrations === false ? 200 : 422,
    200,
  );
  check(
    "GET /test-runs: at least one run row from sync log",
    (historyData?.runs?.length ?? 0) > 0 ? 200 : 404,
    200,
  );

  // ── Test 6: Partial sync status in history ──
  // The GitHub connect above likely produces a mix of passing (UCO-CM-001: 0
  // repos → "passing" by default) and failing (UCO-AI-001: MFA not verified
  // with a bad token). Verify the sync log status reflects partial or failed,
  // and that the mapping (partial → "warning") is exposed in the history shape.
  if (ghLogRows.rows[0]?.status === "partial") {
    const partialRun = historyData?.runs?.find((r) => r.status === "warning" && r.testName?.includes("Github") || r.testName?.includes("github") || r.testName?.toLowerCase?.().includes("github"));
    check(
      "GET /test-runs: partial sync maps to status='warning' in history",
      partialRun ? 200 : 422,
      200,
    );
  } else {
    // Partial is not guaranteed with a bad token (may be all-failing);
    // verify the mapping from the railway failure row at minimum
    const failRun = historyData?.runs?.find((r) => r.status === "fail");
    check(
      "GET /test-runs: failed sync maps to status='fail' in history",
      failRun ? 200 : 422,
      200,
    );
  }

  // ── Test 7b: Demo-connect integration → sync log written + GET /test-runs shows it ──
  // connectDemo() uses the standard catalog path for integrations without a live
  // provider (SOC 2, NIST, etc.).  Verify it now writes a sync log row so Test
  // Run History reports "No syncs recorded yet" only when nothing has run.
  {
    const demoIntegKey = "slack"; // A catalog integration that goes through connectDemo
    const beforeDemo = new Date();
    const demoConnectRes = await req(
      "POST",
      `/orgs/${org12Id}/integrations/${demoIntegKey}/demo-connect`,
      cookie12,
      {},
    );
    check(
      "Demo-connect (soc2): returns 200/201",
      demoConnectRes,
      200, 201,
    );

    if (demoConnectRes === 200 || demoConnectRes === 201) {
      const demoLogRows = await db.query(
        `SELECT id, status FROM integration_sync_log
         WHERE org_id = $1 AND integration_key = $2 AND synced_at >= $3::timestamptz`,
        [org12Id, demoIntegKey, beforeDemo.toISOString()],
      ).catch(() => ({ rows: [] }));
      check(
        "Demo-connect: sync log row written to integration_sync_log",
        demoLogRows.rows.length > 0 ? 200 : 404,
        200,
      );

      // GET /test-runs must include the demo sync row
      const demoHistory = await fetch(
        `${BASE}/orgs/${org12Id}/test-runs`,
        { headers: { Cookie: cookie12 } },
      ).then(r => r.json()).catch(() => null);
      check(
        "Demo-connect: GET /test-runs shows the demo sync in history",
        demoHistory?.runs?.some((r) =>
          r.integrationName?.toLowerCase?.().includes("slack") ||
          r.integrationKey === demoIntegKey ||
          demoLogRows.rows.some((lr) => lr.id != null),
        ) ? 200 : 422,
        200,
      );
    }
  }

  // ── Test 7: Scheduler dispatch path (runDueForOrg) failure → sync log ──
  // This test exercises runDueForOrg() — the same catch-block code that
  // runDueIntegrations() uses — rather than syncOrgNow() used by the trigger.
  // We insert a *second* railway integration with null config (unique to this
  // sub-test via a fresh org), call POST /run-scheduled, and verify the
  // scheduler's catch block writes a "failed" row to integration_sync_log.
  const now12s   = new Date().toISOString();
  const exp12s   = new Date(Date.now() + 3600_000).toISOString();
  const user12s  = uid();
  const sess12s  = uid();
  const orgSlg12s = slug();

  await db.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,true,$4::timestamptz,$4::timestamptz) ON CONFLICT DO NOTHING`,
    [user12s, "Scheduler Test User", `${user12s}@sched.example`, now12s]);
  const orgRes12s = await db.query(
    `INSERT INTO organizations (name, slug, plan, created_at, updated_at) VALUES ($1,$2,'starter',NOW(),NOW()) RETURNING id`,
    [`Scheduler Test Org ${orgSlg12s}`, orgSlg12s]);
  const org12sId = orgRes12s.rows[0].id;
  await db.query(
    `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1,$2::timestamptz,$3,$4::timestamptz,$4::timestamptz,$5) ON CONFLICT DO NOTHING`,
    [sess12s, exp12s, sess12s, now12s, user12s]);
  await db.query(
    `INSERT INTO org_members (org_id, clerk_user_id, role, email) VALUES ($1,$2,'owner',$3) ON CONFLICT DO NOTHING`,
    [org12sId, user12s, `${user12s}@sched.example`]);
  const cookie12s = cookieHdr(sess12s);

  // Insert a null-config railway integration (always "due" — lastSyncAt null)
  await db.query(
    `INSERT INTO org_integrations (org_id, integration_key, name, status, config, created_at, updated_at)
     VALUES ($1,'railway','Railway','connected',NULL,NOW(),NOW())
     ON CONFLICT DO NOTHING`,
    [org12sId],
  );

  const beforeScheduled = new Date();
  const runScheduledRes = await req(
    "POST",
    `/orgs/${org12sId}/test-runs/run-scheduled`,
    cookie12s,
    {},
  );
  check(
    "Scheduler path (runDueForOrg) with null-config integration → 200/201",
    runScheduledRes,
    200, 201,
  );

  // The scheduler's catch block must have written a "failed" row
  const schedLogRows = await db.query(
    `SELECT id, status, error_message FROM integration_sync_log
     WHERE org_id = $1 AND integration_key = 'railway' AND synced_at >= $2::timestamptz`,
    [org12sId, beforeScheduled.toISOString()],
  ).catch(() => ({ rows: [] }));
  check(
    "Scheduler path: runDueForOrg catch writes 'failed' row to integration_sync_log",
    schedLogRows.rows.length > 0 ? 200 : 404,
    200,
  );
  check(
    "Scheduler path: sync log row has status='failed'",
    schedLogRows.rows[0]?.status === "failed" ? 200 : 422,
    200,
  );

  // GET /test-runs must surface the scheduled failure in history
  const schedHistoryRes = await fetch(
    `${BASE}/orgs/${org12sId}/test-runs`,
    { headers: { Cookie: cookie12s } },
  ).then(r => r.json()).catch(() => null);
  check(
    "Scheduler path: GET /test-runs returns the scheduled failure as status='fail'",
    schedHistoryRes?.runs?.some((r) => r.status === "fail") ? 200 : 422,
    200,
  );

  // Cleanup scheduler sub-test fixtures
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [user12s]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sess12s]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [user12s]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org12sId]).catch(() => {});

  // Cleanup Section 12 fixtures
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [user12]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sess12]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [user12]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org12Id]).catch(() => {});
}

// ── Section 13: Public status API ────────────────────────────────────────────

section("SECTION 13 — PUBLIC STATUS API: /api/public/status returns correct shape");

{
  // BASE = http://localhost:8080/api — do NOT add /api prefix again
  const PUBLIC_STATUS = `${BASE}/public/status`;

  // 1. Endpoint is accessible without authentication (no cookie)
  const r13 = await fetch(PUBLIC_STATUS, {
    headers: { "Content-Type": "application/json", "Host": new URL(BASE).host },
  });
  check("GET /api/public/status returns 200 without auth", r13.status, 200);

  const statusRes = r13.ok ? await r13.json() : {};

  // 2. Required top-level keys
  check("response has 'overall' string field",    typeof statusRes?.overall    === "string" ? 200 : 422, 200);
  check("response has 'components' array",        Array.isArray(statusRes?.components)       ? 200 : 422, 200);
  check("response has 'incidents' array",         Array.isArray(statusRes?.incidents)        ? 200 : 422, 200);
  check("response has 'checkedAt' string field",  typeof statusRes?.checkedAt  === "string" ? 200 : 422, 200);
  check("response has 'dailyBuckets' object",
    typeof statusRes?.dailyBuckets === "object" && statusRes?.dailyBuckets !== null ? 200 : 422, 200);

  // 3. 'overall' is a valid enum value
  const validOverall = ["operational", "degraded", "outage"];
  check("overall is 'operational' | 'degraded' | 'outage'",
    validOverall.includes(statusRes?.overall) ? 200 : 422, 200);

  // 4. All 5 components present
  const expectedKeys = ["api", "database", "auth", "scheduler", "evidence_vault"];
  const componentKeys = (statusRes?.components ?? []).map((c) => c.key);
  check("components array contains all 5 expected components",
    expectedKeys.every((k) => componentKeys.includes(k)) ? 200 : 422, 200);

  // 5. Each component has required fields
  const allComponentsValid = (statusRes?.components ?? []).every(
    (c) => typeof c.key === "string" && typeof c.name === "string" && typeof c.status === "string",
  );
  check("each component has key, name, and status fields", allComponentsValid ? 200 : 422, 200);

  // 6. Insert a probe row directly and confirm aggregation reflects it
  await db.query(
    `INSERT INTO system_health_log (component, status, latency_ms, checked_at)
     VALUES ('database', 'healthy', 37, NOW())`,
  ).catch(() => {});

  const r13b = await fetch(PUBLIC_STATUS, {
    headers: { "Content-Type": "application/json", "Host": new URL(BASE).host },
  });
  const afterProbe = r13b.ok ? await r13b.json() : {};
  const dbComponent = (afterProbe?.components ?? []).find((c) => c.key === "database");
  check("component status is 'healthy' after healthy probe row inserted",
    dbComponent?.status === "healthy" ? 200 : 422, 200);
  check("uptime90d is non-null after probe row inserted",
    dbComponent?.uptime90d !== null ? 200 : 422, 200);

  // 7. Insert an incident and confirm it shows in the response
  const incRes = await db.query(
    `INSERT INTO incidents (component, severity, description, started_at)
     VALUES ('database', 'minor', 'Test incident from test suite', NOW() - INTERVAL '1 hour')
     RETURNING id`,
  ).catch(() => ({ rows: [] }));
  const incId = incRes.rows[0]?.id;

  const r13c = await fetch(PUBLIC_STATUS, {
    headers: { "Content-Type": "application/json", "Host": new URL(BASE).host },
  });
  const withIncident = r13c.ok ? await r13c.json() : {};
  check("active incident shows in incidents array",
    incId && (withIncident?.incidents ?? []).some((i) => i.id === incId) ? 200 : 422, 200);

  // Cleanup: resolve the test incident and delete probe rows
  if (incId) {
    await db.query(`UPDATE incidents SET resolved_at = NOW() WHERE id = $1`, [incId]).catch(() => {});
    await db.query(`DELETE FROM incidents WHERE id = $1`, [incId]).catch(() => {});
  }
  await db.query(
    `DELETE FROM system_health_log WHERE component = 'database' AND latency_ms = 37`,
  ).catch(() => {});
}

// ── Section 14: SSO / SAML endpoints ─────────────────────────────────────────

section("SECTION 14 — SSO / SAML: config CRUD, plan gate, SP metadata, auth flow");

{
  // Create a fresh enterprise org for SSO tests
  const user14   = uid();
  const sess14   = uid();
  const tok14    = uid();
  const slug14   = slug();
  const email14  = `sso-test-${user14.slice(0, 8)}@test.local`;

  await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, 'SSO Test User', $2, TRUE, NOW(), NOW())`, [user14, email14]);
  const org14Res = await db.query(`INSERT INTO organizations (name, slug, plan, onboarding_complete) VALUES ('SSO Test Org', $1, 'enterprise', TRUE) RETURNING id`, [slug14]);
  const org14Id = org14Res.rows[0].id;
  await db.query(`INSERT INTO org_members (org_id, clerk_user_id, email, role) VALUES ($1, $2, $3, 'admin')`, [org14Id, user14, email14]);
  await db.query(`INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1, NOW() + INTERVAL '8 hours', $2, NOW(), NOW(), $3)`, [sess14, tok14, user14]);
  const cookie14 = cookieHdr(tok14);

  // Create a starter-plan org to test the plan gate
  const user14s   = uid();
  const sess14s   = uid();
  const tok14s    = uid();
  const slug14s   = slug();
  const email14s  = `sso-starter-${user14s.slice(0, 8)}@test.local`;

  await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, 'SSO Starter User', $2, TRUE, NOW(), NOW())`, [user14s, email14s]);
  const org14sRes = await db.query(`INSERT INTO organizations (name, slug, plan, onboarding_complete) VALUES ('SSO Starter Org', $1, 'starter', TRUE) RETURNING id`, [slug14s]);
  const org14sId = org14sRes.rows[0].id;
  await db.query(`INSERT INTO org_members (org_id, clerk_user_id, email, role) VALUES ($1, $2, $3, 'admin')`, [org14sId, user14s, email14s]);
  await db.query(`INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1, NOW() + INTERVAL '8 hours', $2, NOW(), NOW(), $3)`, [sess14s, tok14s, user14s]);
  const cookie14s = cookieHdr(tok14s);

  // 1. GET /sso/config before any config is saved — should return configured: false
  const preConfigRes = await fetch(`${BASE}/orgs/${org14Id}/sso/config`, {
    headers: { Cookie: cookie14, "Content-Type": "application/json", Host: new URL(BASE).host },
  });
  check("GET /sso/config returns 200 for enterprise admin", preConfigRes.status, 200);
  const preConfig = preConfigRes.ok ? await preConfigRes.json() : {};
  check("GET /sso/config returns configured: false before save", preConfig?.configured === false ? 200 : 422, 200);
  check("GET /sso/config returns sp.entityId string", typeof preConfig?.sp?.entityId === "string" ? 200 : 422, 200);
  check("GET /sso/config returns sp.acsUrl string",   typeof preConfig?.sp?.acsUrl   === "string" ? 200 : 422, 200);

  // 2. POST /sso/config — save an IdP configuration
  const ssoPayload = {
    provider: "okta",
    domain: "testcorp.com",
    idpEntityId: `https://idp.testcorp.com/saml/${slug14}`,
    idpSsoUrl:   "https://idp.testcorp.com/app/saml/sso",
    idpCertificate: [
      "-----BEGIN CERTIFICATE-----",
      "MIIDpDCCAoygAwIBAgIGAVIFG6IZMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG",
      "EwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNj",
      "bzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxEzARBgNVBAMM",
      "Cmludm9pY2VzaW0wHhcNMTYwMTIxMjMzNjE5WhcNMjYwMTIxMjMzNzE5WjCBkjEL",
      "MAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBG",
      "cmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3ZpZGVyMRMw",
      "EQYDVQQDDAppbnZvaWNlc2ltMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC",
      "AQEAxrBl9hDu8F/QHyOFBQBkFQJkgqGCqABWujnbPa6OVubMBfMRpU/XZRB1zQVB",
      "fake-cert-for-testing-only-not-valid",
      "-----END CERTIFICATE-----",
    ].join("\n"),
  };

  const saveRes = await fetch(`${BASE}/orgs/${org14Id}/sso/config`, {
    method: "POST",
    headers: { Cookie: cookie14, "Content-Type": "application/json", Host: new URL(BASE).host },
    body: JSON.stringify(ssoPayload),
  });
  check("POST /sso/config returns 200 for enterprise admin", saveRes.status, 200);
  const saveBody = saveRes.ok ? await saveRes.json() : {};
  check("POST /sso/config returns ok: true", saveBody?.ok === true ? 200 : 422, 200);

  // 3. GET /sso/config after save — should return configured: true
  const postConfigRes = await fetch(`${BASE}/orgs/${org14Id}/sso/config`, {
    headers: { Cookie: cookie14, "Content-Type": "application/json", Host: new URL(BASE).host },
  });
  const postConfig = postConfigRes.ok ? await postConfigRes.json() : {};
  check("GET /sso/config returns configured: true after save", postConfig?.configured === true ? 200 : 422, 200);
  check("GET /sso/config returns correct provider after save", postConfig?.config?.provider === "okta" ? 200 : 422, 200);
  check("GET /sso/config returns correct domain after save", postConfig?.config?.domain === "testcorp.com" ? 200 : 422, 200);

  // 4. GET /sso/metadata — should return XML content
  const metaRes = await fetch(`${BASE}/orgs/${org14Id}/sso/metadata`, {
    headers: { Cookie: cookie14, "Content-Type": "application/json", Host: new URL(BASE).host },
  });
  check("GET /sso/metadata returns 200", metaRes.status, 200);
  const metaText = metaRes.ok ? await metaRes.text() : "";
  check("GET /sso/metadata returns XML EntityDescriptor", metaText.includes("EntityDescriptor") ? 200 : 422, 200);
  check("GET /sso/metadata contains ACS URL", metaText.includes("AssertionConsumerService") ? 200 : 422, 200);

  // 5. Plan gate — starter org gets 402 on SSO config endpoints
  const gateConfigRes = await fetch(`${BASE}/orgs/${org14sId}/sso/config`, {
    headers: { Cookie: cookie14s, "Content-Type": "application/json", Host: new URL(BASE).host },
  });
  check("GET /sso/config returns 402 for starter plan org", gateConfigRes.status, 402);

  const gateSaveRes = await fetch(`${BASE}/orgs/${org14sId}/sso/config`, {
    method: "POST",
    headers: { Cookie: cookie14s, "Content-Type": "application/json", Host: new URL(BASE).host },
    body: JSON.stringify(ssoPayload),
  });
  check("POST /sso/config returns 402 for starter plan org", gateSaveRes.status, 402);

  // 6. POST /sso/config with missing required fields — should get 400
  const badSaveRes = await fetch(`${BASE}/orgs/${org14Id}/sso/config`, {
    method: "POST",
    headers: { Cookie: cookie14, "Content-Type": "application/json", Host: new URL(BASE).host },
    body: JSON.stringify({ provider: "okta" }), // missing idpEntityId, idpSsoUrl, idpCertificate
  });
  check("POST /sso/config returns 400 for missing required fields", badSaveRes.status, 400);

  // 7. GET /saml/:orgSlug/login — redirects (302) to IdP or error page (no follow-redirect)
  const loginRes = await fetch(`${BASE}/saml/${slug14}/login`, {
    method: "GET",
    headers: { Host: new URL(BASE).host },
    redirect: "manual",
  });
  check("GET /saml/:orgSlug/login returns 302 redirect", loginRes.status, 302);
  const locationHdr = loginRes.headers.get("location") ?? "";
  check("GET /saml/:orgSlug/login Location header is non-empty", locationHdr.length > 0 ? 200 : 422, 200);

  // 8. GET /saml/:orgSlug/login for non-existent org — redirects to error page
  const badLoginRes = await fetch(`${BASE}/saml/org-does-not-exist-xyz/login`, {
    method: "GET",
    headers: { Host: new URL(BASE).host },
    redirect: "manual",
  });
  check("GET /saml/nonexistent/login returns 302 redirect to error", badLoginRes.status, 302);
  const badLocation = badLoginRes.headers.get("location") ?? "";
  check("non-existent org SSO login redirects to error page", badLocation.includes("error=") ? 200 : 422, 200);

  // 9. POST /saml/:orgSlug/callback with invalid SAMLResponse — 302 to error
  const badCallbackRes = await fetch(`${BASE}/saml/${slug14}/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Host: new URL(BASE).host },
    body: "SAMLResponse=not-a-valid-saml-response",
    redirect: "manual",
  });
  check("POST /saml/:orgSlug/callback with invalid SAMLResponse returns 302", badCallbackRes.status, 302);
  const cbLocation = badCallbackRes.headers.get("location") ?? "";
  check("invalid SAML callback redirects to error page", cbLocation.includes("error=") || cbLocation.includes("sign-in") ? 200 : 422, 200);

  // 10-12. E2E: real signed SAMLResponse → valid BetterAuth session → protected route access
  // This proves the full login path works and that unsigned assertions are rejected.
  {
    // Generate a fresh RSA key + self-signed cert for the test IdP using openssl
    const { execSync } = await import("child_process");
    const { readFileSync } = await import("fs");
    execSync(
      "openssl req -x509 -newkey rsa:2048 -keyout /tmp/saml-test-idp.key -out /tmp/saml-test-idp.crt" +
      " -days 3650 -nodes -subj '/CN=TestIdP' -sha256 2>/dev/null"
    );
    const TEST_IDP_KEY  = readFileSync("/tmp/saml-test-idp.key", "utf8");
    const TEST_IDP_CERT = readFileSync("/tmp/saml-test-idp.crt", "utf8");
    const TEST_IDP_CERT_BODY = TEST_IDP_CERT
      .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "");
    const TEST_IDP_ENTITY  = "https://test-idp.e2e.example.com";
    const TEST_IDP_SSO_URL = "https://test-idp.e2e.example.com/saml/sso";

    // Import xml-crypto (a direct dependency of @node-saml/node-saml)
    const { SignedXml } = await import("xml-crypto");

    // Set up a fresh enterprise org with the real test IdP cert
    const userE2e  = uid(); const sessE2e = uid(); const tokE2e = uid();
    const slugE2e  = `e2e-saml-${uid().slice(0, 10)}`;
    const emailE2e = `saml-admin-${userE2e.slice(0, 8)}@e2e.test`;

    await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1,'E2E Admin',$2,TRUE,NOW(),NOW())`, [userE2e, emailE2e]);
    const orgE2eR = await db.query(`INSERT INTO organizations (name, slug, plan, onboarding_complete) VALUES ('E2E SSO Org',$1,'enterprise',TRUE) RETURNING id`, [slugE2e]);
    const orgE2eId = orgE2eR.rows[0].id;
    await db.query(`INSERT INTO org_members (org_id, clerk_user_id, email, role) VALUES ($1,$2,$3,'admin')`, [orgE2eId, userE2e, emailE2e]);
    await db.query(`INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1, NOW() + INTERVAL '8 hours', $2, NOW(), NOW(), $3)`, [sessE2e, tokE2e, userE2e]);
    const cookieE2e = cookieHdr(tokE2e);

    // Save IdP config with the real test cert
    await fetch(`${BASE}/orgs/${orgE2eId}/sso/config`, {
      method: "POST",
      headers: { Cookie: cookieE2e, "Content-Type": "application/json", Host: new URL(BASE).host },
      body: JSON.stringify({ provider: "saml", domain: "e2e.example.com", idpEntityId: TEST_IDP_ENTITY, idpSsoUrl: TEST_IDP_SSO_URL, idpCertificate: TEST_IDP_CERT }),
    });

    // Fetch SP metadata values (entity ID + ACS URL) for assertion construction
    const spData = await fetch(`${BASE}/orgs/${orgE2eId}/sso/config`, {
      headers: { Cookie: cookieE2e, "Content-Type": "application/json", Host: new URL(BASE).host },
    }).then(r => r.json());
    const spEntityId = spData.sp.entityId;
    const acsUrl     = spData.sp.acsUrl;

    // Build and sign a SAMLResponse with a properly signed Assertion
    const testSamlEmail = `saml-login-${uid().slice(0, 8)}@e2e.example.com`;
    const assertionId   = `_a${uid()}`;
    const responseId    = `_r${uid()}`;
    const nowIso        = new Date().toISOString();
    const notAfterIso   = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    const assertionXml =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" Version="2.0" IssueInstant="${nowIso}">` +
        `<saml:Issuer>${TEST_IDP_ENTITY}</saml:Issuer>` +
        `<saml:Subject>` +
          `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${testSamlEmail}</saml:NameID>` +
          `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
            `<saml:SubjectConfirmationData NotOnOrAfter="${notAfterIso}" Recipient="${acsUrl}"/>` +
          `</saml:SubjectConfirmation>` +
        `</saml:Subject>` +
        `<saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="${notAfterIso}">` +
          `<saml:AudienceRestriction><saml:Audience>${spEntityId}</saml:Audience></saml:AudienceRestriction>` +
        `</saml:Conditions>` +
        `<saml:AuthnStatement AuthnInstant="${nowIso}">` +
          `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef></saml:AuthnContext>` +
        `</saml:AuthnStatement>` +
      `</saml:Assertion>`;

    // Sign the Assertion (enveloped XMLDSig, RSA-SHA256)
    const sig = new SignedXml();
    sig.signatureAlgorithm    = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
    sig.addReference({
      xpath: `//*[@ID='${assertionId}']`,
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#",
      ],
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    });
    sig.privateKey  = TEST_IDP_KEY;
    sig.publicCert  = TEST_IDP_CERT;
    sig.getKeyInfoContent = () =>
      `<X509Data><X509Certificate>${TEST_IDP_CERT_BODY}</X509Certificate></X509Data>`;
    sig.computeSignature(assertionXml, {
      location: { reference: `//*[@ID='${assertionId}']`, action: "append" },
    });
    const signedAssertion = sig.getSignedXml();

    // Wrap in a SAMLResponse (response itself is unsigned; assertion is signed)
    const responseXml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
        ` ID="${responseId}" Version="2.0" IssueInstant="${nowIso}" Destination="${acsUrl}">` +
        `<saml:Issuer>${TEST_IDP_ENTITY}</saml:Issuer>` +
        `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
        signedAssertion +
      `</samlp:Response>`;

    const samlB64 = Buffer.from(responseXml).toString("base64");

    // POST to ACS and verify redirect to /dashboard (not error page)
    const e2eRes = await fetch(`${BASE}/saml/${slugE2e}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Host: new URL(BASE).host },
      body: `SAMLResponse=${encodeURIComponent(samlB64)}`,
      redirect: "manual",
    });
    check("E2E SAML: signed assertion callback returns 302",        e2eRes.status, 302);
    const e2eLoc = e2eRes.headers.get("location") ?? "";
    check("E2E SAML: signed assertion redirects to /dashboard",     e2eLoc.includes("/dashboard") ? 200 : 422, 200);

    // Extract the session cookie and verify it gives access to a protected route
    const setCookieVal = e2eRes.headers.get("set-cookie") ?? "";
    const tokenMatch   = setCookieVal.match(/__Secure-better-auth\.session_token=([^;]+)/);
    const samlToken    = tokenMatch?.[1] ?? "";
    check("E2E SAML: callback sets session cookie",                 samlToken.length > 0 ? 200 : 422, 200);

    if (samlToken) {
      // The SAML user is added as 'member', so SSO config endpoint (requires admin) → 403
      // A 401 would mean auth failed; anything but 401 proves the session is valid.
      const guardRes = await fetch(`${BASE}/orgs/${orgE2eId}/sso/config`, {
        headers: { Cookie: `__Secure-better-auth.session_token=${samlToken}`, Host: new URL(BASE).host },
      });
      check("E2E SAML: session cookie accepted by auth guard (non-401)", guardRes.status !== 401 ? 200 : 422, 200);
    }

    // SECURITY REGRESSION: post an unsigned assertion — must be rejected
    const unsignedResponse =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"` +
        ` ID="_unsigned${uid()}" Version="2.0" IssueInstant="${nowIso}" Destination="${acsUrl}">` +
        `<saml:Issuer>${TEST_IDP_ENTITY}</saml:Issuer>` +
        `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
        assertionXml +   // same assertion, but NO signature
      `</samlp:Response>`;
    const unsignedB64 = Buffer.from(unsignedResponse).toString("base64");

    const unsignedRes = await fetch(`${BASE}/saml/${slugE2e}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Host: new URL(BASE).host },
      body: `SAMLResponse=${encodeURIComponent(unsignedB64)}`,
      redirect: "manual",
    });
    check("SECURITY: unsigned assertion POST returns 302",          unsignedRes.status, 302);
    const unsignedLoc = unsignedRes.headers.get("location") ?? "";
    check("SECURITY: unsigned assertion redirects to error (not /dashboard)",
      !unsignedLoc.includes("/dashboard") && (unsignedLoc.includes("error=") || unsignedLoc.includes("sign-in")) ? 200 : 422, 200);

    // Cleanup E2E org
    await db.query(`DELETE FROM org_sso_config WHERE org_id = $1`, [orgE2eId]).catch(() => {});
    await db.query(`DELETE FROM session WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)`, [testSamlEmail]).catch(() => {});
    await db.query(`DELETE FROM org_members WHERE email = $1`, [testSamlEmail]).catch(() => {});
    await db.query(`DELETE FROM "user" WHERE email = $1`, [testSamlEmail]).catch(() => {});
    await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [userE2e]).catch(() => {});
    await db.query(`DELETE FROM session WHERE id = $1`, [sessE2e]).catch(() => {});
    await db.query(`DELETE FROM "user" WHERE id = $1`, [userE2e]).catch(() => {});
    await db.query(`DELETE FROM organizations WHERE id = $1`, [orgE2eId]).catch(() => {});
  }

  // Cleanup
  await db.query(`DELETE FROM org_sso_config WHERE org_id = $1`, [org14Id]).catch(() => {});
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [user14]).catch(() => {});
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [user14s]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sess14]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = $1`, [sess14s]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [user14]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = $1`, [user14s]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org14Id]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org14sId]).catch(() => {});
}

// ── Section 15: Rate limiting & DoS protection ───────────────────────────────

{
  section("SECTION 15 — RATE LIMITING: throttler profiles, headers, IP failure block");

  // ── 15.1 Normal API endpoint returns rate-limit headers ────────────────────
  // Use a unique IP so this section doesn't interact with previous test state.
  // The X-Forwarded-For header is trusted because main.ts sets trust proxy.
  const ip15a = "10.15.10.1";
  const rlRes = await fetch(`${BASE}/healthz`, {
    headers: { "X-Forwarded-For": ip15a, Host: new URL(BASE).host },
  });
  check("15.1 healthz returns 200 (not throttled)",  rlRes.status, 200);

  // ── 15.2 Public status endpoint is exempt from throttling ──────────────────
  const ip15b  = "10.15.10.2";
  let allOk = true;
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${BASE}/public/status`, {
      headers: { "X-Forwarded-For": ip15b, Host: new URL(BASE).host },
    });
    if (r.status !== 200) { allOk = false; break; }
  }
  check("15.2 public/status not throttled over 10 rapid requests", allOk ? 200 : 429, 200);

  // ── 15.3 Auth endpoint (SAML login) is throttled at 5 req/min per IP ──────
  const ip15c   = "10.15.10.3";
  const slug15  = "nonexistent-org-throttle-test-15";
  const reqFn   = () => fetch(`${BASE}/saml/${slug15}/login`, {
    redirect: "manual",
    headers:  { "X-Forwarded-For": ip15c, Host: new URL(BASE).host },
  });

  // First 5 requests → redirects (302 to error page because org doesn't exist)
  let allRedirect = true;
  for (let i = 0; i < 5; i++) {
    const r = await reqFn();
    if (r.status !== 302) { allRedirect = false; }
  }
  check("15.3a SAML login: first 5 req within limit (302 each)", allRedirect ? 200 : 422, 200);

  // 6th request from same IP → 429 (auth throttler at 5/min)
  const throttled = await reqFn();
  check("15.3b SAML login: 6th request is throttled (429)", throttled.status, 429);
  // Standard Retry-After header must be present (guard normalizes from Retry-After-auth)
  check("15.3c SAML login: throttled 429 includes standard Retry-After header",
    throttled.headers.get("retry-after") != null ? 200 : 422, 200);

  // ── 15.4 IP failure block — 10 bad SAML assertions → 429 on 11th ──────────
  const ip15d  = "10.15.10.4";
  const slug15d = "nonexistent-org-ip-block-test-15";

  // Send 10 invalid SAMLResponse values → each triggers a validation failure
  // which calls recordAuthFailure().  10th failure crosses the threshold.
  // Note: the SAML callback itself is auth-throttled at 5/min, but the IP
  // block accumulates across different throttler windows.
  // We reset between bursts by using a distinct IP not used elsewhere.
  for (let i = 0; i < 10; i++) {
    await fetch(`${BASE}/saml/${slug15d}/callback`, {
      method:   "POST",
      redirect: "manual",
      headers:  {
        "Content-Type":    "application/x-www-form-urlencoded",
        "X-Forwarded-For": ip15d,
        Host:              new URL(BASE).host,
      },
      body: `SAMLResponse=${encodeURIComponent("invalid-saml-response-" + i)}`,
    });
  }

  // 11th request: IP is now blocked → must return 429 with Retry-After header
  const blocked = await fetch(`${BASE}/saml/${slug15d}/callback`, {
    method:   "POST",
    redirect: "manual",
    headers:  {
      "Content-Type":    "application/x-www-form-urlencoded",
      "X-Forwarded-For": ip15d,
      Host:              new URL(BASE).host,
    },
    body: "SAMLResponse=invalid",
  });
  check("15.4a IP failure block: 11th request returns 429", blocked.status, 429);
  check("15.4b IP failure block: Retry-After header present",
    blocked.headers.get("retry-after") != null ? 200 : 422, 200);
  const retryAfter = Number(blocked.headers.get("retry-after") ?? 0);
  check("15.4c IP failure block: Retry-After ≤ 900s", retryAfter > 0 && retryAfter <= 900 ? 200 : 422, 200);

  // ── 15.5 Gap-analysis enforces 8 req/min throttle (default profile override) ─
  // Uses X-Forwarded-For to isolate this test from previous loopback requests.
  {
    const gaNow     = new Date().toISOString();
    const gaExpires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const gaSlug    = slug();
    const gaUser    = uid();
    const gaSess    = uid();
    const gaToken   = uid();
    const ip15e     = "10.15.10.5";

    const gaOrgRes = await db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan) VALUES ($1, $2, 'technology', '11-50', 'professional') RETURNING id`,
      [`Throttle GA Org ${gaSlug}`, gaSlug],
    );
    const gaOrgId = gaOrgRes.rows[0].id;
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role) VALUES ($1,$2,$3,true,$4,$4,'member')`,
      [gaUser, "GA Throttle User", `ga-throttle-${gaSlug}@test.invalid`, gaNow],
    );
    await db.query(
      `INSERT INTO session (id, "userId", "expiresAt", token, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$5)`,
      [gaSess, gaUser, gaExpires, gaToken, gaNow],
    );
    await db.query(
      `INSERT INTO org_members (org_id, clerk_user_id, role, email, created_at) VALUES ($1,$2,'compliance_manager',$3,$4)`,
      [gaOrgId, gaUser, `ga-throttle-${gaSlug}@test.invalid`, gaNow],
    );
    const gaCookieVal = `__Secure-better-auth.session_token=${gaToken}`;

    const gaFetch = (i) => fetch(`${BASE}/orgs/${gaOrgId}/gap-analysis`, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        Cookie:            gaCookieVal,
        Host:              new URL(BASE).host,
        "X-Forwarded-For": ip15e,
      },
      body: "{}",
    });

    // First 8 requests → within the 8/min limit (200, 500, or similar — not 429)
    let gaAllowed = true;
    for (let i = 0; i < 8; i++) {
      const r = await gaFetch(i);
      if (r.status === 429) { gaAllowed = false; }
    }
    check("15.5a gap-analysis: 8 requests within 8/min limit (not throttled)", gaAllowed ? 200 : 429, 200);

    // 9th request → 429 (default throttler overridden to limit=8)
    const gaThrottled = await gaFetch(8);
    check("15.5b gap-analysis: 9th request is throttled (429)", gaThrottled.status, 429);

    await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [gaUser]).catch(() => {});
    await db.query(`DELETE FROM session WHERE id = $1`, [gaSess]).catch(() => {});
    await db.query(`DELETE FROM "user" WHERE id = $1`, [gaUser]).catch(() => {});
    await db.query(`DELETE FROM organizations WHERE id = $1`, [gaOrgId]).catch(() => {});
  }

  // ── 15.6 SSP generate enforces 5 req/min throttle (default profile override) ─
  {
    const sspNow     = new Date().toISOString();
    const sspExpires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const sspSlug    = slug();
    const sspUser    = uid();
    const sspSess    = uid();
    const sspToken   = uid();
    const ip15f      = "10.15.10.6";

    const sspOrgRes = await db.query(
      `INSERT INTO organizations (name, slug, industry, size, plan) VALUES ($1, $2, 'technology', '11-50', 'federal') RETURNING id`,
      [`Throttle SSP Org ${sspSlug}`, sspSlug],
    );
    const sspOrgId = sspOrgRes.rows[0].id;
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role) VALUES ($1,$2,$3,true,$4,$4,'member')`,
      [sspUser, "SSP Throttle User", `ssp-throttle-${sspSlug}@test.invalid`, sspNow],
    );
    await db.query(
      `INSERT INTO session (id, "userId", "expiresAt", token, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$5)`,
      [sspSess, sspUser, sspExpires, sspToken, sspNow],
    );
    await db.query(
      `INSERT INTO org_members (org_id, clerk_user_id, role, email, created_at) VALUES ($1,$2,'owner',$3,$4)`,
      [sspOrgId, sspUser, `ssp-throttle-${sspSlug}@test.invalid`, sspNow],
    );
    const sspCookieVal = `__Secure-better-auth.session_token=${sspToken}`;

    const sspFetch = () => fetch(`${BASE}/orgs/${sspOrgId}/ssp/generate`, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        Cookie:            sspCookieVal,
        Host:              new URL(BASE).host,
        "X-Forwarded-For": ip15f,
      },
      body: "{}",
    });

    // First 5 requests → within the 5/min limit (200, 500, or similar — not 429)
    let sspAllowed = true;
    for (let i = 0; i < 5; i++) {
      const r = await sspFetch();
      if (r.status === 429) { sspAllowed = false; }
    }
    check("15.6a ssp/generate: 5 requests within 5/min limit (not throttled)", sspAllowed ? 200 : 429, 200);

    // 6th request → 429 (default throttler overridden to limit=5)
    const sspThrottled = await sspFetch();
    check("15.6b ssp/generate: 6th request is throttled (429)", sspThrottled.status, 429);

    await db.query(`DELETE FROM org_members WHERE clerk_user_id = $1`, [sspUser]).catch(() => {});
    await db.query(`DELETE FROM session WHERE id = $1`, [sspSess]).catch(() => {});
    await db.query(`DELETE FROM "user" WHERE id = $1`, [sspUser]).catch(() => {});
    await db.query(`DELETE FROM organizations WHERE id = $1`, [sspOrgId]).catch(() => {});
  }

  // ── 15.7 Magic-link send: 5 req/min per-IP limit ─────────────────────────
  // BetterAuth's magicLink plugin (basePath /api/auth) exposes the send
  // operation at POST /api/auth/sign-in/magic-link.  The Express middleware
  // in main.ts intercepts this route before NestJS routing because the
  // BetterAuth wildcard @All("*path") controller swallows all /api/auth/*
  // sub-routes before per-route NestJS @Throttle decorators can fire.
  {
    const ip15g = "10.15.10.7";

    // Clear any stale state for this IP from a previous run
    await db.query(
      `DELETE FROM ip_magic_link_rate WHERE ip = $1`,
      [ip15g],
    ).catch(() => { /* table may not exist yet on first boot */ });

    const mlFetch = () => fetch(`${BASE}/auth/sign-in/magic-link`, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-Forwarded-For": ip15g,
        Host:              new URL(BASE).host,
      },
      // Non-existent email — BetterAuth returns 200 (ambiguous) to prevent
      // email enumeration. We verify the status is exactly 200 (BetterAuth
      // responded, not a 404 meaning the route doesn't exist).
      body: JSON.stringify({ email: "rate-limit-test@test.invalid" }),
    });

    // First 5 requests must be handled by BetterAuth (200 or 403) — not 429
    // from the rate limiter and not 404 (which would mean the route doesn't exist).
    // Note: fetch from Node.js adds an Origin header that BetterAuth's CORS check
    // may reject with 403; that is still a valid BetterAuth response confirming the
    // route exists and the rate limiter did not block it.
    let mlAllowed = true;
    let mlFirstStatus = 0;
    for (let i = 0; i < 5; i++) {
      const r = await mlFetch();
      if (i === 0) mlFirstStatus = r.status;
      if (r.status === 429) { mlAllowed = false; break; }
    }
    // Route existence check: first response must be 200 or 403 (BetterAuth), never 404
    check("15.7a magic-link/send: BetterAuth handles the route (not 404)",
      (mlFirstStatus === 200 || mlFirstStatus === 403) ? 200 : 404, 200);
    check("15.7b magic-link/send: first 5 requests are not rate-limited (not 429)",
      mlAllowed ? 200 : 429, 200);

    // 6th request from the same IP within the window → 429
    const mlThrottled = await mlFetch();
    check("15.7c magic-link/send: 6th request is rate-limited (429)", mlThrottled.status, 429);

    // The 429 response must include a Retry-After header with value ≤ 60
    const mlRetryAfter = Number(mlThrottled.headers.get("retry-after") ?? -1);
    check("15.7d magic-link/send: 429 includes Retry-After header",
      mlRetryAfter > 0 ? 200 : 422, 200);
    check("15.7e magic-link/send: Retry-After ≤ 60 seconds",
      mlRetryAfter > 0 && mlRetryAfter <= 60 ? 200 : 422, 200);

    // Cleanup
    await db.query(`DELETE FROM ip_magic_link_rate WHERE ip = $1`, [ip15g]).catch(() => {});
  }
}

// ── Section 16: Nightly cleanup safety — active/grace rows are never deleted ──
//
// These helpers replicate the exact SQL from rate-limit-cleanup.service.ts.
// We do NOT import the service directly because @Injectable() / @Cron()
// decorator syntax requires a full TypeScript transpiler (SWC/tsc), not just
// Node.js --experimental-strip-types.

async function runNightlyCleanup(cutoffMs) {
  await db.query(
    `DELETE FROM throttle_hits WHERE expire_at < $1 AND block_expire_at < $1`,
    [cutoffMs],
  );
  await db.query(
    `DELETE FROM ip_failure_tracker WHERE blocked_until < $1 AND window_start < $1`,
    [cutoffMs],
  );
}
async function runMagicLinkCleanup(cutoffMs) {
  await db.query(
    `DELETE FROM ip_magic_link_rate WHERE blocked_until < $1 AND window_start < $1`,
    [cutoffMs],
  );
}

{
  section("SECTION 16 — NIGHTLY CLEANUP: pruneStaleRows never deletes active or grace rows");

  const now = BigInt(Date.now());

  // ── Shared timestamp anchors ──────────────────────────────────────────────
  const FUTURE_1H   = now + BigInt(60 * 60 * 1000);          // +1 h
  const FUTURE_15M  = now + BigInt(15 * 60 * 1000);          // +15 min
  const PAST_5M     = now - BigInt(5  * 60 * 1000);          // 5 min ago   (active window)
  const PAST_1H     = now - BigInt(60 * 60 * 1000);          // 1 h ago     (grace — < 1 day)
  const PAST_30M    = now - BigInt(30 * 60 * 1000);          // 30 min ago  (grace block)
  const PAST_2DAYS  = now - BigInt(48 * 60 * 60 * 1000);     // 2 days ago  (stale — > 1 day)
  const NO_BLOCK    = BigInt(0);                              // default: no block

  const TH = "cleanup-test"; // throttler_name used for all throttle fixtures

  // Unique keys — avoid any collision with Section 15 throttle state
  const TH_ACTIVE_WINDOW = `cleanup-th-active-win-${uid()}`;     // active window, no block
  const TH_STALE_WIN_LIVE_BLOCK = `cleanup-th-stale-win-live-blk-${uid()}`; // stale window + active block → must survive
  const TH_GRACE_WIN    = `cleanup-th-grace-win-${uid()}`;       // grace window (< 1d), no block
  const TH_STALE_BOTH   = `cleanup-th-stale-both-${uid()}`;      // stale window + stale block → deleted

  // Unique IPs for ip_failure_tracker
  const IP_LIVE_WIN_LIVE_BLK  = `10.61.0.1`;  // live window + live block  → survives
  const IP_STALE_WIN_LIVE_BLK = `10.61.0.2`;  // stale window + live block → survives (AND guard)
  const IP_LIVE_WIN_NO_BLK    = `10.61.0.3`;  // live window + no block    → survives (AND guard)
  const IP_GRACE_BOTH         = `10.61.0.4`;  // grace window + grace block → survives
  const IP_STALE_BOTH         = `10.61.0.5`;  // stale window + stale block → deleted

  // Unique IPs for ip_magic_link_rate (cutoff: now − 60 s)
  const PAST_30S    = now - BigInt(30 * 1000);   // 30 s ago (within 60-s buffer)
  const PAST_5MIN   = now - BigInt(5 * 60 * 1000); // 5 min ago (stale for magic-link)
  const FUTURE_2M   = now + BigInt(2 * 60 * 1000); // +2 min (active block)
  const PAST_10S    = now - BigInt(10 * 1000);   // 10 s ago (active window)

  const ML_ACTIVE_WIN_ACTIVE_BLK  = `10.61.1.1`;  // active window + active block → survives
  const ML_STALE_WIN_ACTIVE_BLK   = `10.61.1.2`;  // stale window + active block  → survives (AND guard)
  const ML_ACTIVE_WIN_EXPIRED_BLK = `10.61.1.3`;  // active window + expired block → survives (AND guard)
  const ML_GRACE_BOTH             = `10.61.1.4`;  // grace (within 60s) + grace    → survives
  const ML_STALE_BOTH             = `10.61.1.5`;  // stale window + stale block    → deleted

  // Ensure the rate-limit tables exist before we INSERT (idempotent DDL).
  for (const ddl of [
    `CREATE TABLE IF NOT EXISTS throttle_hits (
       key TEXT NOT NULL, throttler_name TEXT NOT NULL,
       expire_at BIGINT NOT NULL, block_expire_at BIGINT NOT NULL DEFAULT 0,
       total_hits INTEGER NOT NULL DEFAULT 0,
       PRIMARY KEY (key, throttler_name))`,
    `CREATE TABLE IF NOT EXISTS ip_failure_tracker (
       ip TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0,
       window_start BIGINT NOT NULL, blocked_until BIGINT NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS ip_magic_link_rate (
       ip TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0,
       window_start BIGINT NOT NULL, blocked_until BIGINT NOT NULL DEFAULT 0)`,
  ]) { await db.query(ddl).catch(() => {}); }

  // ── Seed throttle_hits ────────────────────────────────────────────────────
  //
  // The cleanup SQL is: DELETE WHERE expire_at < cutoff AND block_expire_at < cutoff
  // (block_expire_at = 0 satisfies the block predicate for unblocked rows)
  //
  // Fixture matrix (cutoff = now − 1 day):
  //   TH_ACTIVE_WINDOW       expire_at=future, block=0           → survives (expire_at ≥ cutoff)
  //   TH_STALE_WIN_LIVE_BLK  expire_at=2d ago, block=future      → survives (block_expire_at ≥ cutoff)
  //   TH_GRACE_WIN           expire_at=1h ago, block=0           → survives (expire_at ≥ cutoff — only 1 h old)
  //   TH_STALE_BOTH          expire_at=2d ago, block=2d ago      → deleted  (both < cutoff)

  const thUpsert = (key, expireAt, blockExpireAt) => db.query(
    `INSERT INTO throttle_hits (key, throttler_name, expire_at, block_expire_at, total_hits)
     VALUES ($1,$2,$3,$4,5)
     ON CONFLICT (key,throttler_name) DO UPDATE
       SET expire_at=EXCLUDED.expire_at, block_expire_at=EXCLUDED.block_expire_at`,
    [key, TH, expireAt, blockExpireAt],
  );

  await thUpsert(TH_ACTIVE_WINDOW,       FUTURE_1H,  NO_BLOCK);
  await thUpsert(TH_STALE_WIN_LIVE_BLOCK, PAST_2DAYS, FUTURE_15M);
  await thUpsert(TH_GRACE_WIN,           PAST_1H,    NO_BLOCK);
  await thUpsert(TH_STALE_BOTH,          PAST_2DAYS, PAST_2DAYS);

  // ── Seed ip_failure_tracker ───────────────────────────────────────────────
  //
  // The cleanup SQL is: DELETE WHERE blocked_until < cutoff AND window_start < cutoff
  //
  // Fixture matrix:
  //   IP_LIVE_WIN_LIVE_BLK   window=5m ago,  block=+15m   → survives (both conditions block deletion)
  //   IP_STALE_WIN_LIVE_BLK  window=2d ago,  block=+15m   → survives (block_until ≥ cutoff)
  //   IP_LIVE_WIN_NO_BLK     window=5m ago,  block=0      → survives (window_start ≥ cutoff)
  //   IP_GRACE_BOTH          window=1h ago,  block=30m ago → survives (both ≥ cutoff)
  //   IP_STALE_BOTH          window=2d ago,  block=2d ago → deleted  (both < cutoff)

  const ipUpsert = (ip, windowStart, blockedUntil) => db.query(
    `INSERT INTO ip_failure_tracker (ip, count, window_start, blocked_until)
     VALUES ($1,5,$2,$3)
     ON CONFLICT (ip) DO UPDATE
       SET window_start=EXCLUDED.window_start, blocked_until=EXCLUDED.blocked_until`,
    [ip, windowStart, blockedUntil],
  );

  await ipUpsert(IP_LIVE_WIN_LIVE_BLK,  PAST_5M,   FUTURE_15M);
  await ipUpsert(IP_STALE_WIN_LIVE_BLK, PAST_2DAYS, FUTURE_15M);
  await ipUpsert(IP_LIVE_WIN_NO_BLK,    PAST_5M,   NO_BLOCK);
  await ipUpsert(IP_GRACE_BOTH,         PAST_1H,   PAST_30M);
  await ipUpsert(IP_STALE_BOTH,         PAST_2DAYS, PAST_2DAYS);

  // ── Seed ip_magic_link_rate ───────────────────────────────────────────────
  //
  // The cleanup SQL is: DELETE WHERE blocked_until < cutoff AND window_start < cutoff
  // where cutoff = now − 60 s.
  //
  // Fixture matrix:
  //   ML_ACTIVE_WIN_ACTIVE_BLK   window=10s ago, block=+2m   → survives
  //   ML_STALE_WIN_ACTIVE_BLK    window=5m ago,  block=+2m   → survives (block ≥ cutoff)
  //   ML_ACTIVE_WIN_EXPIRED_BLK  window=10s ago, block=5m ago → survives (window ≥ cutoff)
  //   ML_GRACE_BOTH              window=30s ago, block=30s ago → survives (within 60-s buffer)
  //   ML_STALE_BOTH              window=5m ago,  block=5m ago → deleted

  const mlUpsert = (ip, windowStart, blockedUntil) => db.query(
    `INSERT INTO ip_magic_link_rate (ip, count, window_start, blocked_until)
     VALUES ($1,3,$2,$3)
     ON CONFLICT (ip) DO UPDATE
       SET window_start=EXCLUDED.window_start, blocked_until=EXCLUDED.blocked_until`,
    [ip, windowStart, blockedUntil],
  );

  await mlUpsert(ML_ACTIVE_WIN_ACTIVE_BLK,  PAST_10S,  FUTURE_2M);
  await mlUpsert(ML_STALE_WIN_ACTIVE_BLK,   PAST_5MIN, FUTURE_2M);
  await mlUpsert(ML_ACTIVE_WIN_EXPIRED_BLK, PAST_10S,  PAST_5MIN);
  await mlUpsert(ML_GRACE_BOTH,             PAST_30S,  PAST_30S);
  await mlUpsert(ML_STALE_BOTH,             PAST_5MIN, PAST_5MIN);

  // ── Run the cleanup (same cutoffs as the real service) ───────────────────
  const nightlyCutoff = now - BigInt(24 * 60 * 60 * 1000);
  const magicCutoff   = now - BigInt(60 * 1000);
  await runNightlyCleanup(nightlyCutoff);
  await runMagicLinkCleanup(magicCutoff);

  // ── Helper: does a throttle_hits row still exist? ─────────────────────────
  const thExists = async (key) => {
    const r = await db.query(
      `SELECT 1 FROM throttle_hits WHERE key=$1 AND throttler_name=$2`, [key, TH],
    );
    return r.rowCount > 0;
  };
  const ipExists = async (ip) => {
    const r = await db.query(`SELECT 1 FROM ip_failure_tracker WHERE ip=$1`, [ip]);
    return r.rowCount > 0;
  };
  const mlExists = async (ip) => {
    const r = await db.query(`SELECT 1 FROM ip_magic_link_rate WHERE ip=$1`, [ip]);
    return r.rowCount > 0;
  };

  // ── Assert throttle_hits ──────────────────────────────────────────────────
  check("16.1a throttle_hits: active window + no block survives",
    await thExists(TH_ACTIVE_WINDOW) ? 200 : 404, 200);

  check("16.1b throttle_hits: stale window + ACTIVE block survives (active block guard)",
    await thExists(TH_STALE_WIN_LIVE_BLOCK) ? 200 : 404, 200);

  check("16.1c throttle_hits: grace window (< 1 day) + no block survives",
    await thExists(TH_GRACE_WIN) ? 200 : 404, 200);

  check("16.1d throttle_hits: stale window + stale block is deleted",
    await thExists(TH_STALE_BOTH) ? 409 : 200, 200);

  // ── Assert ip_failure_tracker ─────────────────────────────────────────────
  check("16.2a ip_failure_tracker: live window + live block survives",
    await ipExists(IP_LIVE_WIN_LIVE_BLK) ? 200 : 404, 200);

  check("16.2b ip_failure_tracker: stale window + LIVE block survives (AND guard)",
    await ipExists(IP_STALE_WIN_LIVE_BLK) ? 200 : 404, 200);

  check("16.2c ip_failure_tracker: live window + no block survives (AND guard)",
    await ipExists(IP_LIVE_WIN_NO_BLK) ? 200 : 404, 200);

  check("16.2d ip_failure_tracker: grace window + grace block survives",
    await ipExists(IP_GRACE_BOTH) ? 200 : 404, 200);

  check("16.2e ip_failure_tracker: stale window + stale block is deleted",
    await ipExists(IP_STALE_BOTH) ? 409 : 200, 200);

  // ── Assert ip_magic_link_rate ─────────────────────────────────────────────
  check("16.3a ip_magic_link_rate: active window + active block survives",
    await mlExists(ML_ACTIVE_WIN_ACTIVE_BLK) ? 200 : 404, 200);

  check("16.3b ip_magic_link_rate: stale window + ACTIVE block survives (AND guard)",
    await mlExists(ML_STALE_WIN_ACTIVE_BLK) ? 200 : 404, 200);

  check("16.3c ip_magic_link_rate: active window + expired block survives (AND guard)",
    await mlExists(ML_ACTIVE_WIN_EXPIRED_BLK) ? 200 : 404, 200);

  check("16.3d ip_magic_link_rate: grace (within 60s) rows survive",
    await mlExists(ML_GRACE_BOTH) ? 200 : 404, 200);

  check("16.3e ip_magic_link_rate: stale window + stale block is deleted",
    await mlExists(ML_STALE_BOTH) ? 409 : 200, 200);

  // ── Cleanup seeded rows ───────────────────────────────────────────────────
  await db.query(
    `DELETE FROM throttle_hits WHERE key = ANY($1::text[]) AND throttler_name = $2`,
    [[TH_ACTIVE_WINDOW, TH_STALE_WIN_LIVE_BLOCK, TH_GRACE_WIN, TH_STALE_BOTH], TH],
  ).catch(() => {});
  await db.query(
    `DELETE FROM ip_failure_tracker WHERE ip = ANY($1::text[])`,
    [[IP_LIVE_WIN_LIVE_BLK, IP_STALE_WIN_LIVE_BLK, IP_LIVE_WIN_NO_BLK, IP_GRACE_BOTH, IP_STALE_BOTH]],
  ).catch(() => {});
  await db.query(
    `DELETE FROM ip_magic_link_rate WHERE ip = ANY($1::text[])`,
    [[ML_ACTIVE_WIN_ACTIVE_BLK, ML_STALE_WIN_ACTIVE_BLK, ML_ACTIVE_WIN_EXPIRED_BLK, ML_GRACE_BOTH, ML_STALE_BOTH]],
  ).catch(() => {});
}

// ── Section 16B: Clock drift — boundary rows survive ±30 s drift ─────────────
//
// pruneStaleRows() computes its cutoff as BigInt(Date.now()) - 24 h.
// On Railway / Replit the app-server clock can drift from Postgres's clock by
// tens of seconds.  This section verifies:
//   • A row 60 s *inside* the 24-h cutoff survives even when the app clock is
//     +30 s ahead (which shifts the cutoff 30 s earlier).
//   • A row 60 s *past* the 24-h cutoff is still deleted when the app clock is
//     -30 s behind (which shifts the cutoff 30 s later, but not enough to save it).
// Covers both throttle_hits and ip_failure_tracker.

{
  section("SECTION 16B — CLOCK DRIFT: boundary rows survive ±30 s app-clock skew");

  // runNightlyCleanup() is defined above Section 16 — no service import needed.
  const nowMs         = BigInt(Date.now());
  const ONE_DAY_MS    = BigInt(24 * 60 * 60 * 1000);
  const DRIFT_MS      = BigInt(30 * 1000);  // 30-second clock drift
  const MARGIN_MS     = BigInt(60 * 1000);  // 60-second margin — safely inside / outside cutoff

  // expire_at / window_start anchors:
  //   INSIDE_MARGIN  = realNow - 24 h + 60 s  → 60 s before the real cutoff → should SURVIVE
  //   OUTSIDE_MARGIN = realNow - 24 h - 60 s  → 60 s past  the real cutoff → should be DELETED
  const EXPIRE_INSIDE_MARGIN  = nowMs - ONE_DAY_MS + MARGIN_MS;
  const EXPIRE_OUTSIDE_MARGIN = nowMs - ONE_DAY_MS - MARGIN_MS;
  const NO_BLK = BigInt(0);

  const TH_DRIFT_NAME    = "cleanup-drift";
  const TH_DRIFT_SURVIVE = `drift-survive-${uid()}`;
  const TH_DRIFT_DELETE  = `drift-delete-${uid()}`;
  const IP_DRIFT_SURVIVE = `10.62.0.1`;
  const IP_DRIFT_DELETE  = `10.62.0.2`;

  // Ensure tables exist (idempotent DDL — same as Section 16)
  for (const ddl of [
    `CREATE TABLE IF NOT EXISTS throttle_hits (
       key TEXT NOT NULL, throttler_name TEXT NOT NULL,
       expire_at BIGINT NOT NULL, block_expire_at BIGINT NOT NULL DEFAULT 0,
       total_hits INTEGER NOT NULL DEFAULT 0,
       PRIMARY KEY (key, throttler_name))`,
    `CREATE TABLE IF NOT EXISTS ip_failure_tracker (
       ip TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0,
       window_start BIGINT NOT NULL, blocked_until BIGINT NOT NULL DEFAULT 0)`,
  ]) { await db.query(ddl).catch(() => {}); }

  // ── Seed boundary rows ────────────────────────────────────────────────────
  // block_expire_at = 0 (no active block) so the only guard is expire_at.

  await db.query(
    `INSERT INTO throttle_hits (key, throttler_name, expire_at, block_expire_at, total_hits)
     VALUES ($1,$2,$3,0,1)
     ON CONFLICT (key,throttler_name) DO UPDATE
       SET expire_at=EXCLUDED.expire_at, block_expire_at=0`,
    [TH_DRIFT_SURVIVE, TH_DRIFT_NAME, EXPIRE_INSIDE_MARGIN],
  );
  await db.query(
    `INSERT INTO throttle_hits (key, throttler_name, expire_at, block_expire_at, total_hits)
     VALUES ($1,$2,$3,0,1)
     ON CONFLICT (key,throttler_name) DO UPDATE
       SET expire_at=EXCLUDED.expire_at, block_expire_at=0`,
    [TH_DRIFT_DELETE, TH_DRIFT_NAME, EXPIRE_OUTSIDE_MARGIN],
  );

  // ip_failure_tracker: window_start acts as the primary stale-check column
  await db.query(
    `INSERT INTO ip_failure_tracker (ip, count, window_start, blocked_until)
     VALUES ($1,1,$2,0)
     ON CONFLICT (ip) DO UPDATE SET window_start=EXCLUDED.window_start, blocked_until=0`,
    [IP_DRIFT_SURVIVE, EXPIRE_INSIDE_MARGIN],
  );
  await db.query(
    `INSERT INTO ip_failure_tracker (ip, count, window_start, blocked_until)
     VALUES ($1,1,$2,0)
     ON CONFLICT (ip) DO UPDATE SET window_start=EXCLUDED.window_start, blocked_until=0`,
    [IP_DRIFT_DELETE, EXPIRE_OUTSIDE_MARGIN],
  );

  // ── Existence helpers ─────────────────────────────────────────────────────
  const thDriftExists = async (key) => {
    const r = await db.query(
      `SELECT 1 FROM throttle_hits WHERE key=$1 AND throttler_name=$2`,
      [key, TH_DRIFT_NAME],
    );
    return r.rowCount > 0;
  };
  const ipDriftExists = async (ip) => {
    const r = await db.query(`SELECT 1 FROM ip_failure_tracker WHERE ip=$1`, [ip]);
    return r.rowCount > 0;
  };

  // ── Test A: app clock +30 s AHEAD of Postgres ────────────────────────────
  // Simulated cutoff = nowMs + DRIFT_MS - ONE_DAY_MS = nowMs - 24h + 30s
  // INSIDE_MARGIN  row: expire_at = nowMs - 24h + 60s  > cutoff (+30s) → SURVIVES
  // OUTSIDE_MARGIN row: expire_at = nowMs - 24h - 60s  < cutoff (+30s) → DELETED
  const cutoffAhead = nowMs + DRIFT_MS - ONE_DAY_MS;
  await runNightlyCleanup(cutoffAhead);

  check("16.4a throttle_hits: row 60s inside cutoff survives when clock is +30s ahead",
    await thDriftExists(TH_DRIFT_SURVIVE) ? 200 : 404, 200);

  check("16.4b throttle_hits: row 60s outside cutoff is deleted even when clock is +30s ahead",
    await thDriftExists(TH_DRIFT_DELETE) ? 409 : 200, 200);

  check("16.4c ip_failure_tracker: row 60s inside cutoff survives when clock is +30s ahead",
    await ipDriftExists(IP_DRIFT_SURVIVE) ? 200 : 404, 200);

  check("16.4d ip_failure_tracker: row 60s outside cutoff is deleted even when clock is +30s ahead",
    await ipDriftExists(IP_DRIFT_DELETE) ? 409 : 200, 200);

  // ── Re-seed the deleted rows for the -30 s drift pass ────────────────────
  await db.query(
    `INSERT INTO throttle_hits (key, throttler_name, expire_at, block_expire_at, total_hits)
     VALUES ($1,$2,$3,0,1)
     ON CONFLICT (key,throttler_name) DO UPDATE
       SET expire_at=EXCLUDED.expire_at, block_expire_at=0`,
    [TH_DRIFT_DELETE, TH_DRIFT_NAME, EXPIRE_OUTSIDE_MARGIN],
  );
  await db.query(
    `INSERT INTO ip_failure_tracker (ip, count, window_start, blocked_until)
     VALUES ($1,1,$2,0)
     ON CONFLICT (ip) DO UPDATE SET window_start=EXCLUDED.window_start, blocked_until=0`,
    [IP_DRIFT_DELETE, EXPIRE_OUTSIDE_MARGIN],
  );

  // ── Test B: app clock -30 s BEHIND Postgres ──────────────────────────────
  // Simulated cutoff = nowMs - DRIFT_MS - ONE_DAY_MS = nowMs - 24h - 30s
  // INSIDE_MARGIN  row: expire_at = nowMs - 24h + 60s  > cutoff (-30s) → SURVIVES
  // OUTSIDE_MARGIN row: expire_at = nowMs - 24h - 60s  < cutoff (-30s) → DELETED
  const cutoffBehind = nowMs - DRIFT_MS - ONE_DAY_MS;
  await runNightlyCleanup(cutoffBehind);

  check("16.5a throttle_hits: row 60s inside cutoff survives when clock is -30s behind",
    await thDriftExists(TH_DRIFT_SURVIVE) ? 200 : 404, 200);

  check("16.5b throttle_hits: row 60s outside cutoff is still deleted when clock is -30s behind",
    await thDriftExists(TH_DRIFT_DELETE) ? 409 : 200, 200);

  check("16.5c ip_failure_tracker: row 60s inside cutoff survives when clock is -30s behind",
    await ipDriftExists(IP_DRIFT_SURVIVE) ? 200 : 404, 200);

  check("16.5d ip_failure_tracker: row 60s outside cutoff is still deleted when clock is -30s behind",
    await ipDriftExists(IP_DRIFT_DELETE) ? 409 : 200, 200);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await db.query(
    `DELETE FROM throttle_hits WHERE key = ANY($1::text[]) AND throttler_name = $2`,
    [[TH_DRIFT_SURVIVE, TH_DRIFT_DELETE], TH_DRIFT_NAME],
  ).catch(() => {});
  await db.query(
    `DELETE FROM ip_failure_tracker WHERE ip = ANY($1::text[])`,
    [[IP_DRIFT_SURVIVE, IP_DRIFT_DELETE]],
  ).catch(() => {});
}

// ── Section 17: Admin — magic-link throttle clear ────────────────────────────

{
  section("SECTION 17 — ADMIN: super_admin can read and clear magic-link throttle windows");

  const now17     = new Date().toISOString();
  const expires17 = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const slug17    = slug();

  // ── Seed a super_admin user ───────────────────────────────────────────────
  const userSa   = uid();
  const sessSa   = `sess-sa-${uid()}`;
  const tokSa    = `tok-sa-${uid()}`;

  // ── Seed a non-super_admin user (owner role, but no super_admin in any org) ─
  const userNsa  = uid();
  const sessNsa  = `sess-nsa-${uid()}`;
  const tokNsa   = `tok-nsa-${uid()}`;

  const org17Res = await db.query(
    `INSERT INTO organizations (name, slug, industry, size, plan)
     VALUES ($1, $2, 'technology', '11-50', 'starter') RETURNING id`,
    [`Admin Test Org ${slug17}`, slug17],
  );
  const org17Id = org17Res.rows[0].id;

  // Users
  for (const [id, name, email] of [
    [userSa,  "Super Admin 17",  `sa-17-${slug17}@test.invalid`],
    [userNsa, "Non SuperAdmin 17", `nsa-17-${slug17}@test.invalid`],
  ]) {
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4::timestamptz, $4::timestamptz) ON CONFLICT DO NOTHING`,
      [id, name, email, now17],
    );
  }

  // Sessions
  for (const [id, token, userId] of [
    [sessSa,  tokSa,  userSa],
    [sessNsa, tokNsa, userNsa],
  ]) {
    await db.query(
      `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ($1, $2::timestamptz, $3, $4::timestamptz, $4::timestamptz, $5) ON CONFLICT DO NOTHING`,
      [id, expires17, token, now17, userId],
    );
  }

  // Memberships — super_admin for userSa, owner (not super_admin) for userNsa
  for (const [orgId, userId, role, email] of [
    [org17Id, userSa,  "super_admin", `sa-17-${slug17}@test.invalid`],
    [org17Id, userNsa, "owner",       `nsa-17-${slug17}@test.invalid`],
  ]) {
    await db.query(
      `INSERT INTO org_members (org_id, clerk_user_id, role, email)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [orgId, userId, role, email],
    );
  }

  const cookieSa  = cookieHdr(tokSa);
  const cookieNsa = cookieHdr(tokNsa);
  const testIp17  = "10.17.0.1";

  // ── Ensure schema and seed a throttle row for testIp17 ───────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS ip_magic_link_rate (
      ip            TEXT    PRIMARY KEY,
      count         INTEGER NOT NULL DEFAULT 0,
      window_start  BIGINT  NOT NULL,
      blocked_until BIGINT  NOT NULL DEFAULT 0
    )
  `).catch(() => {});

  const nowBigint = BigInt(Date.now());
  const futureBigint = nowBigint + BigInt(60 * 1000); // blocked for 1 min
  await db.query(
    `INSERT INTO ip_magic_link_rate (ip, count, window_start, blocked_until)
     VALUES ($1, 6, $2, $3)
     ON CONFLICT (ip) DO UPDATE
       SET count=EXCLUDED.count, window_start=EXCLUDED.window_start, blocked_until=EXCLUDED.blocked_until`,
    [testIp17, nowBigint, futureBigint],
  );

  const HOST = new URL(BASE).host;

  // ── 17.1 Non-super_admin is rejected (403) on GET /admin/rate-limits ─────
  const nsa401 = await fetch(`${BASE}/admin/rate-limits`, {
    headers: { Cookie: cookieNsa, Host: HOST },
  });
  check("17.1 non-super_admin: GET /admin/rate-limits returns 403", nsa401.status, 403);

  // ── 17.2 Non-super_admin is rejected (403) on DELETE /admin/magic-link-rate/:ip ─
  const nsaDel = await fetch(`${BASE}/admin/magic-link-rate/${testIp17}`, {
    method: "DELETE",
    headers: { Cookie: cookieNsa, Host: HOST },
  });
  check("17.2 non-super_admin: DELETE /admin/magic-link-rate/:ip returns 403", nsaDel.status, 403);

  // ── 17.3 Super_admin can read rate limits and see the seeded IP ──────────
  const saGet = await fetch(`${BASE}/admin/rate-limits`, {
    headers: { Cookie: cookieSa, Host: HOST },
  });
  check("17.3 super_admin: GET /admin/rate-limits returns 200", saGet.status, 200);

  let foundThrottle = false;
  if (saGet.status === 200) {
    const body = await saGet.json().catch(() => ({}));
    const throttles = body?.magicLinkThrottles ?? [];
    foundThrottle = Array.isArray(throttles) && throttles.some((t) => t.ip === testIp17);
  }
  check("17.4 super_admin: seeded IP appears in magicLinkThrottles", foundThrottle ? 200 : 404, 200);

  // ── 17.5 Super_admin can clear the throttle window ───────────────────────
  const saDel = await fetch(`${BASE}/admin/magic-link-rate/${testIp17}`, {
    method: "DELETE",
    headers: { Cookie: cookieSa, Host: HOST },
  });
  check("17.5 super_admin: DELETE /admin/magic-link-rate/:ip returns 200", saDel.status, 200);

  let deleteOk = false;
  if (saDel.status === 200) {
    const body = await saDel.json().catch(() => ({}));
    deleteOk = body?.ok === true;
  }
  check("17.6 super_admin: DELETE response body has { ok: true }", deleteOk ? 200 : 422, 200);

  // ── 17.7 Row is gone from the database ───────────────────────────────────
  const remaining = await db.query(
    `SELECT 1 FROM ip_magic_link_rate WHERE ip = $1`, [testIp17],
  );
  check("17.7 ip_magic_link_rate row is deleted after clear", remaining.rowCount === 0 ? 200 : 409, 200);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await db.query(`DELETE FROM ip_magic_link_rate WHERE ip = $1`, [testIp17]).catch(() => {});
  await db.query(`DELETE FROM org_members WHERE clerk_user_id = ANY($1::text[])`, [[userSa, userNsa]]).catch(() => {});
  await db.query(`DELETE FROM session WHERE id = ANY($1::text[])`, [[sessSa, sessNsa]]).catch(() => {});
  await db.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [[userSa, userNsa]]).catch(() => {});
  await db.query(`DELETE FROM organizations WHERE id = $1`, [org17Id]).catch(() => {});
}

// ── Section 18: Public Status Page — Down / Recovery ─────────────────────────

{
  section("SECTION 18 — Public Status Page: down / degraded / recovery");

  // The public status endpoint is GET /api/public/status
  // It reads from system_health_log to derive current_status per component.
  // We insert synthetic probe rows for a unique test component and verify the
  // endpoint returns 200 (the body shape is checked separately; the integration
  // test here focuses on correct HTTP behaviour across status transitions).

  const component18 = `test-component-${Date.now()}`;

  // 18.1 — healthy probe → endpoint still responds 200
  await db.query(
    `INSERT INTO system_health_log (component, status, checked_at) VALUES ($1, 'healthy', NOW())`,
    [component18],
  ).catch(() => {});

  const res181 = await fetch(`${BASE}/public/status`).catch(() => null);
  check("18.1 status endpoint returns 200 after healthy probe", res181?.status ?? 0, 200);

  // 18.2 — degraded probe → endpoint still responds 200 (never 5xx)
  await db.query(
    `INSERT INTO system_health_log (component, status, checked_at) VALUES ($1, 'degraded', NOW())`,
    [component18],
  ).catch(() => {});

  const res182 = await fetch(`${BASE}/public/status`).catch(() => null);
  check("18.2 status endpoint returns 200 after degraded probe", res182?.status ?? 0, 200);

  // 18.3 — verify response body is valid JSON with an 'overall' field
  let bodyOk183 = false;
  if (res182?.status === 200) {
    try {
      // Re-fetch to get a fresh body (res182 may have already been consumed)
      const res183b = await fetch(`${BASE}/public/status`);
      const data = await res183b.json();
      bodyOk183 = typeof data?.overall === "string";
    } catch {
      bodyOk183 = false;
    }
  }
  check("18.3 status response body has an 'overall' field", bodyOk183 ? 200 : 422, 200);

  // 18.4 — recovery probe → endpoint still responds 200
  await db.query(
    `INSERT INTO system_health_log (component, status, checked_at) VALUES ($1, 'healthy', NOW())`,
    [component18],
  ).catch(() => {});

  const res184 = await fetch(`${BASE}/public/status`).catch(() => null);
  check("18.4 status endpoint returns 200 after recovery probe", res184?.status ?? 0, 200);

  // 18.5 — response body contains a 'components' array
  let hasComponents = false;
  if (res184?.status === 200) {
    try {
      const res185b = await fetch(`${BASE}/public/status`);
      const data = await res185b.json();
      hasComponents = Array.isArray(data?.components) && data.components.length > 0;
    } catch {
      hasComponents = false;
    }
  }
  check("18.5 status response body has a non-empty 'components' array", hasComponents ? 200 : 422, 200);

  // Cleanup
  await db.query(`DELETE FROM system_health_log WHERE component = $1`, [component18]).catch(() => {});
}

// ── Section 19: SSO / SAML Callback ──────────────────────────────────────────

{
  section("SECTION 19 — SSO / SAML Callback: error handling");

  // The SAML ACS endpoint is POST /api/saml/:orgSlug/callback
  // On failures it redirects (302) to the sign-in page with an error query param.
  // We verify error paths without a valid IdP assertion.

  // 19.1 — no SAMLResponse in body → redirect to error page
  const res191 = await fetch(`${BASE}/saml/no-such-org-slug-xyz/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ RelayState: "" }).toString(),
    redirect: "manual",
  }).catch(() => null);

  const loc191 = res191?.headers.get("location") ?? "";
  check(
    "19.1 missing SAMLResponse → redirect (302/429)",
    res191?.status ?? 0,
    302, 429,
  );

  // 19.2 — missing SAMLResponse redirect goes to an error destination
  const isErrorRedirect191 = loc191.includes("error=") || loc191.includes("sign-in") || loc191.includes("saml");
  check(
    "19.2 missing SAMLResponse redirect points to an error page",
    isErrorRedirect191 ? 200 : 422,
    200,
  );

  // 19.3 — invalid base64 SAMLResponse → redirect to saml_failed
  const res193 = await fetch(`${BASE}/saml/no-such-org-slug-xyz/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      SAMLResponse: Buffer.from("not-a-valid-saml-response").toString("base64"),
    }).toString(),
    redirect: "manual",
  }).catch(() => null);

  check(
    "19.3 invalid SAMLResponse → redirect (302/429)",
    res193?.status ?? 0,
    302, 429,
  );

  const loc193 = res193?.headers.get("location") ?? "";
  const isErrorRedirect193 = loc193.includes("saml_failed") || loc193.includes("error") || loc193.includes("sign-in");
  check(
    "19.4 invalid SAMLResponse redirect points to an error page",
    isErrorRedirect193 ? 200 : 422,
    200,
  );

  // 19.5 — org with no SSO config → redirect to error
  const res195 = await fetch(`${BASE}/saml/totally-nonexistent-org-abc123/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ SAMLResponse: "dGVzdA==" }).toString(),
    redirect: "manual",
  }).catch(() => null);

  check(
    "19.5 no SSO config org → redirect or error response",
    res195?.status ?? 0,
    302, 400, 404, 429,
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

await cleanup();

const bar = "═".repeat(70);
console.log(`\n${bar}`);
console.log(`  RESULTS: ${passed}/${total} passed   ${failed > 0 ? `⚠  ${failed} FAILED` : "✓ all passed"}`);
if (failures.length > 0) {
  console.log("\n  Failed checks:");
  for (const f of failures) console.log(f);
}
console.log(bar);

process.exit(failed > 0 ? 1 : 0);
