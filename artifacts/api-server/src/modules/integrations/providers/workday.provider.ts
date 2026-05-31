import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface WorkdayConfig { tenantUrl: string; clientId: string; clientSecret: string; refreshToken: string; }

@Injectable()
export class WorkdayProvider {
  async syncOrgWorkday(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({ where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'workday'), eq(t.status, 'active')) });
    if (!integration?.credentials) return { collected: 0, errors: ['Workday not connected'] };
    const config = integration.credentials as WorkdayConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      const tokenResp = await fetch(`${config.tenantUrl}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken }) });
      const tokenData = await tokenResp.json();
      if (!tokenData.access_token) throw new Error('Workday OAuth failed');
      const headers = { 'Authorization': `Bearer ${tokenData.access_token}` };
      const workersResp = await fetch(`${config.tenantUrl}/api/v1/workers?limit=1`, { headers });
      if (workersResp.ok) {
        const workersData = await workersResp.json();
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-ST-001', source: 'workday', collectedAt: new Date(), description: `Workday HCM: ${workersData.total || 0} workers. Employee lifecycle tracking active.`, metadata: { contentHash: '', totalWorkers: workersData.total || 0 } });
        collected++;
      }
    } catch (e: any) { errors.push(`Workday: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
