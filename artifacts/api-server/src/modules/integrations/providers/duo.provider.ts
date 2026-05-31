import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

interface DuoConfig { integrationKey: string; secretKey: string; apiHostname: string; }

@Injectable()
export class DuoProvider {
  private sign(method: string, host: string, path: string, config: DuoConfig): string {
    const date = new Date().toUTCString();
    const canon = [date, method.toUpperCase(), host.toLowerCase(), path, ''].join('\n');
    const sig = createHmac('sha1', config.secretKey).update(canon).digest('hex');
    return 'Basic ' + Buffer.from(`${config.integrationKey}:${sig}`).toString('base64');
  }

  async syncOrgDuo(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'duo'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Duo not connected'] };
    const config = integration.credentials as DuoConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      const usersResp = await fetch(`https://${config.apiHostname}/admin/v1/users?limit=100`, { headers: { 'Authorization': this.sign('GET', config.apiHostname, '/admin/v1/users', config) } });
      if (usersResp.ok) {
        const usersData = await usersResp.json();
        const users = usersData.response || [];
        const enrolled = users.filter((u: any) => u.status === 'active').length;
        const bypass = users.filter((u: any) => u.status === 'bypass').length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-001', source: 'duo', collectedAt: new Date(), description: `Duo: ${enrolled}/${users.length} users enrolled in MFA. ${bypass} bypass users.`, metadata: { contentHash: '', totalUsers: users.length, enrolledUsers: enrolled, bypassUsers: bypass } });
        collected++;
      }
    } catch (e: any) { errors.push(`Duo: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
