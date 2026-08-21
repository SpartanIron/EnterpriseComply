import { Controller, Get, UseGuards } from "@nestjs/common";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { computePosture, diffPosture } from "../../lib/posture";
import { getPostureDriftReport, recordPostureDrift } from "../../lib/posture-drift";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

/**
 * Phase 1 - read-only posture endpoints.
 *
 * GET /orgs/:orgId/posture         the single source of truth
 * GET /orgs/:orgId/posture/drift   how far the legacy surfaces have wandered
 *
 * Nothing here writes. During shadow mode no page reads these either - they
 * exist so the divergence between old and new is a thing you can look at
 * before anything is cut over to depend on it.
 *
 * Both routes are tenant-scoped by OrgContextGuard. The drift route is
 * additionally admin-or-above: it reports which of the product's own numbers
 * are wrong and why, which is operator diagnostics rather than customer
 * reporting, and a viewer has no reason to see it.
 */
@Controller()
export class PostureController {
  @Get("orgs/:orgId/posture")
  @UseGuards(OrgContextGuard)
  async getPosture(@OrgContext() ctx: OrgCtx) {
    const posture = await computePosture(ctx.orgId);

    // Reading the SSOT is itself a shadow observation: it recomputes the legacy
    // figures from the same snapshot, so recording here costs nothing extra and
    // means the drift report fills up from real traffic.
    recordPostureDrift(posture);

    return { posture };
  }

  @Get("orgs/:orgId/posture/drift")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  async getDrift(@OrgContext() ctx: OrgCtx) {
    const posture = await computePosture(ctx.orgId);
    const divergences = recordPostureDrift(posture);

    return {
      // Current is the live comparison; history is what this process has seen.
      current: {
        computedAt: posture.computedAt,
        schema: posture.schema,
        divergenceCount: divergences.length,
        divergences: divergences.length > 0 ? divergences : diffPosture(posture),
        unrecognisedStatuses: posture.unrecognisedStatuses,
        orphanedResults: posture.orphanedResults,
      },
      history: getPostureDriftReport(ctx.orgId),
      // The two numbers a reader most often wants side by side, spelled out so
      // nobody has to reconstruct which denominator produced which figure.
      summary: {
        ssot: {
          total: posture.counts.total,
          passing: posture.counts.passing,
          warning: posture.counts.warning,
          failing: posture.counts.failing,
          notTested: posture.counts.notTested,
          scorePercent: posture.scorePercent,
          coveragePercent: posture.coveragePercent,
        },
        legacyDashboard: posture.legacyDashboard,
      },
    };
  }
}
