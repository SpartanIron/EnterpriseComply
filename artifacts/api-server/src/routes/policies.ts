import { Router } from "express";
import { db, orgPoliciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOrg, type AuthRequest } from "../middlewares/auth";

const POLICY_TEMPLATES = [
  { key: "acceptable-use", title: "Acceptable Use Policy", category: "security", description: "Defines acceptable use of company systems and data." },
  { key: "access-control", title: "Access Control Policy", category: "security", description: "Governs how access to systems is granted, managed, and revoked." },
  { key: "incident-response", title: "Incident Response Policy", category: "security", description: "Procedures for detecting, reporting, and responding to security incidents." },
  { key: "data-classification", title: "Data Classification Policy", category: "data", description: "Framework for categorizing and handling data by sensitivity." },
  { key: "change-management", title: "Change Management Policy", category: "operations", description: "Process for managing changes to production systems and infrastructure." },
  { key: "vendor-management", title: "Vendor Management Policy", category: "risk", description: "Requirements for assessing and managing third-party vendor risk." },
  { key: "business-continuity", title: "Business Continuity Plan", category: "risk", description: "Plans for maintaining operations during and after disruptive events." },
  { key: "password-policy", title: "Password Policy", category: "security", description: "Requirements for password complexity, rotation, and storage." },
  { key: "remote-work", title: "Remote Work Security Policy", category: "security", description: "Security requirements for remote and distributed workforce." },
  { key: "vulnerability-management", title: "Vulnerability Management Policy", category: "security", description: "Process for identifying, prioritizing, and remediating vulnerabilities." },
];

const router = Router();

router.get("/policies/templates", async (_req, res) => {
  res.json({ templates: POLICY_TEMPLATES });
});

router.get("/orgs/:orgId/policies", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const policies = await db.query.orgPoliciesTable.findMany({ where: eq(orgPoliciesTable.orgId, req.orgId!) });
    res.json({ policies });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/policies", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const [policy] = await db.insert(orgPoliciesTable).values({ orgId: req.orgId!, ...req.body }).returning();
    res.json({ policy });
  } catch (err) { next(err); }
});

export default router;
