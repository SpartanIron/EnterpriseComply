import { Injectable } from "@nestjs/common";
import { db, orgEvidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class EvidenceService {
  async getEvidence(orgId: number) {
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
    });
    const now = new Date();
    return {
      evidence: evidence.map((e) => ({
        ...e,
        isStale: e.expiresAt ? e.expiresAt < now : false,
        daysUntilExpiry: e.expiresAt
          ? Math.ceil((e.expiresAt.getTime() - now.getTime()) / 86400000)
          : null,
      })),
    };
  }

  async addEvidence(
    orgId: number,
    clerkUserId: string,
    body: {
      ucoControlId?: string;
      title: string;
      description?: string;
      type?: string;
      url?: string;
      filename?: string;
      expiresAt?: string;
    },
  ) {
    const [item] = await db.insert(orgEvidenceTable).values({
      orgId,
      ucoControlId: body.ucoControlId,
      title: body.title,
      description: body.description,
      type: body.type ?? "document",
      source: "manual",
      url: body.url,
      filename: body.filename,
      uploadedBy: clerkUserId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      collectedAt: new Date(),
    }).returning();
    return { evidence: item };
  }

  async deleteEvidence(orgId: number, id: number) {
    await db
      .delete(orgEvidenceTable)
      .where(and(eq(orgEvidenceTable.id, id), eq(orgEvidenceTable.orgId, orgId)));
    return { success: true };
  }
}
