import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, orgFrameworksTable, organizationsTable, ucoControlsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class SspService {
  async generateSsp(orgId: number, body: {
    systemName: string; systemDescription: string; systemOwner: string;
    systemOwnerEmail: string; dataClassification: string; operationalStatus: string;
    systemType: string; cloudProvider?: string; frameworkKey: string;
    authorizationBoundary?: string; networkDescription?: string;
  }) {
    const [org, frameworks, controls, results] = await Promise.all([
      db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) }),
      db.query.orgFrameworksTable.findMany({ where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.frameworkKey, body.frameworkKey)) }),
      db.query.ucoControlsTable.findMany(),
      db.query.orgControlResultsTable.findMany({ where: eq(orgControlResultsTable.orgId, orgId) }),
    ]);

    const resultMap = new Map(results.map((r) => [r.ucoControlId, r]));
    const now = new Date();

    const controlSections = controls.map((c) => {
      const result = resultMap.get(c.controlId);
      return {
        controlId: c.controlId,
        title: c.name,
        domain: c.domain,
        description: c.description,
        objective: c.objective,
        implementationStatus: result?.status === "passing" ? "Implemented" : result?.status === "failing" ? "Planned" : "Not Implemented",
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
      framework: body.frameworkKey.toUpperCase(),
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
    const ssp = sspData as ReturnType<typeof this.generateSsp> extends Promise<{ ssp: infer T }> ? T : never;
    let text = `SYSTEM SECURITY PLAN\n`;
    text += `${"=".repeat(60)}\n\n`;
    text += `System Name: ${(ssp as any).system?.name}\n`;
    text += `Organization: ${(ssp as any).system?.organization}\n`;
    text += `Generated: ${(ssp as any).generatedAt}\n`;
    text += `Framework: ${(ssp as any).framework}\n\n`;
    text += `COMPLIANCE SUMMARY\n${"-".repeat(40)}\n`;
    const cs = (ssp as any).complianceSummary;
    text += `Total Controls: ${cs?.totalControls}\n`;
    text += `Implemented: ${cs?.implemented}\n`;
    text += `Planned: ${cs?.planned}\n`;
    text += `Not Implemented: ${cs?.notImplemented}\n\n`;
    text += `CONTROL IMPLEMENTATIONS\n${"-".repeat(40)}\n`;
    for (const c of (ssp as any).controlSections ?? []) {
      text += `\n${c.controlId} - ${c.title}\n`;
      text += `Status: ${c.implementationStatus}\n`;
      text += `Statement: ${c.implementationStatement}\n`;
    }
    return { text, filename: `SSP_${(ssp as any).framework}_${new Date().toISOString().split("T")[0]}.txt` };
  }
}
