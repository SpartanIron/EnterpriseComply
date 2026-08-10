/**
 * test-scheduler-http-503.ts
 *
 * Integration test: verifies that GET /healthz/scheduler returns HTTP 503
 * (with a sanitised body) when the nightly or magic-link cleanup job has
 * encountered a pool error.
 *
 * Strategy:
 *   1. Spin up a minimal NestJS HTTP server containing only
 *      HealthController + RateLimitCleanupService + a no-op SlackAlertService.
 *   2. Use _setPoolFactory() to inject a pool stub that always throws.
 *   3. Call the actual pruneStaleRows() method to trigger the real catch path.
 *   4. Hit GET /healthz/scheduler via fetch and assert HTTP 503.
 *   5. Assert the body is sanitised (no raw error text, healthy=false).
 *   6. Tear down the server.
 *
 * Exit code: 0 = all assertions passed, 1 = one or more failed.
 *
 * Usage:
 *   node --import @swc-node/register/esm-register scripts/test-scheduler-http-503.ts
 */

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import type { AddressInfo } from "net";

// ── Stub SlackAlertService ────────────────────────────────────────────────────
// Prevents real HTTP calls during the test.  Implements only the method used
// by RateLimitCleanupService.

@Injectable()
class NoOpSlackAlertService {
  private readonly logger = new Logger("NoOpSlackAlertService");
  async sendRawMessage(_text: string): Promise<void> {
    this.logger.debug("[test] Slack alert suppressed in test environment");
  }
}

// ── Lazy imports (avoids running before NestJS is bootstrapped) ───────────────

const { RateLimitCleanupService } = await import(
  "../src/modules/scheduler/rate-limit-cleanup.service.js"
);
const { HealthController } = await import(
  "../src/modules/health/health.controller.js"
);
const { SlackAlertService } = await import(
  "../src/modules/notifications/slack-alert.service.js"
);

// ── Minimal test module ───────────────────────────────────────────────────────

@Module({
  controllers: [HealthController],
  providers: [
    RateLimitCleanupService,
    // Override the real SlackAlertService with a no-op stub.
    { provide: SlackAlertService, useClass: NoOpSlackAlertService },
  ],
})
class TestSchedulerHealthModule {}

// ── Test runner ───────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    pass++;
    process.stdout.write(`  ✓  ${label.padEnd(65)} ${String(actual)}\n`);
  } else {
    fail++;
    const msg = `  ✗  ${label.padEnd(65)} got=${String(actual)} expected=${String(expected)}`;
    process.stdout.write(msg + "\n");
    failures.push(msg);
  }
}

async function run(): Promise<void> {
  // Boot a minimal NestJS app on a random port (no DB connection required).
  const app = await NestFactory.create(TestSchedulerHealthModule, { logger: false });
  await app.listen(0); // port 0 = OS-assigned free port

  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://localhost:${port}`;

  try {
    // ── Before failure: endpoint returns 200 ─────────────────────────────────
    const preRes = await fetch(`${base}/healthz/scheduler`);
    assert("PRE: /healthz/scheduler returns 200 before any failure", preRes.status, 200);

    const preBody = await preRes.json() as Record<string, unknown>;
    assert("PRE: healthy=true before any failure",                  preBody.healthy, true);

    // ── Inject a broken pool and run the actual production method ─────────────
    const svc = app.get(RateLimitCleanupService);
    svc._setPoolFactory(() => ({
      query: () => Promise.reject(new Error("ECONNREFUSED: test-DB-down")),
    }));

    // Call the real production method — exercises the full catch path.
    await svc.pruneStaleRows();

    // ── After failure: endpoint must return 503 ───────────────────────────────
    const postRes = await fetch(`${base}/healthz/scheduler`);
    assert("POST: /healthz/scheduler returns 503 after nightly failure", postRes.status, 503);

    const postBody = await postRes.json() as Record<string, unknown>;
    assert("POST: body.healthy=false",                   postBody.healthy,              false);

    const nightly = postBody.nightly as Record<string, unknown> | undefined;
    assert("POST: nightly.failed=true",                  nightly?.failed,               true);
    assert("POST: nightly.lastSuccess=false",             nightly?.lastSuccess,          false);
    assert("POST: nightly.errorCount=1",                  nightly?.errorCount,           1);
    assert(
      "POST: nightly has no 'lastError' raw text",
      Object.prototype.hasOwnProperty.call(nightly ?? {}, "lastError"),
      false,
    );

    // ── Verify magic-link path as well ───────────────────────────────────────
    await svc.pruneMagicLinkRateRows();

    const mlRes  = await fetch(`${base}/healthz/scheduler`);
    const mlBody = await mlRes.json() as Record<string, unknown>;
    assert("POST: /healthz/scheduler still 503 after magic-link failure too", mlRes.status, 503);

    const ml = mlBody.magicLinkHourly as Record<string, unknown> | undefined;
    assert("POST: magicLinkHourly.failed=true",          ml?.failed,                    true);

    // ── Recovery: healthy 200 after a successful run ──────────────────────────
    svc._setPoolFactory(() => ({
      query: () => Promise.resolve({ rows: [{ count: "0" }] }),
    }));
    await svc.pruneStaleRows();
    await svc.pruneMagicLinkRateRows();

    const recRes  = await fetch(`${base}/healthz/scheduler`);
    const recBody = await recRes.json() as Record<string, unknown>;
    assert("RECOVERY: /healthz/scheduler returns 200 after both jobs recover", recRes.status,    200);
    assert("RECOVERY: body.healthy=true after recovery",                        recBody.healthy,  true);

  } finally {
    await app.close();
  }
}

await run();

const bar = "═".repeat(70);
console.log(`\n${bar}`);
console.log(`  HTTP-503 integration: ${pass}/${pass + fail} passed${fail > 0 ? `  ⚠ ${fail} FAILED` : "  ✓ all passed"}`);
if (failures.length > 0) {
  for (const f of failures) console.log(f);
}
console.log(bar);

process.exit(fail > 0 ? 1 : 0);
