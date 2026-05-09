import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from "@nestjs/common";
import { RemediationService } from "./remediation.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class RemediationController {
  constructor(private readonly remediationService: RemediationService) {}

  @Get("orgs/:orgId/remediation")
  @UseGuards(OrgContextGuard)
  list(
    @OrgContext() ctx: OrgCtx,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("controlId") controlId?: string,
  ) {
    return this.remediationService.list(ctx.orgId, { status, priority, controlId });
  }

  @Get("orgs/:orgId/remediation/:id")
  @UseGuards(OrgContextGuard)
  getById(@OrgContext() ctx: OrgCtx, @Param("id", ParseIntPipe) id: number) {
    return this.remediationService.getById(ctx.orgId, id);
  }

  @Post("orgs/:orgId/remediation")
  @UseGuards(OrgContextGuard)
  create(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: Record<string, unknown>) {
    return this.remediationService.create(ctx.orgId, userId, body as any);
  }

  @Post("orgs/:orgId/remediation/bulk-from-gap-analysis")
  @UseGuards(OrgContextGuard)
  bulkCreate(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: { items: any[] }) {
    return this.remediationService.bulkCreateFromGapAnalysis(ctx.orgId, userId, body.items ?? []);
  }

  @Patch("orgs/:orgId/remediation/:id")
  @UseGuards(OrgContextGuard)
  update(
    @OrgContext() ctx: OrgCtx,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.remediationService.update(ctx.orgId, id, body as any);
  }

  @Post("orgs/:orgId/remediation/:id/retest")
  @UseGuards(OrgContextGuard)
  reTest(@OrgContext() ctx: OrgCtx, @Param("id", ParseIntPipe) id: number) {
    return this.remediationService.reTest(ctx.orgId, id);
  }

  @Delete("orgs/:orgId/remediation/:id")
  @UseGuards(OrgContextGuard)
  delete(@OrgContext() ctx: OrgCtx, @Param("id", ParseIntPipe) id: number) {
    return this.remediationService.delete(ctx.orgId, id);
  }
}
