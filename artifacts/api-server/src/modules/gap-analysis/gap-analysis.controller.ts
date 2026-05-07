import { Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GapAnalysisService } from "./gap-analysis.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; }

@Controller()
export class GapAnalysisController {
  constructor(private readonly gapAnalysisService: GapAnalysisService) {}

  @Post("orgs/:orgId/gap-analysis")
  @UseGuards(OrgContextGuard)
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  analyze(@OrgContext() ctx: OrgCtx) {
    return this.gapAnalysisService.analyze(ctx.orgId);
  }
}
