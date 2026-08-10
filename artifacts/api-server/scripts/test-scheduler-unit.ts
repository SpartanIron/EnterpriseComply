/**
 * test-scheduler-unit.ts
 *
 * Unit tests for RateLimitCleanupService (sections 20.3 – 20.8).
 * Must be run under SWC so NestJS decorators are handled:
 *   node --import @swc-node/register/esm-register scripts/test-scheduler-unit.ts
 *
 * Exit code 0 = all assertions passed, 1 = one or more failed.
 */

import { RateLimitCleanupService } from "../src/modules/scheduler/rate-limit-cleanup.service.js";
import { HealthController } from "../src/modules/health/health.controller.js";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const noOpSlack = { sendRawMessage: () => Promise.resolve() };
const silent = { log: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

function makeService() {
  const svc = new RateLimitCleanupService(noOpSlack as any);
  (svc as any).logger = silent;
  return svc;
}

function brokenPool(msg = "ECONNREFUSED: DB is down") {
  return { query: () => Promise.reject(new Error(msg)) };
}

function workingPool() {
  return { query: () => Promise.resolve({ rows: [{ count: "0" }] }) };
}

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

// ── 20.3: pruneStaleRows() increments nightly errorCount on pool failure ──────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("nightly-pool-down") as any);
  await svc.pruneStaleRows();

  const h = svc.getHealth();
  check("20.3a nightly errorCount = 1 after first failure", h.nightly.errorCount, 1);
  check("20.3b nightly lastSuccess = false",                h.nightly.lastSuccess, false);
  check("20.3c nightly failed = true",                      h.nightly.failed,      true);
  check(
    "20.3d nightly lastRunAt is an ISO timestamp",
    typeof h.nightly.lastRunAt === "string" && h.nightly.lastRunAt.includes("T") ? 200 : 422,
    200,
  );
}

// ── 20.4: getHealth() must not expose raw error text ─────────────────────────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("raw-error-text-must-not-leak") as any);
  await svc.pruneStaleRows();

  const h = svc.getHealth();
  check(
    "20.4a getHealth().nightly has no 'lastError' raw string",
    Object.prototype.hasOwnProperty.call(h.nightly, "lastError") ? 422 : 200,
    200,
  );
  check("20.4b getHealth().healthy = false",     h.healthy,        false);
  check("20.4c getHealth().nightly.failed=true", h.nightly.failed, true);
}

// ── 20.5: pruneMagicLinkRateRows() increments magic-link counter ──────────────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("magic-link-pool-down") as any);
  await svc.pruneMagicLinkRateRows();

  const h = svc.getHealth();
  check("20.5a magicLink errorCount = 1",    h.magicLinkHourly.errorCount, 1);
  check("20.5b magicLink lastSuccess=false", h.magicLinkHourly.lastSuccess, false);
  check("20.5c magicLink failed=true",       h.magicLinkHourly.failed,     true);
}

// ── 20.6: errorCount accumulates across repeated failures ─────────────────────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("repeated-failure") as any);
  await svc.pruneStaleRows();
  await svc.pruneStaleRows();
  await svc.pruneStaleRows();
  await svc.pruneMagicLinkRateRows();
  await svc.pruneMagicLinkRateRows();

  const h = svc.getHealth();
  check("20.6a nightly errorCount = 3 after three failures",   h.nightly.errorCount,         3);
  check("20.6b magicLink errorCount = 2 after two failures",   h.magicLinkHourly.errorCount, 2);
  check("20.6c getHealth().healthy = false (both failed)",      h.healthy,                    false);
}

// ── 20.7: schedulerHealth() throws HttpException(503) when unhealthy ──────────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("controller-503-test") as any);
  await svc.pruneStaleRows();

  const ctrl = new HealthController(svc as any);
  let caught: any = null;
  try {
    ctrl.schedulerHealth();
  } catch (e) {
    caught = e;
  }

  check(
    "20.7a schedulerHealth() throws when unhealthy (HttpException)",
    caught !== null ? 200 : 422,
    200,
  );
  check("20.7b thrown HttpException has status 503", caught?.getStatus?.() ?? 0, 503);
  check(
    "20.7c thrown exception body has healthy=false",
    caught?.getResponse?.()?.healthy === false ? 200 : 422,
    200,
  );
}

// ── 20.8: successful run resets lastSuccess to true ───────────────────────────

{
  const svc = makeService();
  svc._setPoolFactory(() => brokenPool("initial-failure") as any);
  await svc.pruneStaleRows();
  check("20.8 pre: failed=true after failure", svc.getHealth().nightly.failed, true);

  svc._setPoolFactory(() => workingPool() as any);
  await svc.pruneStaleRows();
  const h = svc.getHealth();
  check("20.8a lastSuccess=true after recovery",          h.nightly.lastSuccess, true);
  check("20.8b failed=false after recovery",               h.nightly.failed,      false);
  check("20.8c errorCount unchanged after recovery",       h.nightly.errorCount,  1);
  check("20.8d getHealth().healthy=true after recovery",   h.healthy,             true);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\n  Failed:");
  for (const f of failures) console.log(f);
}
process.exit(failed > 0 ? 1 : 0);
