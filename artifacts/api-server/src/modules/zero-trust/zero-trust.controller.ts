import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from "@nestjs/common";
import { ZeroTrustService } from "./zero-trust.service";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { OrgContextGuard } from "../../guards/org-context.guard";

@Controller("orgs/:orgId/zero-trust")
@UseGuards(ClerkAuthGuard, OrgContextGuard)
export class ZeroTrustController {
  constructor(private readonly ztaService: ZeroTrustService) {}

  // GET /orgs/:orgId/zero-trust
  // Returns current ZTA assessment with pillar scores, function scores, gap findings
  @Get()
  async getAssessment(@Param("orgId") orgId: string) {
    return this.ztaService.getAssessment(Number(orgId));
  }

  // POST /orgs/:orgId/zero-trust/score
  // Triggers re-scoring from live UCO control results
  @Post("score")
  async score(@Param("orgId") orgId: string, @Req() req: any) {
    const clerkUserId = req.auth?.userId ?? "system";
    return this.ztaService.score(Number(orgId), clerkUserId);
  }

  // GET /orgs/:orgId/zero-trust/trend?days=90
  // Returns score history snapshots for trend analysis
  @Get("trend")
  async getTrend(@Param("orgId") orgId: string, @Query("days") days?: string) {
    return this.ztaService.getTrend(Number(orgId), days ? Number(days) : 90);
  }

  // GET /orgs/:orgId/zero-trust/gaps
  // Returns all open gap findings for this org
  @Get("gaps")
  async getGaps(@Param("orgId") orgId: string) {
    return this.ztaService.getGapFindings(Number(orgId));
  }

  // GET /orgs/:orgId/zero-trust/crosswalk
  // Returns ZTMM v2.0 -> NIST 800-53 Rev 5 -> UCO three-way crosswalk table
  @Get("crosswalk")
  async getCrosswalk(@Param("orgId") orgId: string) {
    return this.ztaService.getCrosswalk();
  }

  // POST /orgs/:orgId/zero-trust/weights
  // Update per-pillar weights for agency-specific scoring
  @Post("weights")
  async updateWeights(@Param("orgId") orgId: string, @Body() body: { weights: Record<string, number> }) {
    return this.ztaService.updateWeights(Number(orgId), body.weights);
  }
}
