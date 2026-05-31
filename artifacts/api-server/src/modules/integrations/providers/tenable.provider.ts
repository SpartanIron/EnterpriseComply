import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface TenableConfig { accessKey: string; secretKey: string; baseUrl?: string; }

@Injectable()
export class TenableProvider {
  private readonly logger = new Logger(TenableProvider.name);

  async syncOrgTenable(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'tenable'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Tenable not connected'] };
    const config = integration.credentials as TenableConfig;
    const base = config.baseUrl || 'https://cloud.tenable.com';
    const headers = { 'X-ApiKeys': `accessKey=${config.accessKey}; secretKey=${config.secretKey}`, 'Content-Type': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      // Vulnerability summary
      const vulnsResp = await fetch(`${base}/workbenches/vulnerabilities?date_range=30&severity=critical,high`, { headers });
      if (vulnsResp.ok) {
        const vulnsData = await vulnsResp.json();
        const critCount = vulnsData.vulnerabilities?.filter((v: any) => v.severity_id === 4)?.length || 0;
        const highCount = vulnsData.vulnerabilities?.filter((v: any) => v.severity_id === 3)?.length || 0;
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-VM-001', source: 'tenable', collectedAt: new Date(),
          description: `Tenable.io: ${critCount} critical, ${highCount} high vulnerabilities in last 30 days`,
          metadata: { contentHash: '', criticalVulns: critCount, highVulns: highCount },
        });
        collected++;
      }
      // Asset coverage
      const assetsResp = await fetch(`${base}/workbenches/assets?date_range=30`, { headers });
      if (assetsResp.ok) {
        const assetsData = await assetsResp.json();
        const assetCount = assetsData.total_asset_count || 0;
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-CM-001', source: 'tenable', collectedAt: new Date(),
          description: `Tenable.io: ${assetCount} assets scanned. Vulnerability scan coverage active.`,
          metadata: { contentHash: '', totalAssets: assetCount },
        });
        collected++;
      }
      // Compliance checks
      const compResp = await fetch(`${base}/workbenches/assets/vulnerabilities?filter.0.quality=neq&filter.0.filter=plugin.attributes.compliance.check_name&filter.0.value=`, { headers });
      if (compResp.ok) {
        const compData = await compResp.json();
        const compChecks = compData.vulnerabilities?.length || 0;
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: 'UCO-AC-004', source: 'tenable', collectedAt: new Date(),
          description: `Tenable.io compliance: ${compChecks} compliance check findings across scanned assets`,
          metadata: { contentHash: '', complianceFindings: compChecks },
        });
        collected++;
      }
    } catch (e: any) { errors.push(`Tenable: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
