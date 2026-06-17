import { Injectable } from "@nestjs/common";
import { db, notificationsTable, orgEvidenceTable, orgMembersTable } from "@workspace/db";
import { eq, and, desc, lte, gte } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────
export type NotificationType = "error" | "warning" | "info" | "success";

export interface CreateNotificationInput {
  orgId: number;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Optional dedup key — if a notification with this key exists and is unread within 24h, skip */
  dedupKey?: string;
}

@Injectable()
export class NotificationsService {

  // ── Read / mark ──────────────────────────────────────────────────────────
  async getNotifications(orgId: number) {
    const existing = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.orgId, orgId))
      .orderBy(desc(notificationsTable.createdAt));

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

  // ── Create (live event-driven) ────────────────────────────────────────────
  /** Create a real notification for an org. Deduplicates by dedupKey within 24h. */
  async createNotification(input: CreateNotificationInput): Promise<void> {
    if (input.dedupKey) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(eq(notificationsTable.orgId, input.orgId))
        .limit(20);
      const recentDup = existing.find((n: any) =>
        n.dedupKey === input.dedupKey &&
        !n.read &&
        new Date(n.createdAt).getTime() > oneDayAgo.getTime()
      );
      if (recentDup) return;
    }

    await db.insert(notificationsTable).values({
      orgId: input.orgId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      ...(input.dedupKey ? { dedupKey: input.dedupKey } : {}),
    } as any);
  }

  // ── Event helpers called by scheduler / services ─────────────────────────

  async notifyControlFailures(
    orgId: number,
    integrationKey: string,
    failingControls: Array<{ id: string; name: string }>,
  ): Promise<void> {
    if (failingControls.length === 0) return;
    const controlSummary = failingControls.slice(0, 3).map(c => c.id).join(", ");
    const extra = failingControls.length > 3 ? ` +${failingControls.length - 3} more` : "";
    await this.createNotification({
      orgId,
      type: "error",
      title: `${failingControls.length} control${failingControls.length === 1 ? "" : "s"} failing — ${integrationKey} sync`,
      body: `${controlSummary}${extra} failed after the ${integrationKey} integration sync. Review and remediate in Controls or Remediation Board.`,
      link: "/controls",
      dedupKey: `control-failure:${integrationKey}:${controlSummary}`,
    });
  }

  async notifyEvidenceExpiry(
    orgId: number,
    expiringItems: Array<{ title: string; controlId?: string; daysUntilExpiry: number }>,
  ): Promise<void> {
    if (expiringItems.length === 0) return;
    const firstItem = expiringItems[0];
    const extra = expiringItems.length > 1 ? ` and ${expiringItems.length - 1} other item${expiringItems.length > 2 ? "s" : ""}` : "";
    await this.createNotification({
      orgId,
      type: "warning",
      title: `${expiringItems.length} evidence item${expiringItems.length === 1 ? "" : "s"} expiring within 7 days`,
      body: `"${firstItem.title}"${extra} will expire soon. Refresh evidence to keep controls passing.`,
      link: "/evidence",
      dedupKey: `evidence-expiry:${orgId}:${new Date().toDateString()}`,
    });
  }

  async notifyVendorAssessmentSent(orgId: number, vendorName: string): Promise<void> {
    await this.createNotification({
      orgId,
      type: "info",
      title: `Vendor assessment sent to ${vendorName}`,
      body: `A SIG-Lite security questionnaire has been automatically sent to ${vendorName}. Track responses in the Vendors section.`,
      link: "/vendors",
      dedupKey: `vendor-assessment-sent:${orgId}:${vendorName}:${new Date().toDateString()}`,
    });
  }

  async notifyNewHireSync(orgId: number, newHireCount: number, source: string): Promise<void> {
    if (newHireCount === 0) return;
    await this.createNotification({
      orgId,
      type: "success",
      title: `${newHireCount} new hire${newHireCount === 1 ? "" : "s"} synced from ${source}`,
      body: `${newHireCount} new employee${newHireCount === 1 ? " has" : "s have"} been added from ${source}. Policy acknowledgment requests and training assignments have been created.`,
      link: "/people",
      dedupKey: `new-hire-sync:${orgId}:${source}:${new Date().toDateString()}`,
    });
  }

  async notifyPolicyAckOverdue(orgId: number, policyTitle: string, overdueCount: number): Promise<void> {
    await this.createNotification({
      orgId,
      type: "warning",
      title: `${overdueCount} employee${overdueCount === 1 ? "" : "s"} have not acknowledged "${policyTitle}"`,
      body: `${overdueCount} employee${overdueCount === 1 ? " has" : "s have"} an overdue policy acknowledgment for "${policyTitle}". Reminder emails have been queued.`,
      link: "/policies",
      dedupKey: `policy-ack-overdue:${orgId}:${policyTitle}:${new Date().toDateString()}`,
    });
  }

  async notifyTrainingLowCompletion(orgId: number, completionRate: number, totalCount: number): Promise<void> {
    if (completionRate >= 80) return;
    await this.createNotification({
      orgId,
      type: "warning",
      title: `Security training completion at ${completionRate}%`,
      body: `Only ${completionRate}% of employees (${totalCount} total) have completed required security awareness training. This may affect your UCO-AT-001 control status.`,
      link: "/people",
      dedupKey: `training-completion:${orgId}:${new Date().toDateString()}`,
    });
  }

  // ── Evidence expiry scan ──────────────────────────────────────────────────
  async runEvidenceExpiryScan(orgId: number): Promise<Array<{ title: string; controlId?: string; daysUntilExpiry: number }>> {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const expiring = await db
      .select()
      .from(orgEvidenceTable)
      .where(
        and(
          eq(orgEvidenceTable.orgId, orgId),
          lte(orgEvidenceTable.expiresAt as any, sevenDaysFromNow),
          gte(orgEvidenceTable.expiresAt as any, now),
        ),
      );

    return expiring.map(e => ({
      title: e.title,
      controlId: e.ucoControlId ?? undefined,
      daysUntilExpiry: Math.ceil(
        ((e.expiresAt as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  // ── Admin email lookup ────────────────────────────────────────────────────
  async getOrgAdminEmails(orgId: number): Promise<Array<{ email: string; firstName?: string }>> {
    const members = await db
      .select({ email: orgMembersTable.email, firstName: orgMembersTable.firstName })
      .from(orgMembersTable)
      .where(and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.role, "admin")));
    return members.filter(m => !!m.email) as Array<{ email: string; firstName?: string }>;
  }
}
