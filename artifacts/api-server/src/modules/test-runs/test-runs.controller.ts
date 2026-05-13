import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { TestRunsService } from "./test-runs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

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
  @UseGuards(OrgContextGuard)
  triggerTestRuns(@OrgContext() ctx: OrgCtx) {
    return this.testRunsService.triggerTestRuns(ctx.orgId);
  }
}
