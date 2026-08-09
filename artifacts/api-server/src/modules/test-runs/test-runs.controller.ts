import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { TestRunsService } from "./test-runs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

interface OrgCtx { orgId: number; }

@Controller()
export class TestRunsController {
  constructor(private readonly testRunsService: TestRunsService) {}

  @Get("orgs/:orgId/test-runs")
  @UseGuards(OrgContextGuard)
  getTestRuns(@OrgContext() ctx: OrgCtx) {
    return this.testRunsService.getTestRuns(ctx.orgId);
  }

  @Get("orgs/:orgId/integration-health")
  @UseGuards(OrgContextGuard)
  getIntegrationHealth(@OrgContext() ctx: OrgCtx) {
    return this.testRunsService.getIntegrationHealth(ctx.orgId);
  }

  @Post("orgs/:orgId/test-runs/trigger")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  triggerTestRuns(@OrgContext() ctx: OrgCtx) {
    return this.testRunsService.triggerTestRuns(ctx.orgId);
  }

  /**
   * Runs the scheduler's full dispatch-and-catch path for every connected
   * integration belonging to the org, bypassing the interval gate.
   * Exercises the same per-integration try/catch as runDueIntegrations()
   * (including sync-log failure persistence), scoped to one org.
   * Requires owner role — intentionally the same guard as the connect endpoints.
   */
  @Post("orgs/:orgId/test-runs/run-scheduled")
  @UseGuards(OrgContextGuard, RequireRole("owner"))
  runScheduled(@OrgContext() ctx: OrgCtx) {
    return this.testRunsService.runScheduledForOrg(ctx.orgId);
  }
}
