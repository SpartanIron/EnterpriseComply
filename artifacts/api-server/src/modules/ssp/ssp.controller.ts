import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SspService } from "./ssp.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

// SSP generation requires the 'federal' plan (P1-07).
// System Security Plans are required for FedRAMP and CMMC Level 2 compliance.
@Controller()
@UseGuards(OrgContextGuard, RequirePlan("federal"))
export class SspController {
  constructor(private readonly sspService: SspService) {}

  @Post("orgs/:orgId/ssp/generate")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  generateSsp(@OrgContext() ctx: OrgCtx, @Body() body: any) {
    return this.sspService.generateSsp(ctx.orgId, body);
  }

  @Post("orgs/:orgId/ssp/export-text")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  exportText(@OrgContext() ctx: OrgCtx, @Body() body: { ssp: Record<string, unknown> }) {
    return this.sspService.exportText(ctx.orgId, body.ssp);
  }
}
