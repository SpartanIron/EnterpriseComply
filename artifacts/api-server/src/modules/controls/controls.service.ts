import { Injectable, Logger } from "@nestjs/common";
import {
  db,
  ucoControlsTable,
  orgControlResultsTable,
  orgFrameworksTable,
  ucoFrameworkMappingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computePosture, syncStoredFrameworkPosture } from "../../lib/posture";

@Injectable()
export class ControlsService {
  private readonly logger = new Logger(ControlsService.name);

  async getUcoControls() {
    const controls = await db.query.ucoControlsTable.findMany({
      orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
    });
    return { controls };
  }

  async getOrgControls(orgId: number) {
    const [controls, results, posture] = await Promise.all([
      db.query.ucoControlsTable.findMany({
        orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
      }),
      db.query.orgControlResultsTable.findMany({
        where: eq(orgControlResultsTable.orgId, orgId),
      }),
      // The page used to tally these counts itself, in the browser, and its
      // tally had no warning bucket - so five controls existed in the list,
      // were absent from every header figure, and could not be filtered for.
      // Serving the SSOT counts means the page renders a number rather than
      // deciding one.
      computePosture(orgId).catch((err) => {
        this.logger.error(
          "[controls] posture computation failed, summary will be degraded: " + String(err),
        );
        return null;
      }),
    ]);

    const resultMap = new Map(results.map((r) => [r.ucoControlId, r]));
    const enriched = controls.map((c) => ({
      ...c,
      result: resultMap.get(c.controlId) ?? { status: "not_tested", ucoControlId: c.controlId },
    }));

    // Fallback only, reached when computePosture threw. It counts the same four
    // statuses rather than three, so even the degraded path cannot lose the
    // warning bucket again.
    const degraded = posture === null;
    const tally = (status: string) =>
      enriched.filter((c) => (c.result?.status ?? "not_tested") === status).length;

    const counts = posture
      ? posture.counts
      : {
          passing: tally("passing"),
          warning: tally("warning"),
          failing: tally("failing"),
          notTested: tally("not_tested"),
          assessed: tally("passing") + tally("warning") + tally("failing"),
          total: enriched.length,
        };

    return {
      controls: enriched,
      summary: {
        source: degraded ? "controls-endpoint-fallback" : "posture-ssot",
        counts,
        degraded,
        note:
          "passing + warning + failing + notTested equals total. Warning is a " +
          "status in its own right, not a shade of passing and not a shade of " +
          "not-tested.",
      },
    };
  }

  async patchControlResult(
    orgId: number,
    controlId: string,
    clerkUserId: string,
    body: { status?: string; remediationNotes?: string; ownerName?: string; dueDate?: string },
  ) {
    const { status, remediationNotes, ownerName, dueDate } = body;

    const existing = await db.query.orgControlResultsTable.findFirst({
      where: and(
        eq(orgControlResultsTable.orgId, orgId),
        eq(orgControlResultsTable.ucoControlId, controlId),
      ),
    });

    const updateFields: Record<string, unknown> = {
      manualOverride: true,
      manualOverrideBy: clerkUserId,
      lastTestedAt: new Date(),
    };
    if (status !== undefined) updateFields.status = status;
    if (remediationNotes !== undefined) updateFields.remediationNotes = remediationNotes;
    if (ownerName !== undefined) updateFields.ownerName = ownerName;
    if (dueDate !== undefined) updateFields.dueDate = dueDate ? new Date(dueDate) : null;

    let result;
    if (existing) {
      [result] = await db
        .update(orgControlResultsTable)
        .set(updateFields as any)
        .where(and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, controlId)))
        .returning();
    } else {
      [result] = await db.insert(orgControlResultsTable).values({
        orgId,
        ucoControlId: controlId,
        status: status ?? "not_tested",
        remediationNotes,
        ownerName,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        manualOverride: true,
        manualOverrideBy: clerkUserId,
        lastTestedAt: new Date(),
      } as any).returning();
    }

    // Phase 1b. Was updateFrameworkScores(), which did its own arithmetic over
    // the mapping table, folded every warning into notTested, and wrapped the
    // whole body in catch (_) {} so a failure to refresh was invisible. It now
    // caches what the SSOT computed, and it reports rather than swallows.
    const sync = await syncStoredFrameworkPosture(orgId);
    if (sync.failed > 0) {
      this.logger.warn(
        "Stored framework posture refresh failed for " + sync.failed +
          " framework row(s) on org " + orgId +
          ". The posture endpoint is unaffected; the cached columns are stale.",
      );
    }
    return { result };
  }

  async getFrameworkImpact(orgId: number, controlId: string) {
    const [mappings, activeFrameworks] = await Promise.all([
      db.query.ucoFrameworkMappingsTable.findMany({
        where: eq(ucoFrameworkMappingsTable.ucoControlId, controlId),
      }),
      db.query.orgFrameworksTable.findMany({
        where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
      }),
    ]);

    const activeKeys = new Set(activeFrameworks.map((f) => f.frameworkKey));
    const grouped: Record<string, { frameworkKey: string; frameworkName: string; isActive: boolean; requirements: { controlId: string; name: string; confidence: number }[] }> = {};

    for (const m of mappings) {
      if (!grouped[m.frameworkKey]) {
        const fw = activeFrameworks.find((f) => f.frameworkKey === m.frameworkKey);
        grouped[m.frameworkKey] = {
          frameworkKey: m.frameworkKey,
          frameworkName: fw?.name ?? m.frameworkKey,
          isActive: activeKeys.has(m.frameworkKey),
          requirements: [],
        };
      }
      grouped[m.frameworkKey].requirements.push({
        controlId: m.frameworkControlId,
        name: m.frameworkControlName,
        confidence: m.mappingConfidence,
      });
    }

    const impact = Object.values(grouped).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
    return { impact, totalFrameworks: impact.length, activeFrameworks: impact.filter((i) => i.isActive).length };
  }
}
