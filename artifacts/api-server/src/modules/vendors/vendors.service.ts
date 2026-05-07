import { Injectable } from "@nestjs/common";
import { db, orgVendorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

@Injectable()
export class VendorsService {
  async getVendors(orgId: number) {
    const vendors = await db.query.orgVendorsTable.findMany({
      where: eq(orgVendorsTable.orgId, orgId),
    });
    return { vendors };
  }

  async addVendor(orgId: number, body: Record<string, unknown>) {
    const [vendor] = await db.insert(orgVendorsTable).values({ orgId, ...body }).returning();
    return { vendor };
  }
}
