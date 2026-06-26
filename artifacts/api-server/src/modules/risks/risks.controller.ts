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

  @Post("orgs/:orgId/risks/bulk-delete")
  @UseGuards(OrgContextGuard)
  bulkDeleteRisks(@OrgContext() ctx: OrgCtx, @Body() body: { ids: number[] }) {
    return this.risksService.bulkDeleteRisks(ctx.orgId, body.ids ?? []);
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
  @Get("orgs/:orgId/compliance-calendar")
  @UseGuards(OrgContextGuard)
  async getComplianceCalendar(@OrgContext() ctx: OrgCtx) {
    return this.risksService.getComplianceCalendar(ctx.orgId);
  }

  @Post("orgs/:orgId/compliance-calendar")
  @UseGuards(OrgContextGuard)
  async createCalendarEvent(@OrgContext() ctx: OrgCtx, @Body() body: any) {
    return this.risksService.createCalendarEvent(ctx.orgId, body);
  }

  @Patch("orgs/:orgId/compliance-calendar/:eventId")
  @UseGuards(OrgContextGuard)
  async updateCalendarEvent(@OrgContext() ctx: OrgCtx, @Param("eventId") eventId: string, @Body() body: any) {
    return this.risksService.updateCalendarEvent(ctx.orgId, parseInt(eventId), body);
  }

  @Get("orgs/:orgId/sub-processors")
  @UseGuards(OrgContextGuard)
  async getSubProcessors(@OrgContext() ctx: OrgCtx) {
    return this.risksService.getSubProcessors(ctx.orgId);
  }

}
