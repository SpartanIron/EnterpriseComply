import { Injectable } from "@nestjs/common";
import { db, orgPeopleTable } from "@workspace/db";
import { eq } from "drizzle-orm";

@Injectable()
export class PeopleService {
  async getPeople(orgId: number) {
    const people = await db.query.orgPeopleTable.findMany({
      where: eq(orgPeopleTable.orgId, orgId),
    });
    return { people };
  }

  async addPerson(orgId: number, body: Record<string, unknown>) {
    const [person] = await db.insert(orgPeopleTable).values({ orgId, ...body }).returning();
    return { person };
  }
}
