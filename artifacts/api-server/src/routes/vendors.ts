import { Router } from "express";
import { db, orgVendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/orgs/:orgId/vendors", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const vendors = await db.query.orgVendorsTable.findMany({ where: eq(orgVendorsTable.orgId, req.orgId!) });
    res.json({ vendors });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/vendors", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [vendor] = await db.insert(orgVendorsTable).values({ orgId: req.orgId!, ...req.body }).returning();
    res.json({ vendor });
  } catch (err) { next(err); }
});

export default router;
