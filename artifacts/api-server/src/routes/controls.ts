import { Router } from "express";
import { db, ucoControlsTable, orgControlResultsTable, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/controls/uco", requireAuth, async (_req, res, next) => {
  try {
    const controls = await db.query.ucoControlsTable.findMany({
      orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
    });
    res.json({ controls });
  } catch (err) { next(err); }
});

router.get("/orgs/:orgId/controls", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [controls, results] = await Promise.all([
      db.query.ucoControlsTable.findMany({ orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)] }),
      db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, req.orgId!) }),
    ]);

    const resultMap = new Map(results.map(r => [r.ucoControlId, r]));
    const enriched = controls.map(c => ({
      ...c,
      result: resultMap.get(c.controlId) ?? { status: "not_tested", ucoControlId: c.controlId },
    }));

    res.json({ controls: enriched });
  } catch (err) { next(err); }
});

router.patch("/orgs/:orgId/controls/:controlId/result", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const { controlId } = req.params;
    const { status, remediationNotes } = req.body;
    const orgId = req.orgId!;

    const existing = await db.query.orgControlResultsTable.findFirst({
      where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, controlId)),
    });

    let result;
    if (existing) {
      [result] = await db.update(orgControlResultsTable)
        .set({ status, remediationNotes, manualOverride: true, manualOverrideBy: req.clerkUserId, lastTestedAt: new Date() })
        .where(and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, controlId)))
        .returning();
    } else {
      [result] = await db.insert(orgControlResultsTable).values({
        orgId, ucoControlId: controlId, status, remediationNotes,
        manualOverride: true, manualOverrideBy: req.clerkUserId, lastTestedAt: new Date(),
      }).returning();
    }

    await updateFrameworkScores(orgId, controlId);
    res.json({ result });
  } catch (err) { next(err); }
});

async function updateFrameworkScores(orgId: number, ucoControlId: string) {
  try {
    const { orgFrameworksTable, orgControlResultsTable: ocr } = await import("@workspace/db");
    const { db: database } = await import("@workspace/db");
    const { eq: eq2 } = await import("drizzle-orm");

    const frameworks = await database.query.orgFrameworksTable.findMany({ where: eq2(orgFrameworksTable.orgId, orgId) });
    for (const fw of frameworks) {
      const mappings = await database.query.ucoFrameworkMappingsTable.findMany({ where: eq2(ucoFrameworkMappingsTable.frameworkKey, fw.frameworkKey) });
      const ucoIds = [...new Set(mappings.map(m => m.ucoControlId))];
      const results = await database.query.orgControlResultsTable.findMany({ where: eq2(ocr.orgId, orgId) });
      const resultMap = new Map(results.map(r => [r.ucoControlId, r.status]));
      const passing = ucoIds.filter(id => resultMap.get(id) === "passing").length;
      const failing = ucoIds.filter(id => resultMap.get(id) === "failing").length;
      const score = ucoIds.length > 0 ? Math.round((passing / ucoIds.length) * 100) : 0;
      await database.update(orgFrameworksTable)
        .set({ complianceScore: score, passingControls: passing, failingControls: failing, notTestedControls: ucoIds.length - passing - failing })
        .where(eq2(orgFrameworksTable.id, fw.id));
    }
  } catch (_) {}
}

export default router;
