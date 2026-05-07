import { Router } from "express";
import { db, organizationsTable, orgMembersTable, orgFrameworksTable, orgControlResultsTable, orgIntegrationsTable, ucoControlsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth, requireOrg, type AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/orgs/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.clerkUserId, req.clerkUserId!),
    });
    if (!member) return res.json({ org: null });

    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, member.orgId),
    });
    res.json({ org, member });
  } catch (err) { next(err); }
});

router.post("/orgs", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { name, industry, size, website } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [org] = await db.insert(organizationsTable).values({
      name, slug, industry, size, website, onboardingStep: 2,
    }).returning();

    await db.insert(orgMembersTable).values({
      orgId: org.id, clerkUserId: req.clerkUserId!, email: req.body.email || "",
      firstName: req.body.firstName, lastName: req.body.lastName, role: "owner",
    });

    res.json({ org });
  } catch (err) { next(err); }
});

router.patch("/orgs/:orgId/onboarding", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const { step, complete } = req.body;
    const [org] = await db.update(organizationsTable)
      .set({ onboardingStep: step, onboardingComplete: complete ?? false })
      .where(eq(organizationsTable.id, req.orgId!))
      .returning();
    res.json({ org });
  } catch (err) { next(err); }
});

router.get("/orgs/:orgId/dashboard", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const orgId = req.orgId!;
    const frameworks = await db.query.orgFrameworksTable.findMany({
      where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
    });
    const controls = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const integrations = await db.query.orgIntegrationsTable.findMany({
      where: and(eq(orgIntegrationsTable.orgId, orgId)),
    });
    const connected = integrations.filter(i => i.status === "connected");

    const passing = controls.filter(c => c.status === "passing").length;
    const failing = controls.filter(c => c.status === "failing").length;
    const total = controls.length;
    const overallScore = total > 0 ? Math.round((passing / total) * 100) : 0;

    res.json({
      org: req.org,
      overallScore,
      frameworks,
      controlSummary: { passing, failing, notTested: total - passing - failing, total },
      connectedIntegrations: connected.length,
      recentActivity: [],
    });
  } catch (err) { next(err); }
});

export default router;
