import { Injectable } from "@nestjs/common";
import { db, orgIntegrationsTable, orgMonitoringJobsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

// Integration sync scheduler — runs in-process on a setInterval
// Production: replace with NestJS @Cron (requires @nestjs/schedule) or a separate worker
const SYNC_INTERVALS: Record<string, number> = {
  github: 6 * 60 * 60 * 1000,    // 6 hours
  aws: 4 * 60 * 60 * 1000,        // 4 hours
  okta: 4 * 60 * 60 * 1000,       // 4 hours
  cloudflare: 12 * 60 * 60 * 1000, // 12 hours
  default: 24 * 60 * 60 * 1000,   // 24 hours
};

@Injectable()
export class IntegrationSchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;

  onApplicationBootstrap() {
    // Run initial check after 2 minutes, then every 30 minutes
    setTimeout(() => this.runDueIntegrations(), 2 * 60 * 1000);
    this.timer = setInterval(() => this.runDueIntegrations(), 30 * 60 * 1000);
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
        if (now - lastSync < interval) continue; // Not due yet
        try {
          await db.update(orgMonitoringJobsTable)
            .set({ triggeredAt: new Date(), status: "running" } as any)
            .where(and(
              eq(orgMonitoringJobsTable.orgId, integration.orgId),
              eq(orgMonitoringJobsTable.integrationKey, integration.integrationKey)
            ));
          logger.log(`IntegrationScheduler: due sync org=${integration.orgId} key=${integration.integrationKey}`);
          // Mark lastSyncAt to prevent duplicate runs while sync is in-flight
          await db.update(orgIntegrationsTable)
            .set({ lastSyncAt: new Date() } as any)
            .where(eq(orgIntegrationsTable.id, integration.id));
        } catch (e) {
          logger.error(`IntegrationScheduler: error scheduling sync for ${integration.integrationKey}: ${e}`);
        }
      }
    } catch (e) {
      logger.error(`IntegrationScheduler: runDueIntegrations error: ${e}`);
    }
  }

  getSyncIntervals() {
    return SYNC_INTERVALS;
  }
}
