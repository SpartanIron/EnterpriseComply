import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { SspService } from "./ssp.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class SspController {
  constructor(private readonly sspService: SspService) {}

  @Post("orgs/:orgId/ssp/generate")
  @UseGuards(OrgContextGuard)
  generateSsp(@OrgContext() ctx: OrgCtx, @Body() body: any) {
    return this.sspService.generateSsp(ctx.orgId, body);
  }

  @Post("orgs/:orgId/ssp/export-text")
  @UseGuards(OrgContextGuard)
  exportText(@OrgContext() ctx: OrgCtx, @Body() body: { ssp: Record<string, unknown> }) {
    return this.sspService.exportText(ctx.orgId, body.ssp);
  }
}
