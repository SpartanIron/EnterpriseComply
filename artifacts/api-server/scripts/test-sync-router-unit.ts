/**
 * test-sync-router-unit.ts
 *
 * Unit tests for IntegrationsController.syncIntegration() — the generic
 * POST /orgs/:orgId/integrations/:key/sync router.
 *
 * Tests that each key ("railway", "replit", "betterauth") dispatches to the
 * correct service method.  Uses minimal stubs so no real HTTP requests or
 * database connections are made.
 *
 * Must be run under SWC so NestJS decorators are handled:
 *   node --import @swc-node/register/esm-register scripts/test-sync-router-unit.ts
 *
 * Exit code 0 = all assertions passed, 1 = one or more failed.
 */

import { IntegrationsController } from "../src/modules/integrations/integrations.controller.js";

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, got: unknown, ...expected: unknown[]) {
  const ok = expected.includes(got);
  if (ok) {
    passed++;
    console.log(`  ✓  ${name}`);
  } else {
    failed++;
    const note = `got=${String(got)} expected=${expected.join("/")}`;
    console.log(`  ✗  ${name} — ${note}`);
    failures.push(`  ✗  ${name} — ${note}`);
  }
}

// ── Minimal mock service ──────────────────────────────────────────────────────

type CallRecord = { method: string; orgId: number };
const calls: CallRecord[] = [];

function makeServiceSpy() {
  return {
    syncOrgRailway:    (orgId: number) => { calls.push({ method: "syncOrgRailway",    orgId }); return Promise.resolve({ ok: true }); },
    syncOrgReplit:     (orgId: number) => { calls.push({ method: "syncOrgReplit",     orgId }); return Promise.resolve({ ok: true }); },
    syncOrgBetterAuth: (orgId: number) => { calls.push({ method: "syncOrgBetterAuth", orgId }); return Promise.resolve({ ok: true }); },
    syncOrgGitHub:     (orgId: number) => { calls.push({ method: "syncOrgGitHub",     orgId }); return Promise.resolve({ ok: true }); },
    syncOrgAWS:        (orgId: number) => { calls.push({ method: "syncOrgAWS",        orgId }); return Promise.resolve({ ok: true }); },
    syncOrgOkta:       (orgId: number) => { calls.push({ method: "syncOrgOkta",       orgId }); return Promise.resolve({ ok: true }); },
    syncOrgCloudflare: (orgId: number) => { calls.push({ method: "syncOrgCloudflare", orgId }); return Promise.resolve({ ok: true }); },
    // Other methods not under test — stubs to satisfy the type
    getCatalog:                       () => [],
    getOrgIntegrations:               () => Promise.resolve([]),
    buildGithubAuthUrl:               () => "",
    handleGithubCallback:             () => Promise.resolve({ redirectUrl: "/" }),
    connectGitHub:                    () => Promise.resolve({}),
    connectAWS:                       () => Promise.resolve({}),
    connectOkta:                      () => Promise.resolve({}),
    connectRailway:                   () => Promise.resolve({}),
    connectReplit:                    () => Promise.resolve({}),
    connectBetterAuth:                () => Promise.resolve({}),
    connectCloudflare:                () => Promise.resolve({}),
    connectDemo:                      () => Promise.resolve({}),
    verifyIntegrationConnection:      () => Promise.resolve({}),
  };
}

// ── Build a fake OrgCtx ───────────────────────────────────────────────────────

function fakeCtx(orgId = 42): { orgId: number; org: Record<string, unknown>; member: Record<string, unknown> } {
  return { orgId, org: {}, member: {} };
}

// ── Instantiate the controller under test ─────────────────────────────────────

const serviceSpy = makeServiceSpy();
const controller = new IntegrationsController(serviceSpy as any);

// ── Test 1: "railway" key dispatches to syncOrgRailway ────────────────────────

{
  calls.length = 0;
  const ctx = fakeCtx(100);
  await controller.syncIntegration(ctx, "railway");

  check(
    "syncIntegration('railway') calls syncOrgRailway (not a fallback)",
    calls.length === 1 && calls[0].method === "syncOrgRailway" ? 200 : 422,
    200,
  );
  check(
    "syncIntegration('railway') passes the correct orgId",
    calls[0]?.orgId,
    100,
  );
}

// ── Test 2: "replit" key dispatches to syncOrgReplit ─────────────────────────

{
  calls.length = 0;
  const ctx = fakeCtx(200);
  await controller.syncIntegration(ctx, "replit");

  check(
    "syncIntegration('replit') calls syncOrgReplit (not a fallback)",
    calls.length === 1 && calls[0].method === "syncOrgReplit" ? 200 : 422,
    200,
  );
  check(
    "syncIntegration('replit') passes the correct orgId",
    calls[0]?.orgId,
    200,
  );
}

// ── Test 3: "betterauth" key dispatches to syncOrgBetterAuth ─────────────────

{
  calls.length = 0;
  const ctx = fakeCtx(300);
  await controller.syncIntegration(ctx, "betterauth");

  check(
    "syncIntegration('betterauth') calls syncOrgBetterAuth (not a fallback)",
    calls.length === 1 && calls[0].method === "syncOrgBetterAuth" ? 200 : 422,
    200,
  );
  check(
    "syncIntegration('betterauth') passes the correct orgId",
    calls[0]?.orgId,
    300,
  );
}

// ── Test 4: unknown key falls through to the no-op response ──────────────────

{
  calls.length = 0;
  const ctx = fakeCtx(400);
  const result = await controller.syncIntegration(ctx, "unknown-integration-key");

  check(
    "syncIntegration('unknown-key') calls no service method (falls through)",
    calls.length,
    0,
  );
  check(
    "syncIntegration('unknown-key') returns a no-op success object",
    typeof (result as any)?.message === "string" ? 200 : 422,
    200,
  );
}

// ── Test 5: existing keys ("github", "aws", "okta", "cloudflare") still route correctly ──

{
  for (const [key, method] of [
    ["github",     "syncOrgGitHub"],
    ["aws",        "syncOrgAWS"],
    ["okta",       "syncOrgOkta"],
    ["cloudflare", "syncOrgCloudflare"],
  ] as const) {
    calls.length = 0;
    await controller.syncIntegration(fakeCtx(999), key);
    check(
      `syncIntegration('${key}') calls ${method}`,
      calls.length === 1 && calls[0].method === method ? 200 : 422,
      200,
    );
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\n  Failed:");
  for (const f of failures) console.log(f);
}
process.exit(failed > 0 ? 1 : 0);
