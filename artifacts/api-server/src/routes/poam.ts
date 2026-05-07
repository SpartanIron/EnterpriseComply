import { Router } from "express";
import { db, orgPoamItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/orgs/:orgId/poam", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const items = await db.query.orgPoamItemsTable.findMany({
      where: eq(orgPoamItemsTable.orgId, req.orgId!),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json({ items });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/poam", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [item] = await db.insert(orgPoamItemsTable).values({ orgId: req.orgId!, ...req.body }).returning();
    res.json({ item });
  } catch (err) { next(err); }
});

router.patch("/orgs/:orgId/poam/:id", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [item] = await db.update(orgPoamItemsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(orgPoamItemsTable.id, Number(req.params.id)), eq(orgPoamItemsTable.orgId, req.orgId!)))
      .returning();
    res.json({ item });
  } catch (err) { next(err); }
});

export default router;
