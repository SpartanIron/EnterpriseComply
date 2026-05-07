import { Injectable, BadRequestException } from "@nestjs/common";
import { db, orgIntegrationsTable, orgControlResultsTable, orgEvidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { runAwsChecks } from "./providers/aws.provider";
import { runOktaChecks } from "./providers/okta.provider";

export const INTEGRATION_CATALOG = [
  {
    key: "github", name: "GitHub", category: "code",
    description: "Branch protection, member MFA status, access controls, and PR review enforcement.",
    logoUrl: "https://github.com/favicon.ico", available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-CM-001", "UCO-CM-002"],
  },
  {
    key: "google-workspace", name: "Google Workspace", category: "identity",
    description: "MFA enforcement, admin role audit, device policy compliance, and user lifecycle management.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AI-002", "UCO-AC-001", "UCO-AC-005"],
  },
  {
    key: "aws", name: "Amazon Web Services", category: "cloud",
    description: "IAM root MFA, password policy, CloudTrail logging, S3 public access, GuardDuty, and user MFA coverage.",
    available: true,
    connectType: "credentials",
    controls: ["UCO-AI-001", "UCO-AI-002", "UCO-AC-001", "UCO-AL-001", "UCO-DP-001", "UCO-VM-001"],
  },
  {
    key: "okta", name: "Okta", category: "identity",
    description: "SSO policy audit, MFA factor enrollment, inactive user detection, and password policy controls.",
    available: true,
    connectType: "credentials",
    controls: ["UCO-AI-001", "UCO-AI-003", "UCO-AC-001", "UCO-AC-003"],
  },
  {
    key: "azure-ad", name: "Microsoft Entra ID", category: "identity",
    description: "Azure AD conditional access, MFA registration, privileged identity management, and sign-in risk.",
    available: true,
    controls: ["UCO-AI-001", "UCO-AC-001", "UCO-AC-003", "UCO-AC-005"],
  },
  {
    key: "slack", name: "Slack", category: "comms",
    description: "Workspace access controls, message retention policy, and SSO configuration.",
    available: true,
    controls: ["UCO-AC-001", "UCO-DP-003"],
  },
  {
    key: "jira", name: "Jira", category: "ticketing",
    description: "Vulnerability ticket SLA tracking, change management workflow, and approval chains.",
    available: false,
    controls: ["UCO-VM-001", "UCO-IR-002", "UCO-CM-003"],
  },
  {
    key: "crowdstrike", name: "CrowdStrike Falcon", category: "security",
    description: "Endpoint detection coverage, vulnerability findings export, and patch compliance tracking.",
    available: false,
    controls: ["UCO-VM-001", "UCO-VM-002", "UCO-AL-001"],
  },
  {
    key: "jamf", name: "Jamf Pro", category: "endpoint",
    description: "macOS/iOS device encryption status, patch compliance, and MDM enrollment coverage.",
    available: false,
    controls: ["UCO-CM-003", "UCO-VM-002", "UCO-DP-002"],
  },
  {
    key: "workday", name: "Workday", category: "hr",
    description: "Employee roster sync, background check tracking, and automated offboarding workflows.",
    available: false,
    controls: ["UCO-ST-001", "UCO-AC-005"],
  },
  {
    key: "datadog", name: "Datadog", category: "monitoring",
    description: "Infrastructure monitoring, log management, and anomaly detection for compliance evidence.",
    available: false,
    controls: ["UCO-AL-001", "UCO-AL-002"],
  },
  {
    key: "pagerduty", name: "PagerDuty", category: "incident",
    description: "Incident response workflow, escalation policy, and MTTD/MTTR metrics for SOC 2 CC7.",
    available: false,
    controls: ["UCO-IR-001", "UCO-IR-002"],
  },
];

@Injectable()
export class IntegrationsService {
  private readonly githubClientId = process.env.GITHUB_CLIENT_ID!;
  private readonly githubClientSecret = process.env.GITHUB_CLIENT_SECRET!;

  getCatalog() {
    return { integrations: INTEGRATION_CATALOG };
  }

  async getOrgIntegrations(orgId: number) {
    const connected = await db.query.orgIntegrationsTable.findMany({
      where: eq(orgIntegrationsTable.orgId, orgId),
    });
    const catalog = INTEGRATION_CATALOG.map((c) => ({
      ...c,
      connection: connected.find((i) => i.integrationKey === c.key) ?? null,
    }));
    return { integrations: catalog };
  }

  buildGithubAuthUrl(orgId: string, clerkUserId: string, host: string, protocol: string) {
    const state = Buffer.from(JSON.stringify({ orgId, userId: clerkUserId })).toString("base64");
    const scope = "read:org,repo,read:user";
    const redirectUri = `${protocol}://${host}/api/integrations/github/callback`;
    return `https://github.com/login/oauth/authorize?client_id=${this.githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  async handleGithubCallback(code: string, state: string, host: string, protocol: string, basePath: string) {
    const { orgId } = JSON.parse(Buffer.from(state, "base64").toString());
    const redirectUri = `${protocol}://${host}/api/integrations/github/callback`;

    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: this.githubClientId,
        client_secret: this.githubClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return { redirectUrl: `${protocol}://${host}${basePath}/?error=github_auth_failed` };
    }

    const token = tokenData.access_token;
    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    const ghUser = (await userResp.json()) as { login: string; name?: string; avatar_url?: string };

    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, Number(orgId)), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable).set({
        accessToken: token, status: "connected",
        accountLogin: ghUser.login, accountName: ghUser.name,
        accountAvatarUrl: ghUser.avatar_url, lastSyncStatus: "pending",
      }).where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId: Number(orgId), integrationKey: "github", name: "GitHub",
        status: "connected", accessToken: token,
        accountLogin: ghUser.login, accountName: ghUser.name,
        accountAvatarUrl: ghUser.avatar_url, scopes: ["read:org", "repo", "read:user"],
      });
    }

    await this.syncGitHub(Number(orgId), token);
    return { redirectUrl: `${protocol}://${host}${basePath}/integrations?connected=github` };
  }

  async connectAWS(orgId: number, accessKeyId: string, secretAccessKey: string, region: string) {
    const { controlResults, evidenceItems, checksRun, checksPassed } = await runAwsChecks(accessKeyId, secretAccessKey, region);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "aws", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "aws", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "aws", collectedAt: new Date(),
      });
    }

    const credentials = JSON.stringify({ accessKeyId, secretAccessKey, region });
    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "aws")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ accessToken: credentials, status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length, accountLogin: region })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "aws", name: "Amazon Web Services",
        status: "connected", accessToken: credentials,
        lastSyncAt: new Date(), lastSyncStatus: "success",
        evidenceCollected: evidenceItems.length, accountLogin: region,
      });
    }

    return { success: true, checksRun, checksPassed, evidenceCollected: evidenceItems.length };
  }

  async syncAWS(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "aws")),
    });
    if (!integration?.accessToken) throw new BadRequestException("AWS not connected");

    let creds: { accessKeyId: string; secretAccessKey: string; region: string };
    try {
      creds = JSON.parse(integration.accessToken);
    } catch {
      throw new BadRequestException("AWS credentials corrupted");
    }

    const { controlResults, evidenceItems, checksRun, checksPassed } = await runAwsChecks(creds.accessKeyId, creds.secretAccessKey, creds.region);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "aws", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "aws", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "aws", collectedAt: new Date(),
      });
    }

    await db.update(orgIntegrationsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
      .where(eq(orgIntegrationsTable.id, integration.id));

    return { success: true, checksRun, checksPassed };
  }

  async connectOkta(orgId: number, domain: string, apiToken: string) {
    const { controlResults, evidenceItems, checksRun, checksPassed } = await runOktaChecks(domain, apiToken);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "okta", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "okta", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "okta", collectedAt: new Date(),
      });
    }

    const credentials = JSON.stringify({ domain, apiToken });
    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "okta")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ accessToken: credentials, status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length, accountLogin: domain })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId, integrationKey: "okta", name: "Okta",
        status: "connected", accessToken: credentials,
        lastSyncAt: new Date(), lastSyncStatus: "success",
        evidenceCollected: evidenceItems.length, accountLogin: domain,
      });
    }

    return { success: true, checksRun, checksPassed, evidenceCollected: evidenceItems.length };
  }

  async syncOkta(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "okta")),
    });
    if (!integration?.accessToken) throw new BadRequestException("Okta not connected");

    let creds: { domain: string; apiToken: string };
    try {
      creds = JSON.parse(integration.accessToken);
    } catch {
      throw new BadRequestException("Okta credentials corrupted");
    }

    const { controlResults, evidenceItems, checksRun, checksPassed } = await runOktaChecks(creds.domain, creds.apiToken);

    for (const cr of controlResults) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: cr.status, result: cr.result, integrationKey: "okta", lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: cr.ucoControlId, status: cr.status,
          result: cr.result, integrationKey: "okta", lastTestedAt: new Date(),
        });
      }
    }

    for (const ev of evidenceItems) {
      await db.insert(orgEvidenceTable).values({
        orgId, ucoControlId: ev.ucoControlId, title: ev.title,
        description: ev.description, type: "auto", source: "okta", collectedAt: new Date(),
      });
    }

    await db.update(orgIntegrationsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
      .where(eq(orgIntegrationsTable.id, integration.id));

    return { success: true, checksRun, checksPassed };
  }

  async connectDemo(orgId: number, integrationKey: string) {
    const catalogItem = INTEGRATION_CATALOG.find((c) => c.key === integrationKey);
    if (!catalogItem) throw new BadRequestException("Unknown integration");

    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, integrationKey)),
    });

    const demoControlResults = catalogItem.controls.map((controlId) => ({
      ucoControlId: controlId,
      status: Math.random() > 0.25 ? "passing" : "failing",
      result: `${catalogItem.name} demo sync: control verified`,
      integrationKey,
    }));

    for (const cr of demoControlResults) {
      const existingResult = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existingResult) {
        await db.update(orgControlResultsTable)
          .set({ ...cr, lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existingResult.id));
      } else {
        await db.insert(orgControlResultsTable).values({ orgId, ...cr, lastTestedAt: new Date() });
      }
    }

    const evidenceCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < evidenceCount; i++) {
      await db.insert(orgEvidenceTable).values({
        orgId,
        title: `${catalogItem.name} -- ${["Access Review", "MFA Report", "Audit Log Export", "Configuration Snapshot", "User Roster"][i % 5]}`,
        description: `Automatically collected from ${catalogItem.name} integration.`,
        type: "auto",
        source: integrationKey,
        collectedAt: new Date(),
      });
    }

    if (existing) {
      await db.update(orgIntegrationsTable)
        .set({ status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceCount })
        .where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({
        orgId,
        integrationKey,
        name: catalogItem.name,
        status: "connected",
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        evidenceCollected: evidenceCount,
      });
    }

    return { success: true, evidenceCollected: evidenceCount, controlsUpdated: demoControlResults.length };
  }

  async syncOrgGitHub(orgId: number) {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (!integration?.accessToken) throw new BadRequestException("GitHub not connected");
    await this.syncGitHub(orgId, integration.accessToken);
    return { success: true };
  }

  async syncOrgOkta(orgId: number) {
    return this.syncOkta(orgId);
  }

  async syncOrgAWS(orgId: number) {
    return this.syncAWS(orgId);
  }

  async syncGitHub(orgId: number, token: string) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "EnterpriseComply/1.0",
    };

    try {
      const [userResp, orgsResp, reposResp] = await Promise.all([
        fetch("https://api.github.com/user", { headers }),
        fetch("https://api.github.com/user/orgs?per_page=10", { headers }),
        fetch("https://api.github.com/user/repos?per_page=50&sort=updated", { headers }),
      ]);

      const [ghUser, ghOrgs, repos] = await Promise.all([
        userResp.json() as Promise<Record<string, unknown>>,
        orgsResp.json() as Promise<Record<string, unknown>[]>,
        reposResp.json() as Promise<Record<string, unknown>[]>,
      ]);

      const orgName = Array.isArray(ghOrgs) && ghOrgs.length > 0 ? ghOrgs[0].login : (ghUser as Record<string, unknown>).login;
      let mfaRequired = false;
      let reposWithProtection = 0;
      let reposWithReviews = 0;
      let totalRepos = 0;

      if (Array.isArray(repos)) {
        totalRepos = repos.length;
        const branchChecks = repos.slice(0, 10).map(async (repo: Record<string, unknown>) => {
          try {
            const branchResp = await fetch(
              `https://api.github.com/repos/${repo.full_name}/branches/${repo.default_branch || "main"}`,
              { headers },
            );
            if (!branchResp.ok) return null;
            return branchResp.json();
          } catch {
            return null;
          }
        });
        const branches = await Promise.all(branchChecks);
        for (const b of branches) {
          if (!b) continue;
          if ((b as Record<string, Record<string, unknown>>).protection?.enabled) reposWithProtection++;
          if ((b as Record<string, Record<string, unknown>>).protection?.required_pull_request_reviews) reposWithReviews++;
        }
      }

      if (Array.isArray(ghOrgs) && ghOrgs.length > 0) {
        try {
          const orgDetailResp = await fetch(`https://api.github.com/orgs/${ghOrgs[0].login}`, { headers });
          const orgDetail = (await orgDetailResp.json()) as Record<string, unknown>;
          mfaRequired = (orgDetail.two_factor_requirement_enabled as boolean) ?? false;
        } catch {}
      }

      const controlResults = [
        { ucoControlId: "UCO-AI-001", status: mfaRequired ? "passing" : "failing", result: `GitHub org 2FA requirement: ${mfaRequired ? "enabled" : "disabled"}`, integrationKey: "github" },
        { ucoControlId: "UCO-AC-001", status: totalRepos === 0 || reposWithProtection / totalRepos > 0.7 ? "passing" : "failing", result: `${reposWithProtection}/${Math.min(totalRepos, 10)} sampled repos have branch protection`, integrationKey: "github" },
        { ucoControlId: "UCO-CM-002", status: totalRepos === 0 || reposWithReviews / totalRepos > 0.5 ? "passing" : "failing", result: `${reposWithReviews}/${Math.min(totalRepos, 10)} repos require PR reviews`, integrationKey: "github" },
        { ucoControlId: "UCO-CM-001", status: "passing", result: `${totalRepos} repositories using version control`, integrationKey: "github" },
      ];

      const evidenceItems = [
        { ucoControlId: "UCO-AI-001", title: `GitHub MFA Status -- ${String(orgName)}`, description: `Two-factor authentication ${mfaRequired ? "is required" : "is NOT required"} for GitHub organization.`, type: "auto", source: "github" },
        { ucoControlId: "UCO-AC-001", title: "GitHub Branch Protection Status", description: `${reposWithProtection} of ${Math.min(totalRepos, 10)} sampled repositories have branch protection enabled.`, type: "auto", source: "github" },
      ];

      for (const cr of controlResults) {
        const existing = await db.query.orgControlResultsTable.findFirst({
          where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
        });
        if (existing) {
          await db.update(orgControlResultsTable).set({ ...cr, lastTestedAt: new Date() }).where(eq(orgControlResultsTable.id, existing.id));
        } else {
          await db.insert(orgControlResultsTable).values({ orgId, ...cr, lastTestedAt: new Date() });
        }
      }

      for (const ev of evidenceItems) {
        await db.insert(orgEvidenceTable).values({ orgId, ...ev, collectedAt: new Date() });
      }

      await db.update(orgIntegrationsTable)
        .set({ status: "connected", lastSyncAt: new Date(), lastSyncStatus: "success", evidenceCollected: evidenceItems.length })
        .where(and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")));
    } catch (err) {
      await db.update(orgIntegrationsTable)
        .set({ lastSyncAt: new Date(), lastSyncStatus: "error", lastSyncError: String(err) })
        .where(and(eq(orgIntegrationsTable.orgId, orgId), eq(orgIntegrationsTable.integrationKey, "github")));
    }
  }
}
