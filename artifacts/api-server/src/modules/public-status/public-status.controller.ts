import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { SystemHealthService } from "./system-health.service";

/**
 * Public status API — no authentication required.
 * Returns system health for the public status page at /status.
 */
@Controller("public")
@SkipThrottle()
export class PublicStatusController {
  constructor(private readonly healthSvc: SystemHealthService) {}

  @Get("status")
  getStatus() {
    return this.healthSvc.getStatus();
  }
}
