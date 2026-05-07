import { Injectable } from "@nestjs/common";
import { db, orgPoamItemsTable, orgControlResultsTable, ucoControlsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class PoamService {
  async getItems(orgId: number) {
    const items = await db.query.orgPoamItemsTable.findMany({
      where: eq(orgPoamItemsTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return { items };
  }

  async createItem(orgId: number, body: Record<string, unknown>) {
    const [item] = await db.insert(orgPoamItemsTable).values({ orgId, ...body } as any).returning();
    return { item };
  }

  async updateItem(orgId: number, id: number, body: Record<string, unknown>) {
    const [item] = await db
      .update(orgPoamItemsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(orgPoamItemsTable.id, id), eq(orgPoamItemsTable.orgId, orgId)))
      .returning();
    return { item };
  }

  async deleteItem(orgId: number, id: number) {
    await db
      .delete(orgPoamItemsTable)
      .where(and(eq(orgPoamItemsTable.id, id), eq(orgPoamItemsTable.orgId, orgId)));
    return { success: true };
  }

  async createFromFailingControls(orgId: number) {
    const failingControls = await db.query.orgControlResultsTable.findMany({
      where: and(
        eq(orgControlResultsTable.orgId, orgId),
        eq(orgControlResultsTable.status, "failing"),
      ),
    });

    const existingPoam = await db.query.orgPoamItemsTable.findMany({
      where: eq(orgPoamItemsTable.orgId, orgId),
    });
    const existingControlIds = new Set(existingPoam.map((p) => p.ucoControlId).filter(Boolean));

    const newFailures = failingControls.filter(
      (c) => !existingControlIds.has(c.ucoControlId),
    );

    if (newFailures.length === 0) return { created: 0, items: [] };

    const ucoControls = await db.query.ucoControlsTable.findMany();
    const ucoMap = new Map(ucoControls.map((c) => [c.controlId, c]));

    const items = await Promise.all(
      newFailures.map((fc) => {
        const uco = ucoMap.get(fc.ucoControlId);
        return db.insert(orgPoamItemsTable).values({
          orgId,
          ucoControlId: fc.ucoControlId,
          frameworkKey: fc.integrationKey ?? "general",
          title: uco ? `Remediate: ${uco.name}` : `Remediate failing control: ${fc.ucoControlId}`,
          description: fc.failureReason ?? uco?.description ?? "Control is currently failing",
          weakness: fc.failureReason ?? uco?.description ?? "Control is currently failing",
          severity: "high",
          status: "open",
          originalRisk: "High",
          resources: "Security team",
          ownerName: "Security Team",
          ownerTeam: "Security",
          milestones: ["Identify root cause", "Develop remediation plan", "Implement fix", "Verify and close"],
        } as any).returning();
      }),
    );

    return { created: items.length, items: items.map((i) => i[0]) };
  }
}
