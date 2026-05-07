import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { EvidenceService } from "./evidence.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/evidence")
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @UseGuards(OrgContextGuard)
  getEvidence(@OrgContext() ctx: OrgCtx) {
    return this.evidenceService.getEvidence(ctx.orgId);
  }

  @Post()
  @UseGuards(OrgContextGuard)
  addEvidence(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: Record<string, string>,
  ) {
    return this.evidenceService.addEvidence(ctx.orgId, userId, body);
  }
}
