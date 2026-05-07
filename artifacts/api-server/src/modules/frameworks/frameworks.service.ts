import { Injectable, NotFoundException } from "@nestjs/common";
import { db, orgFrameworksTable, ucoFrameworkMappingsTable, orgControlResultsTable, ucoControlsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export const FRAMEWORK_CATALOG = [
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
  { key: "nist-csf", name: "NIST CSF 2.0", shortName: "NIST CSF", category: "best-practice", controlCount: 106, description: "NIST Cybersecurity Framework - the most widely adopted voluntary security framework worldwide." },
  { key: "hitrust", name: "HITRUST CSF v11", shortName: "HITRUST", category: "commercial", controlCount: 156, description: "Healthcare industry trust framework covering HIPAA, ISO 27001, and NIST in a single certification." },
  { key: "nist-800-171", name: "NIST SP 800-171 Rev 3", shortName: "NIST 800-171", category: "federal", controlCount: 110, description: "Protecting Controlled Unclassified Information (CUI) in non-federal systems. Required for DoD contractors." },
  { key: "stateramp", name: "StateRAMP", shortName: "StateRAMP", category: "federal", controlCount: 148, description: "State-level cloud security authorization program - the FedRAMP equivalent for state and local government." },
  { key: "nycrr-500", name: "23 NYCRR 500", shortName: "NYCRR 500", category: "commercial", controlCount: 44, description: "New York State cybersecurity regulation for financial services companies. Mandatory for NY-regulated entities." },
  { key: "iso27701", name: "ISO/IEC 27701:2019", shortName: "ISO 27701", category: "commercial", controlCount: 114, description: "Privacy Information Management System (PIMS) - extension to ISO 27001 covering GDPR and CCPA requirements." },
  { key: "fedramp-high", name: "FedRAMP High", shortName: "FedRAMP High", category: "federal", controlCount: 421, description: "FedRAMP authorization for systems processing sensitive federal data. Highest impact level." },
  { key: "fedramp-low", name: "FedRAMP Low", shortName: "FedRAMP Low", category: "federal", controlCount: 125, description: "FedRAMP authorization for systems with low risk to federal operations. Entry-level authorization." },
  { key: "nist-ai-rmf", name: "NIST AI RMF 1.0", shortName: "NIST AI RMF", category: "best-practice", controlCount: 72, description: "NIST AI Risk Management Framework - governs trustworthy AI system development and deployment." },
  { key: "cyber-essentials", name: "UK Cyber Essentials Plus", shortName: "Cyber Essentials", category: "commercial", controlCount: 56, description: "UK government-backed certification required for government contracts. Covers 5 technical control areas." },
  { key: "cmmc-l1", name: "CMMC Level 1", shortName: "CMMC L1", category: "federal", controlCount: 17, description: "Basic cyber hygiene - 17 practices required of ALL DoD contractors handling Federal Contract Information." },
];

@Injectable()
export class FrameworksService {
  getCatalog() {
    return { frameworks: FRAMEWORK_CATALOG };
  }

  async getOrgFrameworks(orgId: number) {
    const frameworks = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    return { frameworks };
  }

  async addFrameworks(orgId: number, frameworkKeys: string[]) {
    const existing = await db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    const existingKeys = new Set(existing.map((f) => f.frameworkKey));

    const toInsert = frameworkKeys
      .filter((k) => !existingKeys.has(k))
      .map((key) => {
        const cat = FRAMEWORK_CATALOG.find((f) => f.key === key);
        return {
          orgId,
          frameworkKey: key,
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
    return { frameworks };
  }

  async removeFramework(orgId: number, key: string) {
    const existing = await db.query.orgFrameworksTable.findFirst({
      where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.frameworkKey, key)),
    });
    if (!existing) throw new NotFoundException(`Framework "${key}" not found for this org`);
    await db
      .delete(orgFrameworksTable)
      .where(and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.frameworkKey, key)));
    return { success: true, removed: key };
  }

  async getFrameworkControls(orgId: number, key: string) {
    const mappings = await db.query.ucoFrameworkMappingsTable.findMany({
      where: eq(ucoFrameworkMappingsTable.frameworkKey, key),
    });

    const ucoIds = [...new Set(mappings.map((m) => m.ucoControlId))];
    const [ucoControls, controlResults] = await Promise.all([
      db.query.ucoControlsTable.findMany({
        where: ucoIds.length ? inArray(ucoControlsTable.controlId, ucoIds) : undefined,
      }),
      db.query.orgControlResultsTable.findMany({
        where: and(
          eq(orgControlResultsTable.orgId, orgId),
          ucoIds.length ? inArray(orgControlResultsTable.ucoControlId, ucoIds) : undefined,
        ),
      }),
    ]);

    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));
    const ucoMap = new Map(ucoControls.map((c) => [c.controlId, c]));

    const controls = mappings.map((m) => ({
      ...m,
      ucoControl: ucoMap.get(m.ucoControlId),
      result: resultMap.get(m.ucoControlId) ?? { status: "not_tested" },
    }));

    const passing = controls.filter((c) => c.result.status === "passing").length;
    const failing = controls.filter((c) => c.result.status === "failing").length;
    const score = controls.length > 0 ? Math.round((passing / controls.length) * 100) : 0;

    return {
      controls,
      score,
      passing,
      failing,
      notTested: controls.length - passing - failing,
      total: controls.length,
    };
  }
}
