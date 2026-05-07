import { Injectable } from "@nestjs/common";
import { db, orgPeopleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class PeopleService {
  async getPeople(orgId: number) {
    const people = await db.query.orgPeopleTable.findMany({
      where: eq(orgPeopleTable.orgId, orgId),
      orderBy: (t, { asc }) => [asc(t.lastName), asc(t.firstName)],
    });
    return { people };
  }

  async addPerson(orgId: number, body: Record<string, unknown>) {
    const [person] = await db.insert(orgPeopleTable).values({ orgId, ...body } as any).returning();
    return { person };
  }

  async updatePerson(orgId: number, id: number, body: Record<string, unknown>) {
    const [person] = await db
      .update(orgPeopleTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)))
      .returning();
    return { person };
  }

  async deletePerson(orgId: number, id: number) {
    await db
      .delete(orgPeopleTable)
      .where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)));
    return { success: true };
  }
}
