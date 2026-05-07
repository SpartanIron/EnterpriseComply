import { Injectable } from "@nestjs/common";
import { db, notificationsTable, orgControlResultsTable, orgEvidenceTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const DEFAULT_NOTIFICATIONS = [
  { type: "warning", title: "Evidence expiring in 7 days", body: "3 evidence items are expiring within the next 7 days and need to be refreshed to maintain your compliance posture.", link: "/evidence" },
  { type: "error", title: "2 controls newly failing", body: "UCO-VM-001 (Vulnerability Management) and UCO-EP-001 (Endpoint Detection) are now failing based on your latest integration sync.", link: "/controls" },
  { type: "info", title: "FedRAMP Moderate assessment due", body: "Your FedRAMP Moderate continuous monitoring review is due within 30 days. Ensure all required artifacts are current.", link: "/frameworks" },
  { type: "success", title: "GitHub integration synced", body: "GitHub integration successfully synced. 4 controls updated: code review, branch protection, MFA, and CI/CD pipeline controls are now passing.", link: "/integrations" },
  { type: "warning", title: "Policy acknowledgments overdue", body: "8 employees have not acknowledged the updated Acceptable Use Policy. Reminders have been queued.", link: "/policies" },
];

@Injectable()
export class NotificationsService {
  async getNotifications(orgId: number) {
    const existing = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.orgId, orgId))
      .orderBy(desc(notificationsTable.createdAt));

    if (existing.length === 0) {
      // Seed default notifications for new orgs
      await db.insert(notificationsTable).values(
        DEFAULT_NOTIFICATIONS.map(n => ({ ...n, orgId } as any))
      );
      const seeded = await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.orgId, orgId))
        .orderBy(desc(notificationsTable.createdAt));
      return { notifications: seeded, unreadCount: seeded.filter(n => !n.read).length };
    }

    return { notifications: existing, unreadCount: existing.filter(n => !n.read).length };
  }

  async markRead(orgId: number, id: number) {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.orgId, orgId)));
    return { ok: true };
  }

  async markAllRead(orgId: number) {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.orgId, orgId));
    return { ok: true };
  }
}
