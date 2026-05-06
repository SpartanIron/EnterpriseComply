import { Router, type IRouter } from "express";
import { db, evidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListEvidenceQueryParams,
  ListEvidenceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/evidence", async (req, res): Promise<void> => {
  const parsed = ListEvidenceQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.control_id) conditions.push(eq(evidenceTable.controlId, params.control_id));
  if (params.freshness) conditions.push(eq(evidenceTable.freshness, params.freshness));

  const rows = await db
    .select()
    .from(evidenceTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(50);

  res.json(
    ListEvidenceResponse.parse(
      rows.map(r => ({
        ...r,
        id: String(r.id),
        collectedAt: r.collectedAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? undefined,
      }))
    )
  );
});

export default router;
