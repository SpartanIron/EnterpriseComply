import { Controller, Get, UseGuards } from "@nestjs/common";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import {
  catalogInconsistencies,
  computePosture,
  coverageWarnings,
  diffPosture,
  legacyArithmeticNotes,
} from "../../lib/posture";
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

    return {
      posture,
      // Two facts a reader needs beside these numbers or the numbers get
      // misread. Neither is drift and neither is a defect: coverage says how
      // much of each published control set the mappings actually reach, and
      // the catalog note says where a framework label and its control content
      // name different revisions.
      coverageWarnings: coverageWarnings(posture),
      catalogInconsistencies: catalogInconsistencies(posture),
    };
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

      /**
       * Thirteen headline items became zero. Nine of them were defects and
       * were fixed. The other four were never defects, so they are reported
       * here rather than counted as fixes or buried inside a zero:
       *
       *   legacyArithmeticNotes   what the dashboard would still be computing
       *                           if it were doing its own arithmetic. Nothing
       *                           serves it after the cutover, so a permanent
       *                           difference is a historical fact.
       *   coverageWarnings        the mappings reach part of each published
       *                           control set. A data limitation, not a fault,
       *                           and shipping code will not take it to zero.
       *   catalogInconsistencies  a framework whose label and control content
       *                           name different revisions. Reconciling them is
       *                           a control-content decision, so it is
       *                           surfaced rather than guessed.
       *
       * divergenceCount is the only one of the four groups a healthy system
       * has to hold at zero.
       */
      separatelyReported: {
        headline: {
          divergenceCount: divergences.length,
          historicalHeadlineCount: 13,
          defectsRemediated: 9,
          nonDefectItems: 4,
          note:
            "A divergence count of zero does not mean thirteen defects were " +
            "fixed. Nine were defects. The other four are retired legacy " +
            "arithmetic and data-coverage facts, reported in the groups below.",
        },
        legacyArithmeticNotes: legacyArithmeticNotes(posture),
        coverageWarnings: coverageWarnings(posture),
        catalogInconsistencies: catalogInconsistencies(posture),
      },
    };
  }
}
