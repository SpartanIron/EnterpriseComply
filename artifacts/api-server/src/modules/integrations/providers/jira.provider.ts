import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface JiraConfig { domain: string; email: string; apiToken: string; projectKey?: string; }

@Injectable()
export class JiraProvider {
  private readonly logger = new Logger(JiraProvider.name);

  async syncOrgJira(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'jira'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Jira not connected'] };
    const config = integration.credentials as JiraConfig;
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const base = `https://${config.domain}.atlassian.net`;
    const headers = { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
    const errors: string[] = [];
    let collected = 0;
    try {
      // Security vulnerability tickets
      const jql = config.projectKey ? `project=${config.projectKey} AND labels=security AND status!=Done ORDER BY created DESC` : `labels=security AND status!=Done ORDER BY created DESC`;
      const issuesResp = await fetch(`${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50`, { headers });
      if (issuesResp.ok) {
        const issuesData = await issuesResp.json();
        const secIssues = issuesData.total || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-VM-001', source: 'jira', collectedAt: new Date(), description: `Jira: ${secIssues} open security tickets. Vulnerability remediation tracking active.`, metadata: { contentHash: '', openSecurityTickets: secIssues } });
        collected++;
      }
      // Change management tickets
      const changeJql = `type=Change AND status=Done ORDER BY resolved DESC`;
      const changeResp = await fetch(`${base}/rest/api/3/search?jql=${encodeURIComponent(changeJql)}&maxResults=50`, { headers });
      if (changeResp.ok) {
        const changeData = await changeResp.json();
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-CM-003', source: 'jira', collectedAt: new Date(), description: `Jira: Change management workflow active. ${changeData.total || 0} completed change tickets.`, metadata: { contentHash: '', completedChanges: changeData.total || 0 } });
        collected++;
      }
    } catch (e: any) { errors.push(`Jira: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
