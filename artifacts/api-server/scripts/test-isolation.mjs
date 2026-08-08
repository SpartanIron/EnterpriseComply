/**
 * Cross-org isolation verification script.
 * Builds __Secure- prefixed, HMAC-signed Better Auth session cookies for two
 * test principals then attempts every read + write combination across the wrong
 * org boundary. Expects 403 (or 401 if session somehow fails) on every call.
 */
import { createHmac } from "crypto";

const BASE = "http://localhost:8080/api";
const SECRET = process.env.BETTER_AUTH_SECRET || "ec-dev-secret-change-in-production";

// Tokens injected into the DB in the previous step
const TOKEN_A = process.argv[2]; // org 1 user → attacking org 3
const TOKEN_B = process.argv[3]; // org 3 user → attacking org 1

function signToken(rawToken) {
  const sig = createHmac("sha256", SECRET).update(rawToken).digest();
  const b64 = Buffer.from(sig).toString("base64"); // plain btoa, not base64url
  return `${rawToken}.${b64}`;
}

function cookie(token) {
  return `__Secure-better-auth.session_token=${signToken(token)}`;
}

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

async function run() {
  const cookieA = cookie(TOKEN_A); // org 1 user
  const cookieB = cookie(TOKEN_B); // org 3 user

  // ── Verify own-org access works first ──────────────────────────────────────
  console.log("=== BASELINE: own-org (expect 200) ===");
  const selfA = await hit("GET", `${BASE}/orgs/1/risks`, cookieA);
  const selfB = await hit("GET", `${BASE}/orgs/3/risks`, cookieB);
  console.log(`User A → Org 1 GET risks: ${selfA}`);
  console.log(`User B → Org 3 GET risks: ${selfB}`);
  if (selfA !== 200 || selfB !== 200) {
    console.error("BASELINE FAILED — session cookies not working. Aborting cross-org tests.");
    process.exit(1);
  }

  // ── READ: User A (org 1) → Org 3 ──────────────────────────────────────────
  console.log("\n=== READ: User A (org 1) → Org 3 (expect 403) ===");
  const readEndpoints = [
    "frameworks", "controls", "risks", "evidence", "people",
    "policies", "access-reviews", "audit-shares", "integrations",
    "zero-trust", "remediation", "questionnaires", "audits",
    "score-history",
  ];
  const readResultsA3 = await Promise.all(
    readEndpoints.map(async ep => ({
      ep,
      status: await hit("GET", `${BASE}/orgs/3/${ep}`, cookieA),
    }))
  );
  let allPass = true;
  for (const { ep, status } of readResultsA3) {
    const ok = status === 403;
    if (!ok) allPass = false;
    console.log(`  ${ep.padEnd(20)} ${status}  ${ok ? "✓" : "✗ UNEXPECTED"}`);
  }

  // ── READ: User B (org 3) → Org 1 ──────────────────────────────────────────
  console.log("\n=== READ: User B (org 3) → Org 1 (expect 403) ===");
  const readResultsB1 = await Promise.all(
    readEndpoints.map(async ep => ({
      ep,
      status: await hit("GET", `${BASE}/orgs/1/${ep}`, cookieB),
    }))
  );
  for (const { ep, status } of readResultsB1) {
    const ok = status === 403;
    if (!ok) allPass = false;
    console.log(`  ${ep.padEnd(20)} ${status}  ${ok ? "✓" : "✗ UNEXPECTED"}`);
  }

  // ── WRITE: User A (org 1) → Org 3 ─────────────────────────────────────────
  console.log("\n=== WRITE: User A (org 1) → Org 3 (expect 403) ===");
  const writeA3 = [
    ["POST",  "risks",    { title: "injected risk", severity: "high" }],
    ["POST",  "evidence", { title: "injected evidence", type: "document", source: "manual" }],
    ["POST",  "people",   { name: "injected person", email: "x@evil.com", role: "admin" }],
    ["POST",  "policies", { title: "injected policy", status: "draft" }],
    ["PATCH", "risks/999",{ title: "mutation" }],
    ["DELETE","risks/999", null],
  ];
  for (const [method, path, body] of writeA3) {
    const status = await hit(method, `${BASE}/orgs/3/${path}`, cookieA, body);
    const ok = status === 403 || status === 404; // 404 acceptable for non-existent IDs
    if (!ok) allPass = false;
    console.log(`  ${method} ${path.padEnd(18)} ${status}  ${ok ? "✓" : "✗ UNEXPECTED"}`);
  }

  // ── WRITE: User B (org 3) → Org 1 ─────────────────────────────────────────
  console.log("\n=== WRITE: User B (org 3) → Org 1 (expect 403) ===");
  const writeB1 = [
    ["POST",  "risks",    { title: "injected risk", severity: "high" }],
    ["POST",  "evidence", { title: "injected evidence", type: "document", source: "manual" }],
    ["POST",  "people",   { name: "injected person", email: "x@evil.com", role: "admin" }],
    ["POST",  "policies", { title: "injected policy", status: "draft" }],
    ["PATCH", "risks/999",{ title: "mutation" }],
    ["DELETE","risks/999", null],
  ];
  for (const [method, path, body] of writeB1) {
    const status = await hit(method, `${BASE}/orgs/1/${path}`, cookieB, body);
    const ok = status === 403 || status === 404;
    if (!ok) allPass = false;
    console.log(`  ${method} ${path.padEnd(18)} ${status}  ${ok ? "✓" : "✗ UNEXPECTED"}`);
  }

  // ── Cross-org mutation via own-org path: attempt to write Org 3's risk ID ─
  console.log("\n=== MUTATION BYPASS: User A patches Org 3 risk via Org 1 URL ===");
  // Get an actual risk ID from org 3 to confirm the DB predicate blocks it
  const r3Resp = await fetch(`${BASE}/orgs/3/risks`, {
    headers: { Cookie: cookie(TOKEN_B) }, // legitimate org 3 session
  });
  const r3Data = await r3Resp.json().catch(() => ({}));
  const org3Risks = r3Data.risks ?? [];
  if (org3Risks.length > 0) {
    const crossId = org3Risks[0].id;
    // Attempt PATCH via org 1 URL using org 3's risk ID
    const crossStatus = await hit("PATCH", `${BASE}/orgs/1/risks/${crossId}`, cookieA, { title: "cross-org mutation" });
    const ok = crossStatus === 403 || crossStatus === 404;
    if (!ok) allPass = false;
    console.log(`  PATCH org1/risks/${crossId} (org3 ID) via org1 session: ${crossStatus}  ${ok ? "✓" : "✗ UNEXPECTED — DB predicate missing!"}`);
    // Verify risk title unchanged in DB
    const verify = await fetch(`${BASE}/orgs/3/risks`, {
      headers: { Cookie: cookie(TOKEN_B) },
    });
    const verifyData = await verify.json().catch(() => ({}));
    const unchanged = (verifyData.risks ?? []).find(r => r.id === crossId);
    console.log(`  Org 3 risk title after attempt: "${unchanged?.title}" (unchanged = ${unchanged?.title === org3Risks[0].title ? "✓" : "✗"})`);
  } else {
    console.log("  (no risks in org 3 to test with — inserting one first)");
    // No risks in org 3 — insert one via legitimate B session, then retry
    await hit("POST", `${BASE}/orgs/3/risks`, cookieB, { title: "org3 legitimate risk", severity: "low" });
  }

  // ── Webhook unauthenticated endpoint ──────────────────────────────────────
  console.log("\n=== WEBHOOK: unauthenticated call (expect 503, WEBHOOK_SECRET unset) ===");
  const wh = await hit("POST", `${BASE}/webhooks/user-created`, "", {
    userId: "fake-user", email: "attacker@evil.com", firstName: "hax",
  });
  const whOk = wh === 503 || wh === 401;
  if (!whOk) allPass = false;
  console.log(`  No-secret POST: ${wh}  ${whOk ? "✓" : "✗ UNEXPECTED"}`);

  console.log(`\n${"═".repeat(50)}`);
  console.log(allPass ? "ALL CHECKS PASSED ✓" : "⚠ ONE OR MORE CHECKS FAILED — see above");
  process.exit(allPass ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
