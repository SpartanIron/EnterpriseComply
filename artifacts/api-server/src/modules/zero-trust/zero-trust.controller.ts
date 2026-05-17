import { Controller, Get, Post, Body, Param, UseGuards, Query } from "@nestjs/common";
import { ZeroTrustService } from "./zero-trust.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
@UseGuards(OrgContextGuard)
export class ZeroTrustController {
  constructor(private readonly ztaService: ZeroTrustService) {}

  // GET /orgs/:orgId/zero-trust
  // Returns current ZTA assessment with pillar scores, function scores, gap findings
  @Get("orgs/:orgId/zero-trust")
  async getAssessment(@OrgContext() ctx: OrgCtx) {
    return this.ztaService.getAssessment(ctx.orgId);
  }

  // POST /orgs/:orgId/zero-trust/score
  // Triggers re-scoring from live UCO control results
  @Post("orgs/:orgId/zero-trust/score")
  async score(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string) {
    return this.ztaService.score(ctx.orgId, userId);
  }

  // GET /orgs/:orgId/zero-trust/trend?days=90
  // Returns score history snapshots for trend analysis
  @Get("orgs/:orgId/zero-trust/trend")
  async getTrend(@OrgContext() ctx: OrgCtx, @Query("days") days?: string) {
    return this.ztaService.getTrend(ctx.orgId, days ? Number(days) : 90);
  }

  // GET /orgs/:orgId/zero-trust/gaps
  // Returns all open gap findings for this org
  @Get("orgs/:orgId/zero-trust/gaps")
  async getGaps(@OrgContext() ctx: OrgCtx) {
    return this.ztaService.getGapFindings(ctx.orgId);
  }

  // GET /orgs/:orgId/zero-trust/crosswalk
  // Returns ZTMM v2.0 -> NIST 800-53 Rev 5 -> UCO three-way crosswalk table
  @Get("orgs/:orgId/zero-trust/crosswalk")
  async getCrosswalk(@OrgContext() ctx: OrgCtx) {
    return this.ztaService.getCrosswalk();
  }

  // POST /orgs/:orgId/zero-trust/weights
  // Update per-pillar weights for agency-specific scoring
  @Post("orgs/:orgId/zero-trust/weights")
  async updateWeights(@OrgContext() ctx: OrgCtx, @Body() body: { weights: Record<string, number> }) {
    return this.ztaService.updateWeights(ctx.orgId, body.weights);
  }
}
