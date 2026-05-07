import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db, organizationsTable, orgFrameworksTable, orgControlResultsTable,
  orgIntegrationsTable, orgPoliciesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class TrustCenterService {
  async getPublicProfile(slug: string) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.slug, slug),
    });
    if (!org) throw new NotFoundException("Organization not found");

    const [frameworks, controls, integrations, policies] = await Promise.all([
      db.query.orgFrameworksTable.findMany({
        where: and(eq(orgFrameworksTable.orgId, org.id), eq(orgFrameworksTable.active, true)),
      }),
      db.query.orgControlResultsTable.findMany({
        where: eq(orgControlResultsTable.orgId, org.id),
      }),
      db.query.orgIntegrationsTable.findMany({
        where: and(eq(orgIntegrationsTable.orgId, org.id), eq(orgIntegrationsTable.status, "connected" as string)),
      }),
      db.query.orgPoliciesTable.findMany({
        where: and(eq(orgPoliciesTable.orgId, org.id), eq(orgPoliciesTable.status, "published")),
      }),
    ]);

    const passing = controls.filter((c) => c.status === "passing").length;
    const total = controls.length;
    const overallScore = total > 0 ? Math.round((passing / total) * 100) : 0;

    return {
      org: {
        name: org.name,
        slug: org.slug,
        industry: org.industry,
        website: org.website,
      },
      overallScore,
      controlSummary: {
        passing,
        failing: controls.filter((c) => c.status === "failing").length,
        total,
      },
      frameworks: frameworks.map((f) => ({
        key: f.frameworkKey,
        name: f.name,
        shortName: f.shortName,
        complianceScore: f.complianceScore,
        passingControls: f.passingControls,
        totalControls: f.totalControls,
      })),
      integrations: integrations.map((i) => ({
        key: i.integrationKey,
        name: i.name,
        lastSyncAt: i.lastSyncAt,
        status: i.status,
      })),
      publishedPolicies: policies.map((p) => ({
        title: p.title,
        category: p.category,
        version: p.version,
        publishedAt: p.publishedAt,
      })),
      securityHighlights: [
        { label: "Continuous Monitoring", active: integrations.length > 0 },
        { label: "Encrypted in Transit", active: true },
        { label: "Encrypted at Rest", active: true },
        { label: "Annual Penetration Testing", active: frameworks.length > 0 },
        { label: "SOC 2 Audit Program", active: frameworks.some((f) => f.frameworkKey === "soc2") },
        { label: "FedRAMP Authorized", active: frameworks.some((f) => f.frameworkKey === "fedramp") },
        { label: "ISO 27001 Certified", active: frameworks.some((f) => f.frameworkKey === "iso27001") },
        { label: "GDPR Compliant", active: frameworks.some((f) => f.frameworkKey === "gdpr") },
      ].filter((h) => h.active),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getOrgTrustSettings(orgId: number) {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });
    if (!org) throw new NotFoundException("Organization not found");
    return { trustCenterUrl: `/trust/${org.slug}`, slug: org.slug };
  }
}
