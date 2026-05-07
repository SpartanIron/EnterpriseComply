import { Controller, Get, Post, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { AuditsService } from "./audits.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get("orgs/:orgId/audits")
  @UseGuards(OrgContextGuard)
  getEngagements(@OrgContext() ctx: OrgCtx) {
    return this.auditsService.getEngagements(ctx.orgId);
  }

  @Post("orgs/:orgId/audits")
  @UseGuards(OrgContextGuard)
  createEngagement(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.auditsService.createEngagement(ctx.orgId, userId, body);
  }

  @Patch("orgs/:orgId/audits/:id/close")
  @UseGuards(OrgContextGuard)
  closeEngagement(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.auditsService.closeEngagement(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/audits/:id/requests")
  @UseGuards(OrgContextGuard)
  getEvidenceRequests(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.auditsService.getEvidenceRequests(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/audits/:id/requests")
  @UseGuards(OrgContextGuard)
  createEvidenceRequest(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: any) {
    return this.auditsService.createEvidenceRequest(ctx.orgId, Number(id), body);
  }

  @Patch("orgs/:orgId/audits/requests/:requestId")
  @UseGuards(OrgContextGuard)
  updateEvidenceRequest(@OrgContext() ctx: OrgCtx, @Param("requestId") requestId: string, @Body() body: any) {
    return this.auditsService.updateEvidenceRequest(ctx.orgId, Number(requestId), body);
  }

  @Get("orgs/:orgId/audits/:id/export")
  @UseGuards(OrgContextGuard)
  exportPackage(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.auditsService.exportPackage(ctx.orgId, Number(id));
  }

  @Get("audit-portal/:token")
  getPublicEngagement(@Param("token") token: string) {
    return this.auditsService.getPublicEngagement(token);
  }
}
