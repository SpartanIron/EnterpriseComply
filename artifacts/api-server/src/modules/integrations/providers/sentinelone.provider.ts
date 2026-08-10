import { Injectable, Logger } from '@nestjs/common';
import { db, orgEvidenceTable, orgIntegrationsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

interface SentinelOneConfig { apiToken: string; baseUrl: string; }

@Injectable()
export class SentinelOneProvider {
  private readonly logger = new Logger(SentinelOneProvider.name);

  async syncOrgSentinelOne(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.integrationKey, 'sentinelone'), eq(t.status, 'connected'))
    });
    if (!integration?.config) return { collected: 0, errors: ['SentinelOne not connected'] };
    const config = (integration.config ?? {}) as unknown as SentinelOneConfig;
    const headers = { 'Authorization': `ApiToken ${config.apiToken}`, 'Content-Type': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      const agentsResp = await fetch(`${config.baseUrl}/web/api/v2.1/agents?limit=100&isActive=true`, { headers });
      const agentsData = await agentsResp.json() as any; // typed below
      const agents = agentsData.data || [];
      const infected = agents.filter((a: any) => a.infected).length;
      await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-VM-001', source: 'sentinelone', title: 'SentinelOne Endpoint Protection', collectedAt: new Date(), description: `SentinelOne: ${agents.length} endpoints protected. Infected: ${infected}.`, metadata: { contentHash: '', totalAgents: agents.length, infectedCount: infected } });
      collected++;
      const threatsResp = await fetch(`${config.baseUrl}/web/api/v2.1/threats?limit=50&resolved=false`, { headers });
      const threatsData = await threatsResp.json() as any; // typed below
      const openThreats = threatsData.data?.length || 0;
      await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-IR-001', source: 'sentinelone', title: 'SentinelOne Open Threats', collectedAt: new Date(), description: `SentinelOne: ${openThreats} unresolved threats.`, metadata: { contentHash: '', openThreats } });
      collected++;
    } catch (e: any) { errors.push(`SentinelOne: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
