import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseIntPipe } from "@nestjs/common";
import { EvidenceService } from "./evidence.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/evidence")
@UseGuards(OrgContextGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  getEvidence(@OrgContext() ctx: OrgCtx) {
    return this.evidenceService.getEvidence(ctx.orgId);
  }

  @Post()
  @UseGuards(RequireRole("analyst"))
  addEvidence(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.evidenceService.addEvidence(ctx.orgId, userId, body as any);
  }

  /** Phase 3A: verify SHA-256 integrity of a stored evidence snapshot */
  @Get(":id/verify")
  verifyIntegrity(
    @OrgContext() ctx: OrgCtx,
    @Param("id", ParseIntPipe) evidenceId: number,
  ) {
    return this.evidenceService.verifyEvidenceIntegrity(ctx.orgId, evidenceId);
  }

  @Delete(":id")
  @UseGuards(RequireRole("compliance_manager"))
  deleteEvidence(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("id", ParseIntPipe) evidenceId: number,
  ) {
    return this.evidenceService.deleteEvidence(ctx.orgId, evidenceId, userId);
  }
}
