import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface VaultConfig { vaultAddr: string; token: string; namespace?: string; }

@Injectable()
export class HashiCorpVaultProvider {
  async syncOrgHashiCorpVault(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({ where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'hashicorp-vault'), eq(t.status, 'active')) });
    if (!integration?.credentials) return { collected: 0, errors: ['Vault not connected'] };
    const config = integration.credentials as VaultConfig;
    const headers: Record<string,string> = { 'X-Vault-Token': config.token };
    if (config.namespace) headers['X-Vault-Namespace'] = config.namespace;
    const errors: string[] = [];
    let collected = 0;
    try {
      const healthResp = await fetch(`${config.vaultAddr}/v1/sys/health`, { headers });
      if (healthResp.ok) {
        const h = await healthResp.json();
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-CM-002', source: 'hashicorp-vault', collectedAt: new Date(), description: `Vault: ${h.initialized ? 'initialized' : 'NOT initialized'}, ${h.sealed ? 'SEALED' : 'unsealed'}. v${h.version}.`, metadata: { contentHash: '', initialized: h.initialized, sealed: h.sealed, version: h.version } });
        collected++;
      }
      const auditResp = await fetch(`${config.vaultAddr}/v1/sys/audit`, { headers });
      if (auditResp.ok) {
        const a = await auditResp.json();
        const devices = Object.keys(a || {}).length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AL-001', source: 'hashicorp-vault', collectedAt: new Date(), description: `Vault: ${devices} audit devices configured. ${devices === 0 ? 'WARNING: No audit logging active' : 'All secret access logged'}.`, metadata: { contentHash: '', auditDevices: devices } });
        collected++;
      }
    } catch (e: any) { errors.push(`Vault: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
