import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { StigsService } from "./stigs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/stigs")
export class StigsController {
  constructor(private readonly stigsService: StigsService) {}

  @Get()
  @UseGuards(OrgContextGuard)
  getChecklists(@OrgContext() ctx: OrgCtx) {
    return this.stigsService.getChecklists(ctx.orgId);
  }

  @Post()
  @UseGuards(OrgContextGuard)
  createChecklist(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.stigsService.createChecklist(ctx.orgId, body);
  }

  @Delete(":id")
  @UseGuards(OrgContextGuard)
  deleteChecklist(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.stigsService.deleteChecklist(ctx.orgId, Number(id));
  }

  @Get(":id/findings")
  @UseGuards(OrgContextGuard)
  getFindings(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.stigsService.getFindings(ctx.orgId, Number(id));
  }

  @Post(":id/findings/bulk")
  @UseGuards(OrgContextGuard)
  bulkCreateFindings(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: { findings: Record<string, unknown>[] },
  ) {
    return this.stigsService.bulkCreateFindings(ctx.orgId, Number(id), body.findings ?? []);
  }

  @Patch("findings/:findingId")
  @UseGuards(OrgContextGuard)
  updateFinding(
    @OrgContext() ctx: OrgCtx,
    @Param("findingId") findingId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.stigsService.updateFinding(ctx.orgId, Number(findingId), body);
  }
}
