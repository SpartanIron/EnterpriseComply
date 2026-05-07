import { Router } from "express";
import { db, orgFrameworksTable, ucoFrameworkMappingsTable, orgControlResultsTable, ucoControlsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireOrg, type AuthRequest } from "../middlewares/auth";

const FRAMEWORK_CATALOG = [
  { key: "soc2", name: "SOC 2 Type II", shortName: "SOC 2", category: "commercial", controlCount: 64, description: "AICPA trust services criteria for security, availability, and confidentiality." },
  { key: "iso27001", name: "ISO/IEC 27001:2022", shortName: "ISO 27001", category: "commercial", controlCount: 93, description: "International standard for information security management systems." },
  { key: "hipaa", name: "HIPAA Security Rule", shortName: "HIPAA", category: "commercial", controlCount: 42, description: "U.S. federal law protecting health information privacy and security." },
  { key: "pci-dss", name: "PCI DSS v4.0", shortName: "PCI DSS", category: "commercial", controlCount: 78, description: "Payment card industry data security standard." },
  { key: "gdpr", name: "EU GDPR", shortName: "GDPR", category: "commercial", controlCount: 39, description: "European Union General Data Protection Regulation." },
  { key: "dora", name: "EU DORA", shortName: "DORA", category: "commercial", controlCount: 47, description: "Digital Operational Resilience Act for financial entities." },
  { key: "sox", name: "SOX ITGC", shortName: "SOX", category: "commercial", controlCount: 36, description: "Sarbanes-Oxley IT General Controls for public companies." },
  { key: "ccpa", name: "CCPA", shortName: "CCPA", category: "commercial", controlCount: 28, description: "California Consumer Privacy Act." },
  { key: "fedramp", name: "FedRAMP Moderate", shortName: "FedRAMP", category: "federal", controlCount: 325, description: "U.S. federal cloud security authorization program." },
  { key: "cmmc-l2", name: "CMMC Level 2", shortName: "CMMC L2", category: "federal", controlCount: 110, description: "Cybersecurity Maturity Model Certification for DoD contractors." },
  { key: "nist-800-53", name: "NIST SP 800-53 Rev 5", shortName: "NIST 800-53", category: "federal", controlCount: 389, description: "Security and privacy controls for federal information systems." },
  { key: "cis-controls", name: "CIS Controls v8", shortName: "CIS Controls", category: "best-practice", controlCount: 153, description: "Center for Internet Security prioritized security actions." },
];

const router = Router();

router.get("/frameworks/catalog", async (_req, res) => {
  res.json({ frameworks: FRAMEWORK_CATALOG });
});

router.get("/orgs/:orgId/frameworks", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const frameworks = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, req.orgId!),
    });
    res.json({ frameworks });
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/frameworks", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const { frameworkKeys } = req.body as { frameworkKeys: string[] };
    const orgId = req.orgId!;

    const existing = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    const existingKeys = new Set(existing.map(f => f.frameworkKey));

    const toInsert = frameworkKeys
      .filter(k => !existingKeys.has(k))
      .map(key => {
        const cat = FRAMEWORK_CATALOG.find(f => f.key === key);
        return {
          orgId, frameworkKey: key,
          name: cat?.name ?? key,
          shortName: cat?.shortName ?? key,
          category: cat?.category ?? "commercial",
          totalControls: cat?.controlCount ?? 0,
        };
      });

    if (toInsert.length > 0) {
      await db.insert(orgFrameworksTable).values(toInsert);
    }

    const frameworks = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    res.json({ frameworks });
  } catch (err) { next(err); }
});

router.get("/orgs/:orgId/frameworks/:key/controls", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const { key } = req.params;
    const mappings = await db.query.ucoFrameworkMappingsTable.findMany({
      where: eq(ucoFrameworkMappingsTable.frameworkKey, key),
    });

    const ucoIds = [...new Set(mappings.map(m => m.ucoControlId))];
    const [ucoControls, controlResults] = await Promise.all([
      db.query.ucoControlsTable.findMany({ where: ucoIds.length ? inArray(ucoControlsTable.controlId, ucoIds) : undefined }),
      db.query.orgControlResultsTable.findMany({ where: and(eq(orgControlResultsTable.orgId, req.orgId!), ucoIds.length ? inArray(orgControlResultsTable.ucoControlId, ucoIds) : undefined) }),
    ]);

    const resultMap = new Map(controlResults.map(r => [r.ucoControlId, r]));
    const ucoMap = new Map(ucoControls.map(c => [c.controlId, c]));

    const controls = mappings.map(m => ({
      ...m,
      ucoControl: ucoMap.get(m.ucoControlId),
      result: resultMap.get(m.ucoControlId) ?? { status: "not_tested" },
    }));

    const passing = controls.filter(c => c.result.status === "passing").length;
    const failing = controls.filter(c => c.result.status === "failing").length;
    const score = controls.length > 0 ? Math.round((passing / controls.length) * 100) : 0;

    res.json({ controls, score, passing, failing, notTested: controls.length - passing - failing, total: controls.length });
  } catch (err) { next(err); }
});

export default router;
