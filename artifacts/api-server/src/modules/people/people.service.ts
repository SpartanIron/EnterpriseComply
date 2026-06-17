import { Injectable, Logger } from "@nestjs/common";
import { db, orgPeopleTable, orgPoliciesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";
import { sendNewHireComplianceEmail } from "../../lib/email.js";
import { NotificationsService } from "../notifications/notifications.service";

interface HREmployee {
  externalId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  employmentType?: string;
  startDate?: Date;
  active?: boolean;
}

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(private readonly notificationsSvc: NotificationsService) {}

  async getPeople(orgId: number) {
    const people = await db.query.orgPeopleTable.findMany({
      where: eq(orgPeopleTable.orgId, orgId),
      orderBy: (t, { asc }) => [asc(t.lastName), asc(t.firstName)],
    });
    return { people };
  }

  async addPerson(orgId: number, body: Record<string, unknown>) {
    const [person] = await db.insert(orgPeopleTable).values({ orgId, ...body } as any).returning();
    await writeAuditLog(orgId, "person.created", "person", String(person.id), {
      name: [person.firstName, person.lastName].filter(Boolean).join(" "),
    });
    return { person };
  }

  async updatePerson(orgId: number, id: number, body: Record<string, unknown>) {
    const [person] = await db
      .update(orgPeopleTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)))
      .returning();
    await writeAuditLog(orgId, "person.updated", "person", String(id), {
      name: [person?.firstName, person?.lastName].filter(Boolean).join(" "),
    });
    return { person };
  }

  async deletePerson(orgId: number, id: number) {
    await db.delete(orgPeopleTable).where(and(eq(orgPeopleTable.id, id), eq(orgPeopleTable.orgId, orgId)));
    await writeAuditLog(orgId, "person.deleted", "person", String(id));
    return { success: true };
  }

  /**
   * Sync people from an HR integration (BambooHR or Workday).
   * - Upserts employees by externalId
   * - New hires: sends compliance onboarding email listing all policies to acknowledge
   * - Creates in-app notification for org about new hires
   * - Deactivates people not in HR feed (terminations)
   */
  async syncPeopleFromHR(
    orgId: number,
    integrationKey: "bamboohr" | "workday",
    employees: HREmployee[],
  ): Promise<{ added: number; updated: number; deactivated: number }> {
    this.logger.log(`[people] syncPeopleFromHR org=${orgId} source=${integrationKey} count=${employees.length}`);

    const existingPeople = await db.query.orgPeopleTable.findMany({ where: eq(orgPeopleTable.orgId, orgId) });
    const existingByExternalId = new Map(existingPeople.filter(p => p.externalId).map(p => [p.externalId!, p]));
    const existingByEmail = new Map(existingPeople.filter(p => p.email).map(p => [p.email.toLowerCase(), p]));

    const publishedPolicies = await db.query.orgPoliciesTable.findMany({
      where: and(eq(orgPoliciesTable.orgId, orgId), eq(orgPoliciesTable.status, "published"), eq(orgPoliciesTable.requiresAcknowledgment, true)),
    });
    const policyTitles = publishedPolicies.map(p => p.title);

    let added = 0, updated = 0;

    for (const emp of employees) {
      try {
        const existing = existingByExternalId.get(emp.externalId) ?? existingByEmail.get(emp.email.toLowerCase());
        if (existing) {
          await db.update(orgPeopleTable).set({
            firstName: emp.firstName ?? existing.firstName,
            lastName: emp.lastName ?? existing.lastName,
            title: emp.title ?? existing.title,
            department: emp.department ?? existing.department,
            active: emp.active ?? existing.active,
            integrationKey, externalId: emp.externalId, updatedAt: new Date(),
          } as any).where(eq(orgPeopleTable.id, existing.id));
          updated++;
        } else {
          const [person] = await db.insert(orgPeopleTable).values({
            orgId, externalId: emp.externalId, integrationKey, email: emp.email,
            firstName: emp.firstName, lastName: emp.lastName, title: emp.title, department: emp.department,
            employmentType: emp.employmentType ?? "employee", startDate: emp.startDate,
            active: emp.active ?? true, trainingStatus: "not_started",
            backgroundCheckStatus: "not_started", accessReviewStatus: "pending",
          } as any).returning();

          await writeAuditLog(orgId, "person.synced_from_hr", "person", String(person.id), {
            name: [emp.firstName, emp.lastName].filter(Boolean).join(" "), source: integrationKey,
          });

          sendNewHireComplianceEmail({
            to: emp.email, firstName: emp.firstName,
            orgName: `Org #${orgId}`, policiesToAck: policyTitles,
            trainingUrl: process.env["APP_URL"] ? `${process.env["APP_URL"]}/people` : undefined,
          }).catch(e => this.logger.error(`[people] sendNewHireComplianceEmail ${emp.email}: ${e}`));

          added++;
        }
      } catch (e) { this.logger.error(`[people] sync employee ${emp.email}: ${e}`); }
    }

    // Deactivate terminated employees (not in HR feed)
    const incomingEmails = new Set(employees.map(e => e.email.toLowerCase()));
    const incomingExtIds = new Set(employees.map(e => e.externalId));
    let deactivated = 0;

    for (const existing of existingPeople) {
      if (!existing.active || existing.integrationKey !== integrationKey) continue;
      const inFeed = (existing.externalId && incomingExtIds.has(existing.externalId)) || incomingEmails.has(existing.email.toLowerCase());
      if (!inFeed) {
        await db.update(orgPeopleTable).set({ active: false, updatedAt: new Date() } as any).where(eq(orgPeopleTable.id, existing.id));
        deactivated++;
      }
    }

    if (added > 0) {
      await this.notificationsSvc.notifyNewHireSync(orgId, added, integrationKey)
        .catch(e => this.logger.error(`[people] notifyNewHireSync: ${e}`));
    }

    this.logger.log(`[people] syncPeopleFromHR done: added=${added} updated=${updated} deactivated=${deactivated}`);
    return { added, updated, deactivated };
  }
}
