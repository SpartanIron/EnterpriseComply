import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface SlackConfig { botToken: string; }

@Injectable()
export class SlackProvider {
  async syncOrgSlack(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'slack'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Slack not connected'] };
    const config = integration.credentials as SlackConfig;
    const headers = { 'Authorization': `Bearer ${config.botToken}` };
    const errors: string[] = [];
    let collected = 0;
    try {
      const teamResp = await fetch('https://slack.com/api/team.info', { headers });
      if (teamResp.ok) {
        const teamData = await teamResp.json();
        if (teamData.ok) {
          await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-DP-003', source: 'slack', collectedAt: new Date(), description: `Slack: SSO ${teamData.team?.sso_provider ? 'enabled' : 'not configured'}. Retention: ${teamData.team?.retention_enabled ? 'enabled' : 'not set'}.`, metadata: { contentHash: '', ssoEnabled: !!teamData.team?.sso_provider, retentionEnabled: teamData.team?.retention_enabled || false } });
          collected++;
        }
      }
      const channelsResp = await fetch('https://slack.com/api/conversations.list?limit=200&types=public_channel', { headers });
      if (channelsResp.ok) {
        const channelsData = await channelsResp.json();
        const channels = channelsData.channels || [];
        const external = channels.filter((c: any) => c.is_ext_shared).length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AC-001', source: 'slack', collectedAt: new Date(), description: `Slack: ${channels.length} channels. ${external} with external sharing enabled.`, metadata: { contentHash: '', channels: channels.length, externalShared: external } });
        collected++;
      }
    } catch (e: any) { errors.push(`Slack: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
