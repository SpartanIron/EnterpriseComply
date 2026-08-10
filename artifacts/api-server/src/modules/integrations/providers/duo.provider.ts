import { Injectable, Logger } from '@nestjs/common';
import { db, orgEvidenceTable, orgIntegrationsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

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
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.integrationKey, 'duo'), eq(t.status, 'connected'))
    });
    if (!integration?.config) return { collected: 0, errors: ['Duo not connected'] };
    const config = (integration.config ?? {}) as unknown as DuoConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      const usersResp = await fetch(`https://${config.apiHostname}/admin/v1/users?limit=100`, { headers: { 'Authorization': this.sign('GET', config.apiHostname, '/admin/v1/users', config) } });
      if (usersResp.ok) {
        const usersData = await usersResp.json() as any; // typed below
        const users = usersData.response || [];
        const enrolled = users.filter((u: any) => u.status === 'active').length;
        const bypass = users.filter((u: any) => u.status === 'bypass').length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-001', source: 'duo', title: 'Duo MFA Enrollment', collectedAt: new Date(), description: `Duo: ${enrolled}/${users.length} users enrolled in MFA. ${bypass} bypass users.`, metadata: { contentHash: '', totalUsers: users.length, enrolledUsers: enrolled, bypassUsers: bypass } });
        collected++;
      }
    } catch (e: any) { errors.push(`Duo: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
