import { Router, type IRouter } from "express";
import { db, findingsTable } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  ListFindingsQueryParams,
  ListFindingsResponse,
  GetRecentFindingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/findings", async (req, res): Promise<void> => {
  const parsed = ListFindingsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 30 };

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.severity) conditions.push(eq(findingsTable.severity, params.severity));
  if (params.status) conditions.push(eq(findingsTable.status, params.status));

  const rows = await db
    .select()
    .from(findingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 30)
    .orderBy(desc(findingsTable.detectedAt));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(findingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(
    ListFindingsResponse.parse({
      findings: rows.map(r => ({
        ...r,
        id: String(r.id),
        detectedAt: r.detectedAt.toISOString(),
        controlId: r.controlId ?? undefined,
        cveId: r.cveId ?? undefined,
        remediationSla: r.remediationSla ?? undefined,
      })),
      total: Number(count),
    })
  );
});

router.get("/findings/recent", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(findingsTable)
    .where(sql`${findingsTable.severity} in ('critical', 'high') and ${findingsTable.status} = 'open'`)
    .orderBy(desc(findingsTable.detectedAt))
    .limit(10);

  res.json(
    GetRecentFindingsResponse.parse(
      rows.map(r => ({
        ...r,
        id: String(r.id),
        detectedAt: r.detectedAt.toISOString(),
        controlId: r.controlId ?? undefined,
        cveId: r.cveId ?? undefined,
        remediationSla: r.remediationSla ?? undefined,
      }))
    )
  );
});

export default router;
