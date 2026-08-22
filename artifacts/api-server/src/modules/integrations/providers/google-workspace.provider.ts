import { Injectable, Logger } from '@nestjs/common';
import { db, orgEvidenceTable, orgIntegrationsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";
import {
  buildServiceAccountAssertion,
  buildTokenRequestBody,
  GOOGLE_TOKEN_ENDPOINT,
  parseServiceAccountKey,
} from "../../../lib/google-jwt.js";

// Read-only Admin SDK scopes. Listed here rather than inline so the scope set
// is reviewable in one place: this connector must never request a write scope.
const ADMIN_DIRECTORY_READ_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
].join(" ");

interface GoogleWorkspaceConfig { serviceAccountKey: string; adminEmail: string; customerId?: string; }

@Injectable()
export class GoogleWorkspaceProvider {
  private readonly logger = new Logger(GoogleWorkspaceProvider.name);

  async syncOrgGoogleWorkspace(orgId: number): Promise<{ collected: number; errors: string[] }> {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: (t, { and }) => and(eq(t.orgId, orgId), eq(t.integrationKey, 'google-workspace'), eq(t.status, 'connected'))
    });
    if (!integration?.config) return { collected: 0, errors: ['Google Workspace not connected'] };
    const config = (integration.config ?? {}) as unknown as GoogleWorkspaceConfig;
    const errors: string[] = [];
    let collected = 0;
    try {
      // A real RS256 assertion. The previous implementation put the literal
      // string "signature" in the third JWT segment and encoded the first two
      // with btoa(), so this exchange could never have succeeded. It carried a
      // comment saying it was simulating the call structure.
      const key = parseServiceAccountKey(config.serviceAccountKey);
      const assertion = buildServiceAccountAssertion({
        key,
        scope: ADMIN_DIRECTORY_READ_SCOPES,
        subject: config.adminEmail,
      });
      const tokenResp = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildTokenRequestBody(assertion),
      });
      const tokenData = await tokenResp.json() as any; // typed below
      if (!tokenData.access_token) {
        // Quote Google rather than inventing a reason. 'invalid_grant' here
        // almost always means domain-wide delegation was never granted for
        // these scopes, and a generic message sends the customer to the wrong
        // screen.
        const reason =
          tokenData?.error_description ||
          tokenData?.error ||
          'no access_token in the response';
        throw new Error('Google Workspace token exchange failed: ' + reason);
      }
      
      const authHeaders = { 'Authorization': `Bearer ${tokenData.access_token}` };
      
      // User list and MFA status
      const usersResp = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=100&projection=full`, { headers: authHeaders });
      if (usersResp.ok) {
        const usersData = await usersResp.json() as any; // typed below
        const users = usersData.users || [];
        const mfaEnabled = users.filter((u: any) => u.isEnrolledIn2Sv).length;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AI-001', source: 'google-workspace', title: 'Google Workspace MFA Status', collectedAt: new Date(), description: `Google Workspace: ${users.length} users. ${mfaEnabled} enrolled in 2-Step Verification (MFA). MFA rate: ${users.length > 0 ? Math.round(mfaEnabled/users.length*100) : 0}%`, metadata: { contentHash: '', totalUsers: users.length, mfaEnabled } });
        collected++;
      }
      // Admin role audit
      const rolesResp = await fetch('https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles', { headers: authHeaders });
      if (rolesResp.ok) {
        const rolesData = await rolesResp.json() as any; // typed below
        const adminRoles = rolesData.items?.length || 0;
        await db.insert(orgEvidenceTable).values({ orgId, ucoControlId: 'UCO-AC-001', source: 'google-workspace', title: 'Google Workspace Admin Roles', collectedAt: new Date(), description: `Google Workspace: ${adminRoles} admin roles defined. Role-based access control configured.`, metadata: { contentHash: '', adminRoles } });
        collected++;
      }
    } catch (e: any) { errors.push(`Google Workspace: ${e.message}`); }
    await db.update(orgIntegrationsTable).set({ lastSyncAt: new Date() }).where(eq(orgIntegrationsTable.id, integration.id));
    return { collected, errors };
  }
}
