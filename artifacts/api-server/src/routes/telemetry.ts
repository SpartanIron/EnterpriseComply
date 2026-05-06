import { Router, type IRouter } from "express";
import { db, telemetrySourcesTable, telemetryEventsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  ListTelemetryEventsQueryParams,
  ListTelemetryEventsResponse,
  GetTelemetrySourcesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/telemetry/sources", async (req, res): Promise<void> => {
  const rows = await db.select().from(telemetrySourcesTable);
  res.json(
    GetTelemetrySourcesResponse.parse(
      rows.map(r => ({
        ...r,
        id: String(r.id),
        lastEvent: r.lastEvent.toISOString(),
      }))
    )
  );
});

router.get("/telemetry/events", async (req, res): Promise<void> => {
  const parsed = ListTelemetryEventsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 50 };

  const rows = await db
    .select()
    .from(telemetryEventsTable)
    .where(params.source ? eq(telemetryEventsTable.source, params.source) : undefined)
    .limit(params.limit ?? 50)
    .orderBy(desc(telemetryEventsTable.timestamp));

  res.json(
    ListTelemetryEventsResponse.parse(
      rows.map(r => ({
        ...r,
        id: String(r.id),
        timestamp: r.timestamp.toISOString(),
        asset: r.asset ?? undefined,
      }))
    )
  );
});

export default router;
