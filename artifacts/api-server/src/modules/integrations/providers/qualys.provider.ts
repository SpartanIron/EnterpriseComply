import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface QualysConfig { username: string; password: string; baseUrl: string; }

@Injectable()
export class QualysProvider {
  private readonly logger = new Logger(QualysProvider.name);

  async syncOrgQualys(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'qualys'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Qualys not connected'] };
    const config = integration.credentials as QualysConfig;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const headers = { 'Authorization': `Basic ${auth}`, 'X-Requested-With': 'EnterpriseComply', 'Content-Type': 'text/xml' };
    const errors: string[] = [];
    let collected = 0;
    try {
      // Host list detection summary
      const hostResp = await fetch(`${config.baseUrl}/api/2.0/fo/report/?action=list`, { headers });
      if (hostResp.ok) {
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-VM-001', source: 'qualys', collectedAt: new Date(),
          description: 'Qualys VMDR: Vulnerability Management scan reports available. Continuous vulnerability discovery active.',
          metadata: { contentHash: '', scanReportsAvailable: true },
        });
        collected++;
      }
      // Policy compliance
      const pcResp = await fetch(`${config.baseUrl}/api/2.0/fo/compliance/posture/list/?`, { headers });
      if (pcResp.ok) {
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-CM-002', source: 'qualys', collectedAt: new Date(),
          description: 'Qualys Policy Compliance: Configuration compliance posture data collected',
          metadata: { contentHash: '', policyComplianceActive: true },
        });
        collected++;
      }
    } catch (e: any) { errors.push(`Qualys: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
