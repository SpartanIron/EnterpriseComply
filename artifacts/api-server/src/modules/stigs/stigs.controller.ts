import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { StigsService } from "./stigs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

// STIG checklists require the 'federal' plan (P1-07).
// STIGs (Security Technical Implementation Guides) are DoD-mandated hardening baselines.
@Controller("orgs/:orgId/stigs")
@UseGuards(OrgContextGuard, RequirePlan("federal"))
export class StigsController {
  constructor(private readonly stigsService: StigsService) {}

  @Get()
  getChecklists(@OrgContext() ctx: OrgCtx) {
    return this.stigsService.getChecklists(ctx.orgId);
  }

  @Post()
  @UseGuards(RequireRole("compliance_manager"))
  createChecklist(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.stigsService.createChecklist(ctx.orgId, body);
  }

  @Delete(":id")
  @UseGuards(RequireRole("compliance_manager"))
  deleteChecklist(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.stigsService.deleteChecklist(ctx.orgId, Number(id));
  }

  @Get(":id/findings")
  getFindings(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.stigsService.getFindings(ctx.orgId, Number(id));
  }

  @Post(":id/findings/bulk")
  @UseGuards(RequireRole("compliance_manager"))
  bulkCreateFindings(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: { findings: Record<string, unknown>[] },
  ) {
    return this.stigsService.bulkCreateFindings(ctx.orgId, Number(id), body.findings ?? []);
  }

  @Patch("findings/:findingId")
  @UseGuards(RequireRole("compliance_manager"))
  updateFinding(
    @OrgContext() ctx: OrgCtx,
    @Param("findingId") findingId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.stigsService.updateFinding(ctx.orgId, Number(findingId), body);
  }
}
