import { Injectable } from "@nestjs/common";
import { db, orgPoamItemsTable } from "@workspace/db";
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
    const [item] = await db.insert(orgPoamItemsTable).values({ orgId, ...body }).returning();
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
}
