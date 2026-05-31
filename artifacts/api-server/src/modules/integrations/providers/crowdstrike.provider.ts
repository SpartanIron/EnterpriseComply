import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface CrowdStrikeConfig { clientId: string; clientSecret: string; baseUrl?: string; }

@Injectable()
export class CrowdStrikeProvider {
  private readonly logger = new Logger(CrowdStrikeProvider.name);

  private async getOAuthToken(config: CrowdStrikeConfig): Promise<string> {
    const base = config.baseUrl || 'https://api.crowdstrike.com';
    const resp = await fetch(`${base}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret }),
    });
    const data = await resp.json();
    if (!data.access_token) throw new Error(`CrowdStrike OAuth failed: ${data.message}`);
    return data.access_token;
  }

  async syncOrgCrowdStrike(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'crowdstrike'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['CrowdStrike not connected'] };

    const config = integration.credentials as CrowdStrikeConfig;
    const base = config.baseUrl || 'https://api.crowdstrike.com';
    const errors: string[] = [];
    let collected = 0;

    try {
      const token = await this.getOAuthToken(config);
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

      // 1. Get device compliance status
      const devicesResp = await fetch(`${base}/devices/queries/devices/v1?limit=100&filter=status%3A%27normal%27`, { headers });
      const devicesData = await devicesResp.json();
      const compliantCount = devicesData.resources?.length || 0;

      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: 'UCO-VM-001', source: 'crowdstrike', collectedAt: new Date(),
        description: `CrowdStrike Falcon: ${compliantCount} endpoints with sensor deployed and normal status`,
        metadata: { contentHash: '', compliantDevices: compliantCount, deviceIds: devicesData.resources?.slice(0, 5) },
      });
      collected++;

      // 2. Get prevention policy compliance
      const policiesResp = await fetch(`${base}/policy/combined/prevention/v1?limit=10`, { headers });
      const policiesData = await policiesResp.json();
      const policies = policiesData.resources || [];

      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: 'UCO-VM-002', source: 'crowdstrike', collectedAt: new Date(),
        description: `CrowdStrike: ${policies.length} prevention policies active. Enforcement: ${policies.filter((p: any) => p.enabled).length} enabled`,
        metadata: { contentHash: '', totalPolicies: policies.length, enabledPolicies: policies.filter((p: any) => p.enabled).length },
      });
      collected++;

      // 3. Get recent detections (critical/high)
      const detectResp = await fetch(`${base}/detects/queries/detects/v1?limit=50&filter=max_severity_displayname%3A%5B%27Critical%27%2C%27High%27%5D`, { headers });
      const detectData = await detectResp.json();
      const highSeverity = detectData.resources?.length || 0;

      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: 'UCO-IR-001', source: 'crowdstrike', collectedAt: new Date(),
        description: `CrowdStrike: ${highSeverity} Critical/High detections in current period. ${highSeverity === 0 ? 'Clean posture.' : 'Requires review.'}`,
        metadata: { contentHash: '', highSeverityDetections: highSeverity },
      });
      collected++;

    } catch (e: any) {
      errors.push(`CrowdStrike sync error: ${e.message}`);
    }

    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    this.logger.log(`CrowdStrike sync org ${orgId}: ${collected} evidence items`);
    return { collected, errors };
  }
}
