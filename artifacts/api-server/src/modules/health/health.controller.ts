import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";

// Health check is called frequently by Railway uptime probes and load balancers.
// It carries no auth cost and must never be throttled.
@Controller("healthz")
@SkipThrottle()
export class HealthController {
  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
