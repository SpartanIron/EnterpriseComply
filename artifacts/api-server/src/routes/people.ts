import { Router } from "express";
import { db, orgPeopleTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/orgs/:orgId/people", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const people = await db.query.orgPeopleTable.findMany({ where: eq(orgPeopleTable.orgId, req.orgId!) });
    res.json({ people });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/people", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [person] = await db.insert(orgPeopleTable).values({ orgId: req.orgId!, ...req.body }).returning();
    res.json({ person });
  } catch (err) { next(err); }
});

export default router;
