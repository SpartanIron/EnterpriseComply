import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { RisksService } from "./risks.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Get("orgs/:orgId/risks")
  @UseGuards(OrgContextGuard)
  getRisks(@OrgContext() ctx: OrgCtx) {
    return this.risksService.getRisks(ctx.orgId);
  }

  @Post("orgs/:orgId/risks")
  @UseGuards(OrgContextGuard)
  createRisk(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.risksService.createRisk(ctx.orgId, userId, body);
  }

  @Patch("orgs/:orgId/risks/:id")
  @UseGuards(OrgContextGuard)
  updateRisk(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: any) {
    return this.risksService.updateRisk(ctx.orgId, Number(id), body);
  }

  @Delete("orgs/:orgId/risks/:id")
  @UseGuards(OrgContextGuard)
  deleteRisk(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.risksService.deleteRisk(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/risks/suggestions")
  @UseGuards(OrgContextGuard)
  suggestRisks(@OrgContext() ctx: OrgCtx) {
    return this.risksService.suggestRisksFromControls(ctx.orgId);
  }

  @Post("orgs/:orgId/risks/import-suggestions")
  @UseGuards(OrgContextGuard)
  importSuggestions(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: { controlIds: string[] }) {
    return this.risksService.importRiskSuggestions(ctx.orgId, userId, body.controlIds ?? []);
  }
}
