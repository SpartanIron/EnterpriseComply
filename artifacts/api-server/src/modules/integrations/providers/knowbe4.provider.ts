import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface KnowBe4Config { apiKey: string; region?: string; }

@Injectable()
export class KnowBe4Provider {
  async syncOrgKnowBe4(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({ where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'knowbe4'), eq(t.status, 'active')) });
    if (!integration?.credentials) return { collected: 0, errors: ['KnowBe4 not connected'] };
    const config = integration.credentials as KnowBe4Config;
    const base = config.region === 'eu' ? 'https://eu.api.knowbe4.com' : 'https://us.api.knowbe4.com';
    const headers = { 'Authorization': `Bearer ${config.apiKey}` };
    const errors: string[] = [];
    let collected = 0;
    try {
      const campResp = await fetch(`${base}/v1/training/campaigns?status=complete&per_page=10`, { headers });
      if (campResp.ok) {
        const campaigns = await campResp.json();
        const avg = campaigns.length > 0 ? Math.round(campaigns.reduce((a: number, c: any) => a + (c.completion_percentage || 0), 0) / campaigns.length) : 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-ST-002', source: 'knowbe4', collectedAt: new Date(), description: `KnowBe4: ${campaigns.length} campaigns. Avg completion: ${avg}%.`, metadata: { contentHash: '', campaigns: campaigns.length, avgCompletion: avg } });
        collected++;
      }
      const phishResp = await fetch(`${base}/v1/phishing/campaigns?per_page=5&status=closed`, { headers });
      if (phishResp.ok) {
        const phishing = await phishResp.json();
        const avgClick = phishing.length > 0 ? Math.round(phishing.reduce((a: number, p: any) => a + (p.pct_clicked || 0), 0) / phishing.length) : 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-ST-001', source: 'knowbe4', collectedAt: new Date(), description: `KnowBe4 Phishing: avg click rate ${avgClick}%. ${avgClick < 10 ? 'Good posture' : 'Training recommended'}.`, metadata: { contentHash: '', avgClickRate: avgClick } });
        collected++;
      }
    } catch (e: any) { errors.push(`KnowBe4: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
