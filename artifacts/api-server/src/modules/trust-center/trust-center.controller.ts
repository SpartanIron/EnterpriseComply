import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { TrustCenterService } from "./trust-center.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class TrustCenterController {
  constructor(private readonly trustCenterService: TrustCenterService) {}

  @Get("trust/:slug")
  getPublicProfile(@Param("slug") slug: string) {
    return this.trustCenterService.getPublicProfile(slug);
  }

  @Get("orgs/:orgId/trust-center")
  @UseGuards(OrgContextGuard)
  getTrustSettings(@OrgContext() ctx: OrgCtx) {
    return this.trustCenterService.getOrgTrustSettings(ctx.orgId);
  }
}
