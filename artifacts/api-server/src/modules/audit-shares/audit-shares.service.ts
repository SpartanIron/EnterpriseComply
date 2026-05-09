import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  db,
  orgAuditSharesTable,
  orgFrameworksTable,
  orgControlResultsTable,
  ucoControlsTable,
  orgEvidenceTable,
  orgPoliciesTable,
  organizationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class AuditSharesService {
  // ── Create a new auditor share link ─────────────────────────────────────────
  async create(orgId: number, clerkUserId: string, body: {
    auditorName?: string;
    auditorEmail?: string;
    auditorFirm?: string;
    frameworkKeys?: string[];
    includeEvidence?: boolean;
    includeTestResults?: boolean;
    includePolicies?: boolean;
    includePoam?: boolean;
    expiryDays?: number;
    maxAccesses?: number;
  }) {
    const shareToken = randomBytes(32).toString("hex");
    const expiryDays = body.expiryDays ?? 30;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const [share] = await db.insert(orgAuditSharesTable).values({
      orgId,
      shareToken,
      auditorName: body.auditorName,
      auditorEmail: body.auditorEmail,
      auditorFirm: body.auditorFirm,
      frameworkKeys: body.frameworkKeys ?? [],
      includeEvidence: body.includeEvidence ?? true,
      includeTestResults: body.includeTestResults ?? true,
      includePolicies: body.includePolicies ?? true,
      includePoam: body.includePoam ?? false,
      expiresAt,
      maxAccesses: body.maxAccesses,
      createdBy: clerkUserId,
    } as any).returning();
    return {
      share,
      shareUrl: `/audit/${shareToken}`,
    };
  }

  // ── List all active shares for an org ────────────────────────────────────────
  async list(orgId: number) {
    const shares = await db.query.orgAuditSharesTable.findMany({
      where: eq(orgAuditSharesTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return { shares };
  }

  // ── Revoke a share ────────────────────────────────────────────────────────────
  async revoke(orgId: number, id: number, clerkUserId: string) {
    const share = await db.query.orgAuditSharesTable.findFirst({
      where: and(eq(orgAuditSharesTable.orgId, orgId), eq(orgAuditSharesTable.id, id)),
    });
    if (!share) throw new NotFoundException("Audit share not found");
    await db.update(orgAuditSharesTable)
      .set({ isActive: false, revokedAt: new Date(), revokedBy: clerkUserId } as any)
      .where(eq(orgAuditSharesTable.id, id));
    return { success: true };
  }

  // ── Read the audit package via public share token ─────────────────────────────
  async getAuditPackage(shareToken: string, ipAddress?: string) {
    const share = await db.query.orgAuditSharesTable.findFirst({
      where: eq(orgAuditSharesTable.shareToken, shareToken),
    });
    if (!share) throw new NotFoundException("Audit share not found");
    if (!share.isActive) throw new ForbiddenException("This audit share has been revoked");
    if (share.expiresAt < new Date()) throw new ForbiddenException("This audit share has expired");
    if (share.maxAccesses && share.accessCount >= share.maxAccesses) {
      throw new ForbiddenException("Maximum access limit reached for this audit share");
    }

    // Record access
    await db.update(orgAuditSharesTable)
      .set({
        accessCount: (share.accessCount ?? 0) + 1,
        lastAccessedAt: new Date(),
        lastAccessedIp: ipAddress ?? null,
      } as any)
      .where(eq(orgAuditSharesTable.id, share.id));

    const orgId = share.orgId;

    // Fetch org info
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, orgId),
    });

    // Fetch frameworks in scope
    let frameworksQuery = db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    });
    const allFrameworks = await frameworksQuery;
    const frameworks = share.frameworkKeys?.length
      ? allFrameworks.filter((f) => share.frameworkKeys!.includes(f.frameworkKey))
      : allFrameworks.filter((f) => f.active);

    // Fetch controls
    const allControls = await db.query.ucoControlsTable.findMany();
    const controlResults = share.includeTestResults
      ? await db.query.orgControlResultsTable.findMany({
          where: eq(orgControlResultsTable.orgId, orgId),
        })
      : [];
    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));
    const passing = controlResults.filter((r) => r.status === "passing").length;
    const failing = controlResults.filter((r) => r.status === "failing").length;
    const overallScore = controlResults.length > 0 ? Math.round((passing / controlResults.length) * 100) : 0;

    // Build scoped control list
    const scopedControls = allControls.map((c) => {
      const result = resultMap.get(c.controlId);
      return {
        controlId: c.controlId,
        name: c.name,
        domain: c.domain,
        description: c.description,
        status: result?.status ?? "not_tested",
        ...(share.includeTestResults && result ? {
          lastTestedAt: result.lastTestedAt,
          result: result.result,
          integrationKey: result.integrationKey,
        } : {}),
      };
    });

    // Fetch evidence
    const evidence = share.includeEvidence
      ? await db.query.orgEvidenceTable.findMany({
          where: eq(orgEvidenceTable.orgId, orgId),
          orderBy: (t, { desc }) => [desc(t.collectedAt)],
        })
      : [];

    // Fetch policies
    const policies = share.includePolicies
      ? await db.query.orgPoliciesTable.findMany({
          where: and(eq(orgPoliciesTable.orgId, orgId), eq(orgPoliciesTable.status, "published")),
        })
      : [];

    return {
      auditPackage: {
        organization: {
          name: org?.name ?? "Organization",
          industry: org?.industry,
          website: org?.website,
        },
        generatedAt: new Date().toISOString(),
        shareExpiresAt: share.expiresAt.toISOString(),
        auditor: {
          name: share.auditorName,
          email: share.auditorEmail,
          firm: share.auditorFirm,
        },
        complianceSummary: {
          overallScore,
          totalControls: controlResults.length,
          passing,
          failing,
          notTested: controlResults.length - passing - failing,
        },
        frameworks: frameworks.map((f) => ({
          key: f.frameworkKey,
          name: f.name,
          complianceScore: f.complianceScore,
          passingControls: f.passingControls,
          totalControls: f.totalControls,
        })),
        controls: scopedControls,
        evidence: evidence.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          type: e.type,
          source: e.source,
          ucoControlId: e.ucoControlId,
          collectedAt: e.collectedAt,
          expiresAt: e.expiresAt,
        })),
        policies: policies.map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          version: p.version,
          status: p.status,
          publishedAt: p.publishedAt,
        })),
      },
    };
  }
}
