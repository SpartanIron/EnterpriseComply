import { Router, type IRouter } from "express";
import { db, graphNodesTable, graphEdgesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetGraphNodesQueryParams,
  GetGraphNodesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/graph/nodes", async (req, res): Promise<void> => {
  const parsed = GetGraphNodesQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : {};

  const nodes = await db
    .select()
    .from(graphNodesTable)
    .where(params.type ? eq(graphNodesTable.type, params.type) : undefined)
    .limit(100);

  const edges = await db.select().from(graphEdgesTable).limit(200);

  res.json(
    GetGraphNodesResponse.parse({
      nodes: nodes.map(n => ({
        id: n.nodeId,
        label: n.label,
        type: n.type,
        risk: n.risk,
        x: n.x ?? undefined,
        y: n.y ?? undefined,
        metadata: n.metadata ?? undefined,
      })),
      edges: edges.map(e => ({
        id: e.edgeId,
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
      })),
    })
  );
});

export default router;
