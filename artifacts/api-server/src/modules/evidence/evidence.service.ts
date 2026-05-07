import { Injectable } from "@nestjs/common";
import { db, orgEvidenceTable } from "@workspace/db";
import { eq } from "drizzle-orm";

@Injectable()
export class EvidenceService {
  async getEvidence(orgId: number) {
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
    });
    return { evidence };
  }

  async addEvidence(
    orgId: number,
    clerkUserId: string,
    body: { ucoControlId?: string; title: string; description?: string; type?: string; url?: string; filename?: string },
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
      collectedAt: new Date(),
    }).returning();
    return { evidence: item };
  }
}
