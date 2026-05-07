import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db, orgAuditEngagementsTable, orgAuditEvidenceRequestsTable,
  orgEvidenceTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

@Injectable()
export class AuditsService {
  async getEngagements(orgId: number) {
    const engagements = await db.query.orgAuditEngagementsTable.findMany({
      where: eq(orgAuditEngagementsTable.orgId, orgId),
    });
    const enriched = await Promise.all(
      engagements.map(async (e) => {
        const requests = await db.query.orgAuditEvidenceRequestsTable.findMany({
          where: eq(orgAuditEvidenceRequestsTable.engagementId, e.id),
        });
        return {
          ...e,
          accessToken: undefined,
          requestSummary: {
            total: requests.length,
            pending: requests.filter((r) => r.status === "pending").length,
            resolved: requests.filter((r) => r.status === "resolved").length,
            rejected: requests.filter((r) => r.status === "rejected").length,
          },
        };
      }),
    );
    return { engagements: enriched };
  }

  async createEngagement(orgId: number, createdBy: string, body: {
    name: string; frameworkKey: string; auditorFirm?: string;
    auditorName?: string; auditorEmail: string;
    startDate?: string; endDate?: string; notes?: string;
  }) {
    const accessToken = randomBytes(32).toString("hex");
    const [engagement] = await db.insert(orgAuditEngagementsTable).values({
      orgId,
      name: body.name,
      frameworkKey: body.frameworkKey,
      auditorFirm: body.auditorFirm,
      auditorName: body.auditorName,
      auditorEmail: body.auditorEmail,
      accessToken,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      notes: body.notes,
      createdBy,
    }).returning();
    return { engagement: { ...engagement, accessToken } };
  }

  async closeEngagement(orgId: number, engagementId: number) {
    const [engagement] = await db.update(orgAuditEngagementsTable)
      .set({ status: "closed" })
      .where(and(
        eq(orgAuditEngagementsTable.orgId, orgId),
        eq(orgAuditEngagementsTable.id, engagementId),
      ))
      .returning();
    return { engagement };
  }

  async getEvidenceRequests(orgId: number, engagementId: number) {
    const requests = await db.query.orgAuditEvidenceRequestsTable.findMany({
      where: and(
        eq(orgAuditEvidenceRequestsTable.orgId, orgId),
        eq(orgAuditEvidenceRequestsTable.engagementId, engagementId),
      ),
    });
    return { requests };
  }

  async createEvidenceRequest(orgId: number, engagementId: number, body: {
    title: string; description?: string; ucoControlId?: string; dueDate?: string;
  }) {
    const [req] = await db.insert(orgAuditEvidenceRequestsTable).values({
      orgId,
      engagementId,
      title: body.title,
      description: body.description,
      ucoControlId: body.ucoControlId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    }).returning();
    return { request: req };
  }

  async updateEvidenceRequest(orgId: number, requestId: number, body: {
    status?: string; responseNotes?: string; auditorComment?: string;
    linkedEvidenceIds?: number[];
  }) {
    const updates: Record<string, unknown> = { ...body };
    if (body.status === "resolved") updates.resolvedAt = new Date();

    const [req] = await db.update(orgAuditEvidenceRequestsTable)
      .set(updates as Parameters<typeof db.update>[0] extends unknown ? never : never)
      .where(and(
        eq(orgAuditEvidenceRequestsTable.orgId, orgId),
        eq(orgAuditEvidenceRequestsTable.id, requestId),
      ))
      .returning();
    return { request: req };
  }

  async getPublicEngagement(accessToken: string) {
    const engagement = await db.query.orgAuditEngagementsTable.findFirst({
      where: eq(orgAuditEngagementsTable.accessToken, accessToken),
    });
    if (!engagement || engagement.status !== "active") {
      throw new NotFoundException("Engagement not found or inactive");
    }
    const requests = await db.query.orgAuditEvidenceRequestsTable.findMany({
      where: eq(orgAuditEvidenceRequestsTable.engagementId, engagement.id),
    });
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, engagement.orgId),
    });
    return {
      engagement: { ...engagement, accessToken: undefined },
      requests,
      evidence: evidence.map((e) => ({ id: e.id, title: e.title, type: e.type, source: e.source, collectedAt: e.collectedAt })),
    };
  }

  async exportPackage(orgId: number, engagementId: number) {
    const engagement = await db.query.orgAuditEngagementsTable.findFirst({
      where: and(eq(orgAuditEngagementsTable.orgId, orgId), eq(orgAuditEngagementsTable.id, engagementId)),
    });
    if (!engagement) throw new NotFoundException("Engagement not found");

    const requests = await db.query.orgAuditEvidenceRequestsTable.findMany({
      where: eq(orgAuditEvidenceRequestsTable.engagementId, engagementId),
    });
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
    });

    return {
      exportedAt: new Date().toISOString(),
      engagement: { ...engagement, accessToken: undefined },
      evidenceRequests: requests,
      evidence,
    };
  }
}
