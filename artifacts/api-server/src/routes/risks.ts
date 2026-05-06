import { Router, type IRouter } from "express";
import { db, risksTable, attackPathsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import {
  ListRisksQueryParams,
  ListRisksResponse,
  ListAttackPathsResponse,
  GetExposureSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/risks", async (req, res): Promise<void> => {
  const parsed = ListRisksQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 20 };

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.severity) conditions.push(eq(risksTable.severity, params.severity));

  const rows = await db
    .select()
    .from(risksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 20)
    .orderBy(sql`${risksTable.score} desc`);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(risksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(
    ListRisksResponse.parse({
      risks: rows.map(r => ({
        ...r,
        id: String(r.id),
        identifiedAt: r.identifiedAt.toISOString(),
        threatIntelligence: r.threatIntelligence ?? undefined,
      })),
      total: Number(count),
    })
  );
});

router.get("/risks/attack-paths", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(attackPathsTable)
    .where(eq(attackPathsTable.active, true))
    .orderBy(sql`${attackPathsTable.likelihood} desc`);

  res.json(
    ListAttackPathsResponse.parse(
      rows.map(r => ({ ...r, id: String(r.id) }))
    )
  );
});

router.get("/risks/exposure-summary", async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      total: sql<number>`sum(${risksTable.score})`,
      critical: sql<number>`count(*) filter (where ${risksTable.severity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${risksTable.severity} = 'high')`,
      medium: sql<number>`count(*) filter (where ${risksTable.severity} = 'medium')`,
      low: sql<number>`count(*) filter (where ${risksTable.severity} = 'low')`,
    })
    .from(risksTable);

  const [pathStats] = await db
    .select({
      privEsc: sql<number>`count(*) filter (where 'Privilege Escalation' = ANY(${risksTable.attackVectors}))`,
      lateral: sql<number>`count(*) filter (where 'Lateral Movement' = ANY(${risksTable.attackVectors}))`,
    })
    .from(risksTable);

  res.json(
    GetExposureSummaryResponse.parse({
      totalRiskScore: Number(stats.total ?? 0),
      criticalRisks: Number(stats.critical),
      highRisks: Number(stats.high),
      mediumRisks: Number(stats.medium),
      lowRisks: Number(stats.low),
      identityRisk: 73.4,
      networkExposure: 41.2,
      privilegeEscalationPaths: Number(pathStats.privEsc),
      lateralMovementPaths: Number(pathStats.lateral),
    })
  );
});

export default router;
