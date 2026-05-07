import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, orgFrameworksTable, organizationsTable, ucoControlsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const FEDERAL_FRAMEWORKS = new Set(["fedramp", "nist-800-53", "cmmc-l2"]);

function overallImpact(c: string, i: string, a: string): string {
  const rank: Record<string, number> = { Low: 1, Moderate: 2, High: 3 };
  const max = Math.max(rank[c] ?? 2, rank[i] ?? 2, rank[a] ?? 1);
  return Object.keys(rank).find((k) => rank[k] === max) ?? "Moderate";
}

// Domains typically inherited from cloud service providers for cloud-based systems
const CLOUD_INHERITED_DOMAINS = new Set([
  "Physical Security",
  "Physical and Environmental Protection",
  "Media Protection",
  "Environmental Controls",
]);

// Domains that are hybrid (shared responsibility with CSP)
const CLOUD_HYBRID_DOMAINS = new Set([
  "Configuration Management",
  "System and Communications Protection",
  "Identification and Authentication",
]);

@Injectable()
export class SspService {
  async generateSsp(orgId: number, body: {
    systemName: string; systemDescription: string; systemOwner: string;
    systemOwnerEmail: string; dataClassification: string; operationalStatus: string;
    systemType: string; cloudProvider?: string; frameworkKey: string;
    authorizationBoundary?: string; networkDescription?: string;
    // Federal / FedRAMP fields
    authorizingOfficialName?: string; authorizingOfficialTitle?: string;
    fips199Confidentiality?: string; fips199Integrity?: string; fips199Availability?: string;
    applicableLaws?: string[];
    // Environment fields
    userTypesDescription?: string; portsProtocolsServices?: string;
    cryptographicModules?: string; externalConnections?: string;
  }) {
    const [org, , controls, results] = await Promise.all([
      db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) }),
      db.query.orgFrameworksTable.findMany({ where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.frameworkKey, body.frameworkKey)) }),
      db.query.ucoControlsTable.findMany(),
      db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) }),
    ]);

    const resultMap = new Map(results.map((r) => [r.ucoControlId, r]));
    const now = new Date();
    const isFederal = FEDERAL_FRAMEWORKS.has(body.frameworkKey);
    const isCloud = body.systemType === "Cloud-Based" || body.systemType === "Hybrid";

    const controlSections = controls.map((c) => {
      const result = resultMap.get(c.controlId);

      // Determine origination based on system type and domain
      let origination = "System Specific";
      if (isCloud) {
        if (CLOUD_INHERITED_DOMAINS.has(c.domain)) {
          origination = `Inherited (${body.cloudProvider ?? "Cloud Service Provider"})`;
        } else if (CLOUD_HYBRID_DOMAINS.has(c.domain)) {
          origination = "Hybrid";
        }
      }

      return {
        controlId: c.controlId,
        title: c.name,
        domain: c.domain,
        description: c.description,
        objective: c.objective,
        origination,
        implementationStatus: result?.status === "passing"
          ? "Implemented"
          : result?.status === "failing"
            ? "Planned"
            : "Not Implemented",
        implementationStatement: result?.status === "passing"
          ? `${c.name} has been implemented and verified through automated testing. ${result.result ?? ""}`
          : result?.remediationNotes
            ? `Implementation in progress: ${result.remediationNotes}`
            : `This control is planned for implementation as part of the organization's compliance roadmap.`,
        lastTested: result?.lastTestedAt?.toISOString() ?? null,
        testResult: result?.result ?? null,
      };
    });

    const ssp = {
      generatedAt: now.toISOString(),
      version: "1.0",
      framework: body.frameworkKey,
      system: {
        name: body.systemName,
        description: body.systemDescription,
        owner: body.systemOwner,
        ownerEmail: body.systemOwnerEmail,
        organization: org?.name ?? "",
        dataClassification: body.dataClassification,
        operationalStatus: body.operationalStatus,
        systemType: body.systemType,
        cloudProvider: body.cloudProvider,
        authorizationBoundary: body.authorizationBoundary ?? "Cloud-hosted SaaS application deployed on commercial cloud infrastructure.",
        networkDescription: body.networkDescription ?? "The system communicates over HTTPS/TLS 1.2+ for all external connections.",
        lastUpdated: now.toISOString(),
        // Federal fields
        ...(isFederal && {
          authorizingOfficialName: body.authorizingOfficialName,
          authorizingOfficialTitle: body.authorizingOfficialTitle,
          fips199Confidentiality: body.fips199Confidentiality ?? "Moderate",
          fips199Integrity: body.fips199Integrity ?? "Moderate",
          fips199Availability: body.fips199Availability ?? "Low",
          overallImpactLevel: overallImpact(
            body.fips199Confidentiality ?? "Moderate",
            body.fips199Integrity ?? "Moderate",
            body.fips199Availability ?? "Low",
          ),
          applicableLaws: body.applicableLaws ?? [],
        }),
        // Environment fields
        userTypesDescription: body.userTypesDescription,
        portsProtocolsServices: body.portsProtocolsServices,
        ...(isFederal && { cryptographicModules: body.cryptographicModules }),
        externalConnections: body.externalConnections,
      },
      complianceSummary: {
        totalControls: controlSections.length,
        implemented: controlSections.filter((c) => c.implementationStatus === "Implemented").length,
        planned: controlSections.filter((c) => c.implementationStatus === "Planned").length,
        notImplemented: controlSections.filter((c) => c.implementationStatus === "Not Implemented").length,
      },
      controlSections,
      exportFormats: ["pdf"],
    };

    return { ssp };
  }

  async exportText(orgId: number, sspData: Record<string, unknown>) {
    const ssp = sspData as any;
    let text = `SYSTEM SECURITY PLAN\n`;
    text += `${"=".repeat(60)}\n\n`;
    text += `System Name: ${ssp.system?.name}\n`;
    text += `Organization: ${ssp.system?.organization}\n`;
    text += `Generated: ${ssp.generatedAt}\n`;
    text += `Framework: ${ssp.framework}\n\n`;
    text += `COMPLIANCE SUMMARY\n${"-".repeat(40)}\n`;
    const cs = ssp.complianceSummary;
    text += `Total Controls: ${cs?.totalControls}\n`;
    text += `Implemented: ${cs?.implemented}\n`;
    text += `Planned: ${cs?.planned}\n`;
    text += `Not Implemented: ${cs?.notImplemented}\n\n`;
    text += `CONTROL IMPLEMENTATIONS\n${"-".repeat(40)}\n`;
    for (const c of ssp.controlSections ?? []) {
      text += `\n${c.controlId} - ${c.title}\n`;
      text += `Status: ${c.implementationStatus}\n`;
      text += `Origination: ${c.origination}\n`;
      text += `Statement: ${c.implementationStatement}\n`;
    }
    return { text, filename: `SSP_${ssp.framework?.toUpperCase()}_${new Date().toISOString().split("T")[0]}.txt` };
  }
}
