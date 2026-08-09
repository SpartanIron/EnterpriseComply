import { Injectable, Logger } from '@nestjs/common';
import { db, orgEvidenceTable, orgIntegrationsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

interface DatadogConfig { apiKey: string; appKey: string; site?: string; }

@Injectable()
export class DatadogProvider {
  private readonly logger = new Logger(DatadogProvider.name);

  async syncOrgDatadog(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.integrationKey, 'datadog'), eq(t.status, 'connected'))
    });
    if (!integration?.config) return { collected: 0, errors: ['Datadog not connected'] };
    const config = (integration.config ?? {}) as unknown as DatadogConfig;
    const site = config.site || 'datadoghq.com';
    const headers = { 'DD-API-KEY': config.apiKey, 'DD-APPLICATION-KEY': config.appKey, 'Content-Type': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      const monitorsResp = await fetch(`https://api.${site}/api/v1/monitor?with_downtimes=false`, { headers });
      if (monitorsResp.ok) {
        const monitors = await monitorsResp.json() as any; // typed below
        const alerting = Array.isArray(monitors) ? monitors.filter((m: any) => m.overall_state === 'Alert').length : 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AL-002', source: 'datadog', title: 'Datadog Monitor Status', collectedAt: new Date(), description: `Datadog: ${Array.isArray(monitors) ? monitors.length : 0} monitors configured. ${alerting} alerting.`, metadata: { contentHash: '', totalMonitors: Array.isArray(monitors) ? monitors.length : 0, alertingMonitors: alerting } });
        collected++;
      }
      const logsResp = await fetch(`https://api.${site}/api/v2/logs/config/indexes`, { headers });
      if (logsResp.ok) {
        const logsData = await logsResp.json() as any; // typed below
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AL-001', source: 'datadog', title: 'Datadog Log Indexes', collectedAt: new Date(), description: `Datadog: ${logsData.data?.length || 0} log indexes with retention policies.`, metadata: { contentHash: '', logIndexes: logsData.data?.length || 0 } });
        collected++;
      }
    } catch (e: any) { errors.push(`Datadog: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
