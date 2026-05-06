import { Router, type IRouter } from "express";
import { db, controlsTable } from "@workspace/db";
import { eq, sql, ilike, and, inArray } from "drizzle-orm";
import {
  ListControlsQueryParams,
  ListControlsResponse,
  GetControlResponse,
  GetControlsSummaryResponse,
  CreateControlBody,
  UpdateControlBody,
  UpdateControlParams,
  GetControlParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/controls", async (req, res): Promise<void> => {
  const parsed = ListControlsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 50, offset: 0 };

  let query = db.select().from(controlsTable);
  const conditions: ReturnType<typeof eq>[] = [];

  if (params.status) {
    conditions.push(eq(controlsTable.status, params.status));
  }
  if (params.framework) {
    conditions.push(sql`${params.framework} = ANY(${controlsTable.frameworks})`);
  }

  const rows = await db
    .select()
    .from(controlsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(controlsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(ListControlsResponse.parse({ controls: rows.map((r) => ({ ...r, id: String(r.id) })), total: Number(count) }));
});

router.get("/controls/summary", async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      effective: sql<number>`count(*) filter (where ${controlsTable.status} = 'effective')`,
      degraded: sql<number>`count(*) filter (where ${controlsTable.status} = 'degraded')`,
      failed: sql<number>`count(*) filter (where ${controlsTable.status} = 'failed')`,
      unknown: sql<number>`count(*) filter (where ${controlsTable.status} = 'unknown')`,
      inherited: sql<number>`count(*) filter (where ${controlsTable.status} = 'inherited')`,
      compensating: sql<number>`count(*) filter (where ${controlsTable.status} = 'compensating')`,
      total: sql<number>`count(*)`,
      automated: sql<number>`count(*) filter (where ${controlsTable.automationCapability} = 'full')`,
      drift: sql<number>`count(*) filter (where ${controlsTable.driftDetected} = true)`,
    })
    .from(controlsTable);

  res.json(
    GetControlsSummaryResponse.parse({
      effective: Number(stats.effective),
      degraded: Number(stats.degraded),
      failed: Number(stats.failed),
      unknown: Number(stats.unknown),
      inherited: Number(stats.inherited),
      compensating: Number(stats.compensating),
      totalControls: Number(stats.total),
      automatedControls: Number(stats.automated),
      driftCount: Number(stats.drift),
    })
  );
});

router.get("/controls/:controlId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.controlId) ? req.params.controlId[0] : req.params.controlId;
  const [control] = await db
    .select()
    .from(controlsTable)
    .where(eq(controlsTable.id, parseInt(raw, 10)));

  if (!control) {
    res.status(404).json({ error: "Control not found" });
    return;
  }

  res.json(GetControlResponse.parse(control));
});

router.post("/controls", async (req, res): Promise<void> => {
  const parsed = CreateControlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [control] = await db
    .insert(controlsTable)
    .values({
      ...parsed.data,
      status: "unknown",
      effectiveness: 0,
      driftDetected: false,
      evidenceFresh: true,
    })
    .returning();

  res.status(201).json(GetControlResponse.parse(control));
});

router.patch("/controls/:controlId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.controlId) ? req.params.controlId[0] : req.params.controlId;
  const parsed = UpdateControlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [control] = await db
    .update(controlsTable)
    .set(parsed.data)
    .where(eq(controlsTable.id, parseInt(rawId, 10)))
    .returning();

  if (!control) {
    res.status(404).json({ error: "Control not found" });
    return;
  }

  res.json(GetControlResponse.parse(control));
});

export default router;
