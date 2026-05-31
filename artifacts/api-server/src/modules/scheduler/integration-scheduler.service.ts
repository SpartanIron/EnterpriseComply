import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { db, orgIntegrationsTable, orgMonitoringJobsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { IntegrationsService } from "../integrations/integrations.service";

// Sync cadence per provider (milliseconds)
const SYNC_INTERVALS: Record<string, number> = {
  github:     6 * 60 * 60 * 1000,   // 6 hours
  aws:        4 * 60 * 60 * 1000,   // 4 hours
  okta:       4 * 60 * 60 * 1000,   // 4 hours
  cloudflare: 12 * 60 * 60 * 1000,  // 12 hours
  default:    24 * 60 * 60 * 1000,  // 24 hours
};

// Map integration key to the IntegrationsService method that runs the live sync
const SYNC_DISPATCH: Record<string, (svc: IntegrationsService, orgId: number) => Promise<unknown>> = {
  github:     (svc, orgId) => svc.syncOrgGitHubLive(orgId),
  aws:        (svc, orgId) => svc.syncOrgAWS(orgId),
  okta:       (svc, orgId) => svc.syncOrgOkta(orgId),
  cloudflare: (svc, orgId) => svc.syncOrgCloudflare(orgId),
};

@Injectable()
export class IntegrationSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly integrationsSvc: IntegrationsService) {}

  onApplicationBootstrap() {
    // Initial pass after 2 min warm-up, then every 30 min
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
        if ((now - lastSync) < interval) continue; // not due yet

        const dispatch = SYNC_DISPATCH[integration.integrationKey];
        if (!dispatch) {
          // No live sync implementation — skip silently (catalog-only integrations)
          continue;
        }

        try {
          // Mark as running in monitoring table
          await db.update(orgMonitoringJobsTable)
            .set({ triggeredAt: new Date(), status: "running" } as any)
            .where(and(
              eq(orgMonitoringJobsTable.orgId, integration.orgId),
              eq(orgMonitoringJobsTable.integrationKey, integration.integrationKey),
            ));

          logger.log(`IntegrationScheduler: dispatching sync org=${integration.orgId} key=${integration.integrationKey}`);

          // Dispatch the actual provider sync — this calls real AWS/Okta/GitHub/Cloudflare APIs
          await dispatch(this.integrationsSvc, integration.orgId);

          // Mark lastSyncAt so we don't re-run until the interval elapses
          await db.update(orgIntegrationsTable)
            .set({ lastSyncAt: new Date() } as any)
            .where(eq(orgIntegrationsTable.id, integration.id));

          logger.log(`IntegrationScheduler: sync complete org=${integration.orgId} key=${integration.integrationKey}`);
        } catch (e) {
          logger.error(`IntegrationScheduler: sync failed org=${integration.orgId} key=${integration.integrationKey}: ${e}`);
        }
      }
    } catch (e) {
      logger.error(`IntegrationScheduler: runDueIntegrations error: ${e}`);
    }
  }

  getSyncIntervals() { return SYNC_INTERVALS; }
}
