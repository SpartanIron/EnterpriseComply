import { Controller, Get, UseGuards } from "@nestjs/common";
import { SprsService } from "./sprs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class SprsController {
  constructor(private readonly sprsService: SprsService) {}

  // SPRS score tracking is a DoD-required federal feature (DFARS 252.204-7019). (P1-07)
  @Get("orgs/:orgId/sprs")
  @UseGuards(OrgContextGuard, RequirePlan("federal"))
  calculate(@OrgContext() ctx: OrgCtx) {
    return this.sprsService.calculate(ctx.orgId);
  }
}
