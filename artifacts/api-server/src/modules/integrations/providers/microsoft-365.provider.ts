import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface Microsoft365Config { tenantId: string; clientId: string; clientSecret: string; }

@Injectable()
export class Microsoft365Provider {
  private readonly logger = new Logger(Microsoft365Provider.name);

  private async getToken(config: Microsoft365Config): Promise<string> {
    const resp = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret, scope: 'https://graph.microsoft.com/.default' }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error('M365 OAuth failed');
    return data.access_token;
  }

  async syncOrgMicrosoft365(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'microsoft-365'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Microsoft 365 not connected'] };
    const config = integration.credentials as Microsoft365Config;
    const errors: string[] = [];
    let collected = 0;
    try {
      const token = await this.getToken(config);
      const headers = { 'Authorization': `Bearer ${token}` };
      const authResp = await fetch('https://graph.microsoft.com/v1.0/reports/credentialUserRegistrationDetails?$top=100', { headers });
      if (authResp.ok) {
        const authData = await authResp.json();
        const users = authData.value || [];
        const mfaRegistered = users.filter((u: any) => u.isMfaRegistered).length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-001', source: 'microsoft-365', collectedAt: new Date(), description: `Microsoft 365: ${mfaRegistered}/${users.length} users MFA registered.`, metadata: { contentHash: '', totalUsers: users.length, mfaRegistered } });
        collected++;
      }
      const caResp = await fetch('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies?$top=50', { headers });
      if (caResp.ok) {
        const caData = await caResp.json();
        const enabled = (caData.value || []).filter((p: any) => p.state === 'enabled').length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-002', source: 'microsoft-365', collectedAt: new Date(), description: `Microsoft 365: ${enabled} Conditional Access policies enabled.`, metadata: { contentHash: '', enabledCAPolicies: enabled } });
        collected++;
      }
      const scoreResp = await fetch('https://graph.microsoft.com/v1.0/security/secureScores?$top=1', { headers });
      if (scoreResp.ok) {
        const scoreData = await scoreResp.json();
        const score = scoreData.value?.[0];
        if (score) {
          await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-CM-002', source: 'microsoft-365', collectedAt: new Date(), description: `Microsoft Secure Score: ${score.currentScore}/${score.maxScore}`, metadata: { contentHash: '', secureScore: score.currentScore, maxScore: score.maxScore } });
          collected++;
        }
      }
    } catch (e: any) { errors.push(`M365: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
