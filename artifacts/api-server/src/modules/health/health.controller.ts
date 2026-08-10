import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { RateLimitCleanupService } from "../scheduler/rate-limit-cleanup.service";

// Health check is called frequently by Railway uptime probes and load balancers.
// It carries no auth cost and must never be throttled.
@Controller("healthz")
@SkipThrottle()
export class HealthController {
  constructor(private readonly cleanupService: RateLimitCleanupService) {}

  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  /**
   * GET /healthz/scheduler
   *
   * Returns the last-run outcome of each cleanup cron job.
   *
   * HTTP 200 — both jobs are healthy (or not yet run since last deploy).
   * HTTP 503 — one or more jobs failed their last run; uptime monitors
   *            should treat this as a page-worthy signal.
   *
   * Raw error text is never included in the response body; only sanitised
   * fields (failed: boolean, errorCount, lastRunAt, lastSuccess) are exposed.
   *
   * Shape:
   * {
   *   healthy: boolean,
   *   nightly: { lastRunAt, lastSuccess, failed, errorCount },
   *   magicLinkHourly: { lastRunAt, lastSuccess, failed, errorCount }
   * }
   */
  @Get("scheduler")
  schedulerHealth() {
    const health = this.cleanupService.getHealth();
    if (!health.healthy) {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
