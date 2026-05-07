import { Injectable } from "@nestjs/common";
import { db, orgVendorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class VendorsService {
  async getVendors(orgId: number) {
    const vendors = await db.query.orgVendorsTable.findMany({
      where: eq(orgVendorsTable.orgId, orgId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return { vendors };
  }

  async addVendor(orgId: number, body: Record<string, unknown>) {
    const [vendor] = await db.insert(orgVendorsTable).values({ orgId, ...body } as any).returning();
    return { vendor };
  }

  async updateVendor(orgId: number, id: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.hasDataProcessingAgreement !== undefined || body.lastAssessedAt !== undefined) {
      if (body.lastAssessedAt === "now") updates.lastAssessedAt = new Date();
    }
    const [vendor] = await db
      .update(orgVendorsTable)
      .set(updates)
      .where(and(eq(orgVendorsTable.id, id), eq(orgVendorsTable.orgId, orgId)))
      .returning();
    return { vendor };
  }

  async deleteVendor(orgId: number, id: number) {
    await db
      .delete(orgVendorsTable)
      .where(and(eq(orgVendorsTable.id, id), eq(orgVendorsTable.orgId, orgId)));
    return { success: true };
  }
}
