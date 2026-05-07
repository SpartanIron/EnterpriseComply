import { Injectable } from "@nestjs/common";
import { db, orgPeopleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

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
    await writeAuditLog(orgId, "person.created", "person", String(person.id), { name: [person.firstName, person.lastName].filter(Boolean).join(" ") });
    return { person };
  }

  async updatePerson(orgId: number, id: number, body: Record<string, unknown>) {
    const [person] = await db
      .update(orgPeopleTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)))
      .returning();
    await writeAuditLog(orgId, "person.updated", "person", String(id), { name: [person?.firstName, person?.lastName].filter(Boolean).join(" ") });
    return { person };
  }

  async deletePerson(orgId: number, id: number) {
    await db
      .delete(orgPeopleTable)
      .where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)));
    await writeAuditLog(orgId, "person.deleted", "person", String(id));
    return { success: true };
  }
}
