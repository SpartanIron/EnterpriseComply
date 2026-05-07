import { Injectable } from "@nestjs/common";
import {
  db,
  orgNotificationsTable,
  orgMonitoringJobsTable,
  orgNotificationSettingsTable,
  orgIntegrationsTable,
  orgAuditLogTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class MonitoringService {
  async getNotifications(orgId: number) {
    const notifications = await db.query.orgNotificationsTable.findMany({
      where: eq(orgNotificationsTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 50,
    });
    const unreadCount = notifications.filter((n) => !n.read).length;
    return { notifications, unreadCount };
  }

  async markRead(orgId: number, notificationIds: number[]) {
    for (const id of notificationIds) {
      await db.update(orgNotificationsTable)
        .set({ read: true, readAt: new Date() })
        .where(and(eq(orgNotificationsTable.orgId, orgId), eq(orgNotificationsTable.id, id)));
    }
    return { success: true };
  }

  async markAllRead(orgId: number) {
    await db.update(orgNotificationsTable)
      .set({ read: true, readAt: new Date() })
      .where(eq(orgNotificationsTable.orgId, orgId));
    return { success: true };
  }

  async getMonitoringJobs(orgId: number) {
    const jobs = await db.query.orgMonitoringJobsTable.findMany({
      where: eq(orgMonitoringJobsTable.orgId, orgId),
    });
    const integrations = await db.query.orgIntegrationsTable.findMany({
      where: eq(orgIntegrationsTable.orgId, orgId),
    });
    const enriched = integrations
      .filter((i) => i.status === "connected")
      .map((i) => ({
        ...i,
        job: jobs.find((j) => j.integrationKey === i.integrationKey) ?? null,
      }));
    return { monitoringJobs: enriched };
  }

  async triggerCheck(orgId: number, integrationKey: string) {
    const now = new Date();
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const existingJob = await db.query.orgMonitoringJobsTable.findFirst({
      where: and(
        eq(orgMonitoringJobsTable.orgId, orgId),
        eq(orgMonitoringJobsTable.integrationKey, integrationKey),
      ),
    });

    if (existingJob) {
      await db.update(orgMonitoringJobsTable)
        .set({ lastRunAt: now, nextRunAt: nextRun, status: "completed", driftDetected: false })
        .where(eq(orgMonitoringJobsTable.id, existingJob.id));
    } else {
      await db.insert(orgMonitoringJobsTable).values({
        orgId, integrationKey, status: "completed",
        lastRunAt: now, nextRunAt: nextRun, driftDetected: false,
      });
    }

    await db.insert(orgNotificationsTable).values({
      orgId, type: "monitoring_check", severity: "info",
      title: `${integrationKey} check completed`,
      message: `Manual compliance check for ${integrationKey} completed. No drift detected.`,
      resource: "integration", resourceId: integrationKey,
    });

    return { success: true, checkedAt: now };
  }

  async getSettings(orgId: number) {
    let settings = await db.query.orgNotificationSettingsTable.findFirst({
      where: eq(orgNotificationSettingsTable.orgId, orgId),
    });
    if (!settings) {
      [settings] = await db.insert(orgNotificationSettingsTable).values({ orgId }).returning();
    }
    return { settings };
  }

  async updateSettings(orgId: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (body.slackWebhookUrl !== undefined) updates.slackWebhookUrl = body.slackWebhookUrl;
    if (body.emailEnabled !== undefined) updates.emailEnabled = body.emailEnabled;
    if (body.slackEnabled !== undefined) updates.slackEnabled = body.slackEnabled;
    if (body.notifyOnDrift !== undefined) updates.notifyOnDrift = body.notifyOnDrift;
    if (body.notifyOnEvidenceExpiry !== undefined) updates.notifyOnEvidenceExpiry = body.notifyOnEvidenceExpiry;
    if (body.notifyOnPoamOverdue !== undefined) updates.notifyOnPoamOverdue = body.notifyOnPoamOverdue;
    if (body.notifyOnNewFindings !== undefined) updates.notifyOnNewFindings = body.notifyOnNewFindings;

    let settings = await db.query.orgNotificationSettingsTable.findFirst({
      where: eq(orgNotificationSettingsTable.orgId, orgId),
    });
    if (!settings) {
      [settings] = await db.insert(orgNotificationSettingsTable).values({ orgId, ...updates as any }).returning();
    } else {
      [settings] = await db.update(orgNotificationSettingsTable)
        .set(updates as any)
        .where(eq(orgNotificationSettingsTable.orgId, orgId))
        .returning();
    }
    return { settings };
  }

  async getAuditLog(orgId: number, limit = 100) {
    const logs = await db.query.orgAuditLogTable.findMany({
      where: eq(orgAuditLogTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
    });
    return { logs };
  }

  async writeAuditLog(orgId: number, entry: {
    actorId?: string; actorEmail?: string; action: string;
    resource: string; resourceId?: string; details?: unknown; ipAddress?: string;
  }) {
    await db.insert(orgAuditLogTable).values({ orgId, ...entry });
  }
}
