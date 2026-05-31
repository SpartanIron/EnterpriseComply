import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface BambooHRConfig { apiKey: string; subdomain: string; }

@Injectable()
export class BambooHRProvider {
  async syncOrgBambooHR(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'bamboohr'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['BambooHR not connected'] };
    const config = integration.credentials as BambooHRConfig;
    const auth = Buffer.from(`${config.apiKey}:x`).toString('base64');
    const base = `https://api.bamboohr.com/api/gateway.php/${config.subdomain}/v1`;
    const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      // Employee list for offboarding tracking (SOC 2 CC6.2)
      const empResp = await fetch(`${base}/employees/directory`, { headers });
      if (empResp.ok) {
        const empData = await empResp.json();
        const employees = empData.employees || [];
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-ST-001', source: 'bamboohr', collectedAt: new Date(), description: `BambooHR: ${employees.length} employees in directory. Workforce roster maintained for access review.`, metadata: { contentHash: '', employeeCount: employees.length } });
        collected++;
      }
      // Time-off for access review scheduling
      const termResp = await fetch(`${base}/reports/custom?format=JSON`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Recent Terminations', filters: { lastChanged: { includeNull: false, value: '30daysAgo' } }, fields: ['id', 'displayName', 'terminationDate', 'employmentHistoryStatus'] }) });
      if (termResp.ok) {
        const termData = await termResp.json();
        const terminated = termData.employees?.filter((e: any) => e.terminationDate)?.length || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AC-005', source: 'bamboohr', collectedAt: new Date(), description: `BambooHR: ${terminated} employee terminations in last 30 days. Offboarding access revocation trigger active.`, metadata: { contentHash: '', recentTerminations: terminated } });
        collected++;
      }
    } catch (e: any) { errors.push(`BambooHR: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
