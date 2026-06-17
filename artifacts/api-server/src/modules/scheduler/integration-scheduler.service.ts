import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { db, orgIntegrationsTable, orgMonitoringJobsTable, orgControlResultsTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { IntegrationsService } from "../integrations/integrations.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SlackAlertService } from "../notifications/slack-alert.service";
import { sendControlFailureEmail, sendEvidenceExpiryEmail } from "../../lib/email.js";

// Sync cadence per provider (milliseconds)
const SYNC_INTERVALS: Record<string, number> = {
  github: 6 * 60 * 60 * 1000,
  aws: 4 * 60 * 60 * 1000,
  okta: 4 * 60 * 60 * 1000,
  cloudflare: 12 * 60 * 60 * 1000,
  default: 24 * 60 * 60 * 1000,
};

const SYNC_DISPATCH: Record<string, (svc: IntegrationsService, orgId: number) => Promise<unknown>> = {
  github: (svc, orgId) => svc.syncOrgGitHubLive(orgId),
  aws: (svc, orgId) => svc.syncOrgAWS(orgId),
  okta: (svc, orgId) => svc.syncOrgOkta(orgId),
  cloudflare: (svc, orgId) => svc.syncOrgCloudflare(orgId),
};

const INTEGRATION_CONTROL_SCOPE: Record<string, string[]> = {
  github: ["UCO-CM-001", "UCO-CM-002", "UCO-AC-003", "UCO-DP-003"],
  aws: ["UCO-NS-002", "UCO-DP-001", "UCO-AL-001", "UCO-VM-001"],
  okta: ["UCO-AC-001", "UCO-AC-002", "UCO-AI-001", "UCO-AI-002"],
  cloudflare: ["UCO-NS-001", "UCO-NS-002", "UCO-DP-003"],
};

const CONTROL_NAMES: Record<string, string> = {
  "UCO-AC-001": "Access Control Policy",
  "UCO-AC-002": "Privileged Account Management",
  "UCO-AC-003": "Least Privilege Enforcement",
  "UCO-AI-001": "MFA Enforcement",
  "UCO-AI-002": "Identity Provider Configuration",
  "UCO-AL-001": "Audit Logging",
  "UCO-AL-002": "Log Retention",
  "UCO-CM-001": "Change Management",
  "UCO-CM-002": "Branch Protection",
  "UCO-DP-001": "Data Encryption at Rest",
  "UCO-DP-002": "Data Encryption in Transit",
  "UCO-DP-003": "TLS/Certificate Management",
  "UCO-IR-001": "Incident Response Plan",
  "UCO-NS-001": "Network Segmentation",
  "UCO-NS-002": "Firewall / WAF",
  "UCO-VM-001": "Vulnerability Management",
  "UCO-VM-002": "Patch Management",
  "UCO-AT-001": "Security Awareness Training",
};

/** Returns true if the error is an unconfigured-credentials error (not a real failure) */
function isCredentialsMissing(e: unknown): boolean {
  if (!e) return false;
  const msg = String((e as any)?.message ?? e);
  return (
    msg.includes("not configured") ||
    msg.includes("credentials not") ||
    msg.includes("token not configured") ||
    msg.includes("BadRequestException")
  );
}

@Injectable()
export class IntegrationSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly integrationsSvc: IntegrationsService,
    private readonly notificationsSvc: NotificationsService,
    private readonly slackAlertSvc: SlackAlertService,
  ) {}

  onApplicationBootstrap() {
    setTimeout(() => this.runDueIntegrations(), 2 * 60 * 1000);
    this.timer = setInterval(() => this.runDueIntegrations(), 30 * 60 * 1000);
    setTimeout(() => this.runEvidenceExpirySweep(), 3 * 60 * 1000);
    setInterval(() => this.runEvidenceExpirySweep(), 24 * 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async runDueIntegrations(): Promise<void> {
    try {
      const integrations = await db.query.orgIntegrationsTable.findMany({
        where: eq(orgIntegrationsTable.status, "connected"),
      });
      const now = Date.now();
      for (const integration of integrations) {
        const interval = SYNC_INTERVALS[integration.integrationKey] ?? SYNC_INTERVALS.default;
        const lastSync = integration.lastSyncAt ? new Date(integration.lastSyncAt).getTime() : 0;
        if ((now - lastSync) < interval) continue;
        const dispatch = SYNC_DISPATCH[integration.integrationKey];
        if (!dispatch) continue;
        try {
          const scope = INTEGRATION_CONTROL_SCOPE[integration.integrationKey] ?? [];
          const preStatuses = await this.snapshotControlStatuses(integration.orgId, scope);

          await db.update(orgMonitoringJobsTable)
            .set({ triggeredAt: new Date(), status: "running" } as any)
            .where(and(
              eq(orgMonitoringJobsTable.orgId, integration.orgId),
              eq(orgMonitoringJobsTable.integrationKey, integration.integrationKey),
            ));

          logger.info(`IntegrationScheduler: dispatching sync org=${integration.orgId} key=${integration.integrationKey}`);
          await dispatch(this.integrationsSvc, integration.orgId);

          await db.update(orgIntegrationsTable)
            .set({ lastSyncAt: new Date() } as any)
            .where(eq(orgIntegrationsTable.id, integration.id));

          logger.info(`IntegrationScheduler: sync complete org=${integration.orgId} key=${integration.integrationKey}`);

          const postStatuses = await this.snapshotControlStatuses(integration.orgId, scope);
          const newlyFailing = scope
            .filter(id => preStatuses[id] !== "failing" && postStatuses[id] === "failing")
            .map(id => ({ id, name: CONTROL_NAMES[id] ?? id }));
          const newlyPassing = scope
            .filter(id => preStatuses[id] === "failing" && postStatuses[id] !== "failing")
            .map(id => ({ id, name: CONTROL_NAMES[id] ?? id }));

          if (newlyFailing.length > 0) {
            await this.notificationsSvc.notifyControlFailures(
              integration.orgId, integration.integrationKey, newlyFailing,
            ).catch(e => logger.error(`[scheduler] notifyControlFailures: ${e}`));

            const orgData = await this.getOrgData(integration.orgId);

            await this.slackAlertSvc.alertControlFailure({
              orgName: orgData.name,
              orgId: integration.orgId,
              integrationKey: integration.integrationKey,
              failingControls: newlyFailing,
              passingControls: newlyPassing,
              complianceScore: orgData.complianceScore,
            }, orgData.slackWebhookUrl).catch(e => logger.error(`[scheduler] slackControlFailure: ${e}`));

            const admins = await this.notificationsSvc.getOrgAdminEmails(integration.orgId).catch(() => []);
            for (const admin of admins) {
              await sendControlFailureEmail({
                to: admin.email,
                firstName: admin.firstName,
                orgName: orgData.name,
                failingControls: newlyFailing,
                integrationKey: integration.integrationKey,
              }).catch(e => logger.error(`[scheduler] sendControlFailureEmail: ${e}`));
            }
          }
        } catch (e) {
          // Credentials not configured is an expected state — log as warn, not error
          if (isCredentialsMissing(e)) {
            logger.warn(`IntegrationScheduler: skipping sync org=${integration.orgId} key=${integration.integrationKey} — credentials not configured`);
          } else {
            logger.error(`IntegrationScheduler: sync failed org=${integration.orgId} key=${integration.integrationKey}: ${e}`);
          }
        }
      }
    } catch (e) {
      logger.error(`IntegrationScheduler: runDueIntegrations error: ${e}`);
    }
  }

  async runEvidenceExpirySweep(): Promise<void> {
    try {
      const integrations = await db.query.orgIntegrationsTable.findMany({
        where: eq(orgIntegrationsTable.status, "connected"),
      });
      const orgIds = [...new Set(integrations.map(i => i.orgId))];
      for (const orgId of orgIds) {
        try {
          const expiringItems = await this.notificationsSvc.runEvidenceExpiryScan(orgId);
          if (expiringItems.length === 0) continue;

          await this.notificationsSvc.notifyEvidenceExpiry(orgId, expiringItems)
            .catch(e => logger.error(`[scheduler] notifyEvidenceExpiry org=${orgId}: ${e}`));

          const orgData = await this.getOrgData(orgId);

          await this.slackAlertSvc.alertEvidenceExpiry(
            { orgName: orgData.name, orgId, expiringItems },
            orgData.slackWebhookUrl,
          ).catch(e => logger.error(`[scheduler] slackEvidenceExpiry: ${e}`));

          const admins = await this.notificationsSvc.getOrgAdminEmails(orgId).catch(() => []);
          for (const admin of admins) {
            await sendEvidenceExpiryEmail({
              to: admin.email,
              firstName: admin.firstName,
              orgName: orgData.name,
              expiringItems,
            }).catch(e => logger.error(`[scheduler] sendEvidenceExpiryEmail: ${e}`));
          }
        } catch (e) {
          logger.error(`[scheduler] evidenceExpiry org=${orgId}: ${e}`);
        }
      }
    } catch (e) {
      logger.error(`[scheduler] runEvidenceExpirySweep: ${e}`);
    }
  }

  private async snapshotControlStatuses(orgId: number, controlIds: string[]): Promise<Record<string, string>> {
    if (controlIds.length === 0) return {};
    const results = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const map: Record<string, string> = {};
    for (const r of results) {
      if (controlIds.includes(r.ucoControlId)) map[r.ucoControlId] = r.status;
    }
    return map;
  }

  private async getOrgData(orgId: number): Promise<{ name: string; complianceScore?: number; slackWebhookUrl?: string | null }> {
    const org = await db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) });
    return { name: org?.name ?? `Org #${orgId}`, slackWebhookUrl: (org as any)?.slackWebhookUrl ?? null };
  }

  getSyncIntervals() { return SYNC_INTERVALS; }
}
