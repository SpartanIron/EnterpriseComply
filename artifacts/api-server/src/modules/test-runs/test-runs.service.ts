import { Injectable } from "@nestjs/common";
import {
  db,
  orgIntegrationsTable,
  integrationSyncLogTable,
} from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { IntegrationSchedulerService } from "../scheduler/integration-scheduler.service";

// Status mapping: sync log → test run display
const SYNC_STATUS_MAP: Record<string, "pass" | "fail" | "warning"> = {
  success: "pass",
  partial: "warning",
  failed:  "fail",
};

@Injectable()
export class TestRunsService {
  constructor(
    private readonly schedulerService: IntegrationSchedulerService,
  ) {}

  async getTestRuns(orgId: number) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Query real sync log joined to integration display names
    const logs = await db
      .select({
        id:               integrationSyncLogTable.id,
        integrationKey:   integrationSyncLogTable.integrationKey,
        status:           integrationSyncLogTable.status,
        syncedAt:         integrationSyncLogTable.syncedAt,
        evidenceCount:    integrationSyncLogTable.evidenceCount,
        controlsUpdated:  integrationSyncLogTable.controlsUpdated,
        errorMessage:     integrationSyncLogTable.errorMessage,
        integrationName:  orgIntegrationsTable.name,
      })
      .from(integrationSyncLogTable)
      .leftJoin(
        orgIntegrationsTable,
        and(
          eq(integrationSyncLogTable.orgId, orgIntegrationsTable.orgId),
          eq(integrationSyncLogTable.integrationKey, orgIntegrationsTable.integrationKey),
        ),
      )
      .where(
        and(
          eq(integrationSyncLogTable.orgId, orgId),
          gte(integrationSyncLogTable.syncedAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(integrationSyncLogTable.syncedAt))
      .limit(200);

    // If no sync log rows, check whether any integrations are connected at all
    if (logs.length === 0) {
      const connected = await db
        .select({ id: orgIntegrationsTable.id })
        .from(orgIntegrationsTable)
        .where(
          and(
            eq(orgIntegrationsTable.orgId, orgId),
            eq(orgIntegrationsTable.status, "connected"),
          ),
        )
        .limit(1);

      return {
        runs: [],
        totalRuns: 0,
        passing: 0,
        failing: 0,
        noIntegrations: connected.length === 0,
      };
    }

    // Map sync log rows to the test-run shape expected by the frontend
    const runs = logs.map((log) => {
      const displayStatus = SYNC_STATUS_MAP[log.status] ?? "warning";
      const name = log.integrationName ?? capitalize(log.integrationKey);
      const detailParts: string[] = [];
      if (log.controlsUpdated) detailParts.push(`${log.controlsUpdated} control${log.controlsUpdated !== 1 ? "s" : ""} updated`);
      if (log.evidenceCount)   detailParts.push(`${log.evidenceCount} evidence item${log.evidenceCount !== 1 ? "s" : ""} collected`);

      return {
        id:           log.id,
        orgId,
        testId:       null,
        testName:     `${name} Integration Sync`,
        controlId:    null,
        status:       displayStatus,
        runAt:        log.syncedAt,
        durationMs:   null,
        details:      detailParts.length > 0 ? detailParts.join(", ") : undefined,
        errorMessage: log.errorMessage ?? undefined,
      };
    });

    const passing = runs.filter((r) => r.status === "pass").length;
    const failing  = runs.filter((r) => r.status === "fail").length;

    return {
      runs,
      totalRuns: runs.length,
      passing,
      failing,
      noIntegrations: false,
    };
  }

  async getIntegrationHealth(orgId: number) {
    const integrations = await db
      .select()
      .from(orgIntegrationsTable)
      .where(eq(orgIntegrationsTable.orgId, orgId));

    const connected = integrations.filter((i) => i.status === "connected");

    const health = connected.map((intg) => {
      const hoursSinceSync = intg.lastSyncAt
        ? (Date.now() - new Date(intg.lastSyncAt).getTime()) / 3600000
        : null;
      const syncStatus = !intg.lastSyncAt
        ? "never"
        : hoursSinceSync! < 1
          ? "healthy"
          : hoursSinceSync! < 24
            ? "stale"
            : "error";

      return {
        key:             intg.integrationKey,
        name:            intg.name,
        status:          intg.status,
        lastSyncAt:      intg.lastSyncAt,
        lastSyncStatus:  syncStatus,
        evidenceCollected: intg.evidenceCollected,
        nextSyncAt:      new Date(Date.now() + 3600000),
        accountName:     intg.accountName,
        accountLogin:    intg.accountLogin,
      };
    });

    return { health };
  }

  async triggerTestRuns(orgId: number) {
    // Run a real immediate sync of all connected integrations for this org
    const { triggered, results } = await this.schedulerService.syncOrgNow(orgId);

    if (triggered === 0) {
      return {
        triggered: 0,
        message: "No integrations connected. Connect one from the Integrations page to run automated tests.",
        runs: [],
        noIntegrations: true,
      };
    }

    // Map dispatcher results to the run response shape
    const runs = results.map((r, idx) => ({
      id:           Date.now() + idx,
      orgId,
      testId:       null,
      testName:     `${r.name} Integration Sync`,
      controlId:    null,
      status:       r.status === "success" ? "pass" : r.status === "partial" ? "warning" : "fail",
      runAt:        new Date(),
      durationMs:   r.durationMs ?? null,
      details:      r.checksPassed != null
        ? `${r.checksPassed}/${r.checksRun} checks passed`
        : undefined,
      errorMessage: r.error ?? null,
    }));

    const passing = runs.filter((r) => r.status === "pass").length;
    const failing  = runs.filter((r) => r.status === "fail").length;

    return {
      triggered: runs.length,
      message:   `Successfully triggered ${runs.length} integration sync${runs.length !== 1 ? "s" : ""}.`,
      passing,
      failing,
      runs,
    };
  }

  /**
   * Exercises the scheduler's full dispatch-and-catch path for one org,
   * bypassing the interval gate.  Used by the /run-scheduled endpoint so
   * integration tests can verify that scheduled-path failures are persisted
   * to integration_sync_log without waiting for the real scheduler tick.
   */
  async runScheduledForOrg(orgId: number): Promise<{ done: true }> {
    await this.schedulerService.runDueForOrg(orgId);
    return { done: true };
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
