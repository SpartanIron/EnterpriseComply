import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { db, orgIntegrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface OrgCtx { orgId: number; org: any; member: any; }

export interface GwUser {
  id: string;
  primaryEmail: string;
  name: { fullName: string; givenName: string; familyName: string };
  suspended: boolean;
  isAdmin: boolean;
  orgUnitPath: string;
  lastLoginTime: string | null;
}

export interface GwGroup {
  id: string;
  email: string;
  name: string;
  description: string;
  directMembersCount: string;
}

export interface GwSyncResult {
  usersAdded: number;
  groupsAdded: number;
  errors: string[];
}

@Injectable()
export class GoogleWorkspaceService {
  private readonly logger = new Logger(GoogleWorkspaceService.name);

  async getIntegration(orgId: number) {
    const row = await db.query.orgIntegrationsTable.findFirst({
      where: and(
        eq(orgIntegrationsTable.orgId, orgId),
        eq(orgIntegrationsTable.integrationKey, "google_workspace")
      ),
    });
    return row || null;
  }

  async connect(orgId: number, body: { serviceAccountKeyJson: string; domain: string; adminEmail: string }) {
    const { serviceAccountKeyJson, domain, adminEmail } = body;
    let keyObj: any;
    try {
      keyObj = JSON.parse(serviceAccountKeyJson);
    } catch {
      throw new BadRequestException("Invalid JSON for service account key.");
    }
    if (!keyObj.client_email || !keyObj.private_key) {
      throw new BadRequestException("Service account key missing client_email or private_key.");
    }
    const existing = await this.getIntegration(orgId);
    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({
          status: "active",
          accessToken: serviceAccountKeyJson,
          accountLogin: adminEmail,
          accountName: domain,
          metadata: { domain, adminEmail, clientEmail: keyObj.client_email },
          lastSyncError: null,
          lastSyncStatus: "pending",
          updatedAt: new Date(),
        })
        .where(and(
          eq(orgIntegrationsTable.orgId, orgId),
          eq(orgIntegrationsTable.integrationKey, "google_workspace")
        ));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId,
        integrationKey: "google_workspace",
        name: "Google Workspace",
        status: "active",
        accessToken: serviceAccountKeyJson,
        accountLogin: adminEmail,
        accountName: domain,
        scopes: [
          "https://www.googleapis.com/auth/admin.directory.user.readonly",
          "https://www.googleapis.com/auth/admin.directory.group.readonly",
        ],
        metadata: { domain, adminEmail, clientEmail: keyObj.client_email },
        lastSyncStatus: "pending",
      });
    }
    return { connected: true, domain, adminEmail };
  }

  async disconnect(orgId: number) {
    const existing = await this.getIntegration(orgId);
    if (!existing) throw new NotFoundException("Google Workspace integration not found.");
    await db.update(orgIntegrationsTable)
      .set({ status: "disconnected", accessToken: null, refreshToken: null, lastSyncStatus: null, updatedAt: new Date() })
      .where(and(
        eq(orgIntegrationsTable.orgId, orgId),
        eq(orgIntegrationsTable.integrationKey, "google_workspace")
      ));
    return { disconnected: true };
  }

  async sync(orgId: number): Promise<GwSyncResult> {
    const integration = await this.getIntegration(orgId);
    if (!integration || integration.status !== "active") {
      throw new BadRequestException("Google Workspace integration is not active. Connect it first.");
    }
    const meta = integration.metadata as any;
    const domain: string = meta?.domain || "";
    const adminEmail: string = meta?.adminEmail || "";
    const keyJson: string = integration.accessToken || "";
    if (!domain || !adminEmail || !keyJson) {
      throw new BadRequestException("Integration credentials incomplete.");
    }
    let keyObj: any;
    try { keyObj = JSON.parse(keyJson); } catch { throw new BadRequestException("Stored service account key is invalid JSON."); }
    const errors: string[] = [];
    let usersAdded = 0;
    let groupsAdded = 0;
    try {
      const token = await this.getServiceAccountToken(keyObj, adminEmail, [
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/admin.directory.group.readonly",
      ]);
      const usersResp = await fetch(
        "https://admin.googleapis.com/admin/directory/v1/users?domain=" + encodeURIComponent(domain) + "&maxResults=500&orderBy=email",
        { headers: { Authorization: "Bearer " + token } }
      );
      if (usersResp.ok) {
        const usersData = await usersResp.json();
        usersAdded = (usersData.users || []).length;
      } else {
        const errBody = await usersResp.text();
        errors.push("Users API error: " + errBody.slice(0, 200));
      }
      const groupsResp = await fetch(
        "https://admin.googleapis.com/admin/directory/v1/groups?domain=" + encodeURIComponent(domain) + "&maxResults=200",
        { headers: { Authorization: "Bearer " + token } }
      );
      if (groupsResp.ok) {
        const groupsData = await groupsResp.json();
        groupsAdded = (groupsData.groups || []).length;
      } else {
        const errBody = await groupsResp.text();
        errors.push("Groups API error: " + errBody.slice(0, 200));
      }
    } catch (e: any) {
      errors.push("Sync exception: " + (e?.message || String(e)));
    }
    const syncStatus = errors.length > 0 ? "partial" : "success";
    const evidenceCount = usersAdded + groupsAdded;
    await db.update(orgIntegrationsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: syncStatus,
        lastSyncError: errors.length > 0 ? errors.join("; ") : null,
        evidenceCollected: (integration.evidenceCollected || 0) + evidenceCount,
        updatedAt: new Date(),
      })
      .where(and(
        eq(orgIntegrationsTable.orgId, orgId),
        eq(orgIntegrationsTable.integrationKey, "google_workspace")
      ));
    return { usersAdded, groupsAdded, errors };
  }

  private async getServiceAccountToken(keyObj: any, subjectEmail: string, scopes: string[]): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claim = {
      iss: keyObj.client_email,
      sub: subjectEmail,
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signingInput = encode(header) + "." + encode(claim);
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(keyObj.private_key, "base64url");
    const jwt = signingInput + "." + signature;
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
    });
    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      throw new Error("Failed to get service account token: " + err);
    }
    const tokenData = await tokenResp.json();
    return tokenData.access_token;
  }
}
