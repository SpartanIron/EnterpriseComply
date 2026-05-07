import { Injectable } from "@nestjs/common";
import {
  db,
  ucoControlsTable,
  orgControlResultsTable,
  orgFrameworksTable,
  ucoFrameworkMappingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class ControlsService {
  async getUcoControls() {
    const controls = await db.query.ucoControlsTable.findMany({
      orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
    });
    return { controls };
  }

  async getOrgControls(orgId: number) {
    const [controls, results] = await Promise.all([
      db.query.ucoControlsTable.findMany({
        orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
      }),
      db.query.orgControlResultsTable.findMany({
        where: eq(orgControlResultsTable.orgId, orgId),
      }),
    ]);

    const resultMap = new Map(results.map((r) => [r.ucoControlId, r]));
    const enriched = controls.map((c) => ({
      ...c,
      result: resultMap.get(c.controlId) ?? { status: "not_tested", ucoControlId: c.controlId },
    }));

    return { controls: enriched };
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

    await this.updateFrameworkScores(orgId);
    return { result };
  }

  private async updateFrameworkScores(orgId: number) {
    try {
      const frameworks = await db.query.orgFrameworksTable.findMany({
        where: eq(orgFrameworksTable.orgId, orgId),
      });

      for (const fw of frameworks) {
        const mappings = await db.query.ucoFrameworkMappingsTable.findMany({
          where: eq(ucoFrameworkMappingsTable.frameworkKey, fw.frameworkKey),
        });
        const ucoIds = [...new Set(mappings.map((m) => m.ucoControlId))];
        const results = await db.query.orgControlResultsTable.findMany({
          where: eq(orgControlResultsTable.orgId, orgId),
        });
        const resultMap = new Map(results.map((r) => [r.ucoControlId, r.status]));
        const passing = ucoIds.filter((id) => resultMap.get(id) === "passing").length;
        const failing = ucoIds.filter((id) => resultMap.get(id) === "failing").length;
        const score = ucoIds.length > 0 ? Math.round((passing / ucoIds.length) * 100) : 0;

        await db
          .update(orgFrameworksTable)
          .set({
            complianceScore: score,
            passingControls: passing,
            failingControls: failing,
            notTestedControls: ucoIds.length - passing - failing,
          })
          .where(eq(orgFrameworksTable.id, fw.id));
      }
    } catch (_) {}
  }
}
