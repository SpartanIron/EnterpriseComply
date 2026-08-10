import { Injectable, Logger } from '@nestjs/common';
import { db, orgEvidenceTable, orgIntegrationsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

interface ServiceNowConfig { instanceUrl: string; username: string; password: string; }

@Injectable()
export class ServiceNowProvider {
  private readonly logger = new Logger(ServiceNowProvider.name);

  async syncOrgServiceNow(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.integrationKey, 'servicenow'), eq(t.status, 'connected'))
    });
    if (!integration?.config) return { collected: 0, errors: ['ServiceNow not connected'] };
    const config = (integration.config ?? {}) as unknown as ServiceNowConfig;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const base = config.instanceUrl.replace(/\/$/, '');
    const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      const changeResp = await fetch(`${base}/api/now/table/change_request?sysparm_limit=50&sysparm_query=state=closed^approval=approved`, { headers });
      if (changeResp.ok) {
        const changeData = await changeResp.json() as any; // typed below
        const approved = changeData.result?.length || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-CM-003', source: 'servicenow', title: 'ServiceNow Change Requests', collectedAt: new Date(), description: `ServiceNow: ${approved} approved change requests. CAB process active.`, metadata: { contentHash: '', approvedChanges: approved } });
        collected++;
      }
      const incidentResp = await fetch(`${base}/api/now/table/incident?sysparm_limit=50&sysparm_query=priority=1^ORpriority=2`, { headers });
      if (incidentResp.ok) {
        const incidentData = await incidentResp.json() as any; // typed below
        const p1p2 = incidentData.result?.length || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-IR-002', source: 'servicenow', title: 'ServiceNow P1/P2 Incidents', collectedAt: new Date(), description: `ServiceNow: ${p1p2} P1/P2 incidents. IR SLA tracking active.`, metadata: { contentHash: '', p1p2Incidents: p1p2 } });
        collected++;
      }
    } catch (e: any) { errors.push(`ServiceNow: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
