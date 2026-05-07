import { Injectable } from "@nestjs/common";
import { db } from "@workspace/db";
import { orgStigChecklistsTable, orgStigFindingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class StigsService {
  async getChecklists(orgId: number) {
    const checklists = await db.query.orgStigChecklistsTable.findMany({
      where: eq(orgStigChecklistsTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const withCounts = await Promise.all(
      checklists.map(async (c) => {
        const findings = await db.query.orgStigFindingsTable.findMany({
          where: and(
            eq(orgStigFindingsTable.orgId, orgId),
            eq(orgStigFindingsTable.checklistId, c.id),
          ),
        });
        const open = findings.filter((f) => f.status === "open").length;
        const notAFinding = findings.filter((f) => f.status === "not_a_finding").length;
        const notApplicable = findings.filter((f) => f.status === "not_applicable").length;
        const notReviewed = findings.filter((f) => f.status === "not_reviewed").length;
        const cat1 = findings.filter((f) => f.severity === "high").length;
        const cat2 = findings.filter((f) => f.severity === "medium").length;
        const cat3 = findings.filter((f) => f.severity === "low").length;
        return { ...c, summary: { total: findings.length, open, notAFinding, notApplicable, notReviewed, cat1, cat2, cat3 } };
      }),
    );
    return { checklists: withCounts };
  }

  async createChecklist(orgId: number, body: Record<string, unknown>) {
    const [checklist] = await db.insert(orgStigChecklistsTable).values({ orgId, ...body } as any).returning();
    return { checklist };
  }

  async deleteChecklist(orgId: number, id: number) {
    await db.delete(orgStigFindingsTable).where(and(eq(orgStigFindingsTable.orgId, orgId), eq(orgStigFindingsTable.checklistId, id)));
    await db.delete(orgStigChecklistsTable).where(and(eq(orgStigChecklistsTable.id, id), eq(orgStigChecklistsTable.orgId, orgId)));
    return { success: true };
  }

  async getFindings(orgId: number, checklistId: number) {
    const findings = await db.query.orgStigFindingsTable.findMany({
      where: and(
        eq(orgStigFindingsTable.orgId, orgId),
        eq(orgStigFindingsTable.checklistId, checklistId),
      ),
      orderBy: (t, { asc }) => [asc(t.vulnId)],
    });
    return { findings };
  }

  async bulkCreateFindings(orgId: number, checklistId: number, findings: Record<string, unknown>[]) {
    if (findings.length === 0) return { created: 0 };
    const rows = findings.map((f) => ({ orgId, checklistId, ...f } as any));
    await db.insert(orgStigFindingsTable).values(rows);
    return { created: rows.length };
  }

  async updateFinding(orgId: number, id: number, body: Record<string, unknown>) {
    const [finding] = await db
      .update(orgStigFindingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(orgStigFindingsTable.id, id), eq(orgStigFindingsTable.orgId, orgId)))
      .returning();
    return { finding };
  }
}
