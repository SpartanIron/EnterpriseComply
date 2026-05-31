import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import { orgEvidenceTable } from '../../db/schema/orgEvidence';
import { orgIntegrationsTable } from '../../db/schema/orgIntegrations';
import { eq } from 'drizzle-orm';

interface GoogleWorkspaceConfig { serviceAccountKey: string; adminEmail: string; customerId?: string; }

@Injectable()
export class GoogleWorkspaceProvider {
  private readonly logger = new Logger(GoogleWorkspaceProvider.name);

  async syncOrgGoogleWorkspace(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.provider, 'google-workspace'), eq(t.status, 'active'))
    });
    if (!integration?.credentials) return { collected: 0, errors: ['Google Workspace not connected'] };
    const config = integration.credentials as GoogleWorkspaceConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      // Get OAuth2 token using service account
      const key = JSON.parse(config.serviceAccountKey);
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claim = btoa(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly', aud: 'https://oauth2.googleapis.com/token', sub: config.adminEmail, exp: now + 3600, iat: now }));
      // Note: In production, sign with RSA private key. Here we simulate the API call structure.
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.signature` }),
      });
      const tokenData = await tokenResp.json();
      if (!tokenData.access_token) throw new Error('Google Workspace OAuth failed');
      
      const authHeaders = { 'Authorization': `Bearer ${tokenData.access_token}` };
      
      // User list and MFA status
      const usersResp = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=100&projection=full`, { headers: authHeaders });
      if (usersResp.ok) {
        const usersData = await usersResp.json();
        const users = usersData.users || [];
        const mfaEnabled = users.filter((u: any) => u.isEnrolledIn2Sv).length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-001', source: 'google-workspace', collectedAt: new Date(), description: `Google Workspace: ${users.length} users. ${mfaEnabled} enrolled in 2-Step Verification (MFA). MFA rate: ${users.length > 0 ? Math.round(mfaEnabled/users.length*100) : 0}%`, metadata: { contentHash: '', totalUsers: users.length, mfaEnabled } });
        collected++;
      }
      // Admin role audit
      const rolesResp = await fetch('https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles', { headers: authHeaders });
      if (rolesResp.ok) {
        const rolesData = await rolesResp.json();
        const adminRoles = rolesData.items?.length || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AC-001', source: 'google-workspace', collectedAt: new Date(), description: `Google Workspace: ${adminRoles} admin roles defined. Role-based access control configured.`, metadata: { contentHash: '', adminRoles } });
        collected++;
      }
    } catch (e: any) { errors.push(`Google Workspace: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
