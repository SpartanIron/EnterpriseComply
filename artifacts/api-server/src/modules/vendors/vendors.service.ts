import { Injectable } from "@nestjs/common";
import { db, orgVendorsTable, orgVendorAssessmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";
import { sendVendorAssessmentEmail } from "../../lib/email.js";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class VendorsService {
  constructor(private readonly notificationsSvc: NotificationsService) {}

  async getVendors(orgId: number) {
    const vendors = await db.query.orgVendorsTable.findMany({
      where: eq(orgVendorsTable.orgId, orgId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return { vendors };
  }

  /**
   * Add a vendor and automatically:
   * 1. Create a SIG-Lite vendor assessment record (status: sent)
   * 2. Set nextAssessmentDue to 1 year from now
   * 3. Send a vendor assessment email to org admins
   * 4. Create an in-app notification
   */
  async addVendor(orgId: number, body: Record<string, unknown>) {
    const nextAssessmentDue = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const assessmentDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [vendor] = await db.insert(orgVendorsTable).values({
      orgId, ...body, nextAssessmentDue,
    } as any).returning();

    await writeAuditLog(orgId, "vendor.created", "vendor", String(vendor.id), { name: vendor.name });

    // Auto-create vendor assessment record
    const [assessment] = await db.insert(orgVendorAssessmentsTable).values({
      orgId,
      vendorId: vendor.id,
      templateType: "sig-lite",
      status: "sent",
      dueDate: assessmentDueDate,
      totalItems: 30,
      createdBy: "system",
    } as any).returning();

    // In-app notification
    this.notificationsSvc.notifyVendorAssessmentSent(orgId, vendor.name)
      .catch(e => console.error("[vendors] notifyVendorAssessmentSent:", e));

    // Email org admins
    this.notificationsSvc.getOrgAdminEmails(orgId).then(admins => {
      for (const admin of admins) {
        sendVendorAssessmentEmail({
          to: admin.email,
          vendorName: vendor.name,
          requesterOrgName: "your organization",
          templateType: "sig-lite",
          dueDate: assessmentDueDate,
          assessmentId: assessment.id,
        }).catch(e => console.error("[vendors] sendVendorAssessmentEmail:", e));
      }
    }).catch(e => console.error("[vendors] getOrgAdminEmails:", e));

    return { vendor, assessment };
  }

  async updateVendor(orgId: number, id: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.lastAssessedAt === "now") updates.lastAssessedAt = new Date();
    const [vendor] = await db
      .update(orgVendorsTable)
      .set(updates)
      .where(and(eq(orgVendorsTable.id, id), eq(orgVendorsTable.orgId, orgId)))
      .returning();
    await writeAuditLog(orgId, "vendor.updated", "vendor", String(id), { name: vendor?.name });
    return { vendor };
  }

  async deleteVendor(orgId: number, id: number) {
    await db.delete(orgVendorsTable).where(and(eq(orgVendorsTable.id, id), eq(orgVendorsTable.orgId, orgId)));
    await writeAuditLog(orgId, "vendor.deleted", "vendor", String(id));
    return { success: true };
  }
}
