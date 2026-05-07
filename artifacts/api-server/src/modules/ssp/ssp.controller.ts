import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SspService } from "./ssp.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class SspController {
  constructor(private readonly sspService: SspService) {}

  @Post("orgs/:orgId/ssp/generate")
  @UseGuards(OrgContextGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  generateSsp(@OrgContext() ctx: OrgCtx, @Body() body: any) {
    return this.sspService.generateSsp(ctx.orgId, body);
  }

  @Post("orgs/:orgId/ssp/export-text")
  @UseGuards(OrgContextGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  exportText(@OrgContext() ctx: OrgCtx, @Body() body: { ssp: Record<string, unknown> }) {
    return this.sspService.exportText(ctx.orgId, body.ssp);
  }
}
