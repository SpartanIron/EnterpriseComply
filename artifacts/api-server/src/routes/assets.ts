import { Router, type IRouter } from "express";
import { db, assetsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import {
  ListAssetsQueryParams,
  ListAssetsResponse,
  GetAssetsSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/assets", async (req, res): Promise<void> => {
  const parsed = ListAssetsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 50 };

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.type) conditions.push(eq(assetsTable.type, params.type));
  if (params.risk_level) conditions.push(eq(assetsTable.riskLevel, params.risk_level));

  const rows = await db
    .select()
    .from(assetsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 50);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assetsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(
    ListAssetsResponse.parse({
      assets: rows.map(r => ({ ...r, id: String(r.id), lastSeen: r.lastSeen.toISOString() })),
      total: Number(count),
    })
  );
});

router.get("/assets/summary", async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      critical: sql<number>`count(*) filter (where ${assetsTable.riskLevel} = 'critical')`,
      high: sql<number>`count(*) filter (where ${assetsTable.riskLevel} = 'high')`,
      medium: sql<number>`count(*) filter (where ${assetsTable.riskLevel} = 'medium')`,
      low: sql<number>`count(*) filter (where ${assetsTable.riskLevel} = 'low')`,
      crownJewels: sql<number>`count(*) filter (where ${assetsTable.crownJewel} = true)`,
      internetExposed: sql<number>`count(*) filter (where ${assetsTable.internetExposed} = true)`,
      server: sql<number>`count(*) filter (where ${assetsTable.type} = 'server')`,
      cloud: sql<number>`count(*) filter (where ${assetsTable.type} = 'cloud')`,
      endpoint: sql<number>`count(*) filter (where ${assetsTable.type} = 'endpoint')`,
      identity: sql<number>`count(*) filter (where ${assetsTable.type} = 'identity')`,
      network: sql<number>`count(*) filter (where ${assetsTable.type} = 'network')`,
      container: sql<number>`count(*) filter (where ${assetsTable.type} = 'container')`,
      database: sql<number>`count(*) filter (where ${assetsTable.type} = 'database')`,
    })
    .from(assetsTable);

  res.json(
    GetAssetsSummaryResponse.parse({
      total: Number(stats.total),
      byType: {
        server: Number(stats.server),
        cloud: Number(stats.cloud),
        endpoint: Number(stats.endpoint),
        identity: Number(stats.identity),
        network: Number(stats.network),
        container: Number(stats.container),
        database: Number(stats.database),
      },
      byRisk: {
        critical: Number(stats.critical),
        high: Number(stats.high),
        medium: Number(stats.medium),
        low: Number(stats.low),
      },
      crownJewels: Number(stats.crownJewels),
      internetExposed: Number(stats.internetExposed),
      unmanaged: 0,
    })
  );
});

export default router;
