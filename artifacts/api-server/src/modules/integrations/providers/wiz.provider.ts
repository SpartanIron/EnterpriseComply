import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface WizConfig { clientId: string; clientSecret: string; tokenUrl?: string; }

@Injectable()
export class WizProvider {
  private readonly logger = new Logger(WizProvider.name);

  private async getWizToken(config: WizConfig): Promise<string> {
    const tokenUrl = config.tokenUrl || 'https://auth.app.wiz.io/oauth/token';
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret, audience: 'wiz-api' }),
    });
    const data = await resp.json();
    return data.access_token;
  }

  async syncOrgWiz(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'wiz'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Wiz not connected'] };
    const config = integration.credentials as WizConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      const token = await this.getWizToken(config);
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      // Cloud security posture (CSPM findings)
      const issuesQuery = { query: `query { issues(first: 50, filterBy: { status: OPEN, severity: [CRITICAL, HIGH] }) { nodes { id severity status entitySnapshot { name type } control { name } } totalCount } }` };
      const issuesResp = await fetch('https://api.us1.app.wiz.io/graphql', { method: 'POST', headers, body: JSON.stringify(issuesQuery) });
      if (issuesResp.ok) {
        const issuesData = await issuesResp.json();
        const total = issuesData.data?.issues?.totalCount || 0;
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-VM-002', source: 'wiz', collectedAt: new Date(),
          description: `Wiz CSPM: ${total} critical/high cloud security issues. Cloud posture assessment complete.`,
          metadata: { contentHash: '', openIssues: total },
        });
        collected++;
      }
    } catch (e: any) { errors.push(`Wiz: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
