import { Router } from "express";
import { db, orgEvidenceTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/orgs/:orgId/evidence", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const items = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, req.orgId!),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
    });
    res.json({ evidence: items });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/evidence", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const { ucoControlId, title, description, type, url, filename } = req.body;
    const [item] = await db.insert(orgEvidenceTable).values({
      orgId: req.orgId!, ucoControlId, title, description, type: type ?? "document",
      source: "manual", url, filename, uploadedBy: req.clerkUserId, collectedAt: new Date(),
    }).returning();
    res.json({ evidence: item });
  } catch (err) { next(err); }
});

export default router;
