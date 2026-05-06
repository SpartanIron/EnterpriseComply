import { Router, type IRouter } from "express";
import { db, frameworksTable, controlsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ListFrameworksResponse,
  GetFrameworkComplianceResponse,
  GetComplianceOverviewResponse,
  GetFrameworkComplianceParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/frameworks", async (req, res): Promise<void> => {
  const rows = await db.select().from(frameworksTable);
  res.json(ListFrameworksResponse.parse(rows.map(r => ({
    id: String(r.id),
    name: r.name,
    shortName: r.shortName,
    version: r.version,
    type: r.type,
    active: r.active,
    controlCount: r.controlCount,
    complianceScore: r.complianceScore,
    status: r.status,
  }))));
});

router.get("/frameworks/compliance-overview", async (req, res): Promise<void> => {
  const rows = await db.select().from(frameworksTable).where(eq(frameworksTable.active, true));
  const overview = rows.map(r => ({
    frameworkId: String(r.id),
    shortName: r.shortName,
    score: r.complianceScore,
    status: r.status,
    trend: r.complianceScore >= 75 ? "up" : r.complianceScore >= 50 ? "stable" : "down",
  }));
  res.json(GetComplianceOverviewResponse.parse(overview));
});

router.get("/frameworks/:frameworkId/compliance", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.frameworkId) ? req.params.frameworkId[0] : req.params.frameworkId;
  const [framework] = await db
    .select()
    .from(frameworksTable)
    .where(eq(frameworksTable.id, parseInt(raw, 10)));

  if (!framework) {
    res.status(404).json({ error: "Framework not found" });
    return;
  }

  const passing = Math.round(framework.controlCount * (framework.complianceScore / 100));
  const failing = framework.controlCount - passing;

  res.json(
    GetFrameworkComplianceResponse.parse({
      frameworkId: String(framework.id),
      score: framework.complianceScore,
      controlsMapped: framework.controlCount,
      controlsPassing: passing,
      controlsFailing: failing,
      gaps: ["Privileged access review", "Encryption key rotation", "Audit log retention"],
      lastAssessed: framework.updatedAt?.toISOString() ?? new Date().toISOString(),
    })
  );
});

export default router;
