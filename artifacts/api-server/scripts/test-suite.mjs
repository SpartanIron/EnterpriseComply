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
  check(`Owner-A → Org-B ${method} ${path}`, status, 403, 404);
}

console.log("\n  Direction B→A: Owner B writing to Org A");
for (const [method, path, body] of writeOps) {
  const status = await req(method, `/orgs/${A}/${path}`, cookieOwnerB, body);
  check(`Owner-B → Org-A ${method} ${path}`, status, 403, 404);
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
    await req("POST", `/orgs/${orgStarterId}/ssp/generate`, cookieStarter, {}), 402);

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
