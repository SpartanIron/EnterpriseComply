import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { controlsTable, risksTable, assetsTable, findingsTable, attackPathsTable, evidenceTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { GetPostureSummaryResponse, GetPostureTrendResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/posture/summary", async (req, res): Promise<void> => {
  const [controlStats] = await db
    .select({
      effective: sql<number>`count(*) filter (where ${controlsTable.status} = 'effective')`,
      degraded: sql<number>`count(*) filter (where ${controlsTable.status} = 'degraded')`,
      failed: sql<number>`count(*) filter (where ${controlsTable.status} = 'failed')`,
      total: sql<number>`count(*)`,
    })
    .from(controlsTable);

  const [criticalFindings] = await db
    .select({ count: sql<number>`count(*)` })
    .from(findingsTable)
    .where(sql`${findingsTable.severity} = 'critical' and ${findingsTable.status} = 'open'`);

  const [activeAttackPaths] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attackPathsTable)
    .where(eq(attackPathsTable.active, true));

  const [assetsAtRisk] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assetsTable)
    .where(sql`${assetsTable.riskLevel} in ('critical', 'high')`);

  const [evidenceStats] = await db
    .select({
      fresh: sql<number>`count(*) filter (where ${evidenceTable.freshness} = 'fresh')`,
      total: sql<number>`count(*)`,
    })
    .from(evidenceTable);

  const effective = Number(controlStats.effective);
  const degraded = Number(controlStats.degraded);
  const failed = Number(controlStats.failed);
  const total = Number(controlStats.total);

  const overallScore = total > 0
    ? Math.round(((effective * 1.0 + degraded * 0.5) / total) * 100)
    : 0;

  const freshTotal = Number(evidenceStats.total);
  const evidenceFreshness = freshTotal > 0
    ? Math.round((Number(evidenceStats.fresh) / freshTotal) * 100)
    : 100;

  const summary = {
    overallScore,
    scoreChange: 3.2,
    controlsEffective: effective,
    controlsDegraded: degraded,
    controlsFailed: failed,
    controlsTotal: total,
    criticalFindings: Number(criticalFindings.count),
    activeAttackPaths: Number(activeAttackPaths.count),
    assetsAtRisk: Number(assetsAtRisk.count),
    evidenceFreshness,
    lastUpdated: new Date().toISOString(),
  };

  res.json(GetPostureSummaryResponse.parse(summary));
});

router.get("/posture/trend", async (req, res): Promise<void> => {
  const trend = [
    { date: "2025-11-01", score: 61, criticalFindings: 18 },
    { date: "2025-12-01", score: 65, criticalFindings: 14 },
    { date: "2026-01-01", score: 68, criticalFindings: 12 },
    { date: "2026-02-01", score: 71, criticalFindings: 10 },
    { date: "2026-03-01", score: 74, criticalFindings: 8 },
    { date: "2026-04-01", score: 72, criticalFindings: 9 },
    { date: "2026-05-01", score: 76, criticalFindings: 7 },
  ];

  res.json(GetPostureTrendResponse.parse(trend));
});

export default router;
