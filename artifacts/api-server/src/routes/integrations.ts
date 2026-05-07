import { Router } from "express";
import { db, orgIntegrationsTable, orgControlResultsTable, orgEvidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrg, type AuthRequest } from "../middlewares/auth";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const INTEGRATION_CATALOG = [
  { key: "github", name: "GitHub", category: "code", description: "Scan repos, branch protection, member MFA, and access controls.", logoUrl: "https://github.com/favicon.ico", available: true, controls: ["UCO-AI-001", "UCO-AC-001", "UCO-CM-001", "UCO-CM-002"] },
  { key: "google-workspace", name: "Google Workspace", category: "identity", description: "MFA enforcement, admin roles, device policy, and user lifecycle.", available: false, controls: ["UCO-AI-001", "UCO-AC-001", "UCO-AC-005"] },
  { key: "aws", name: "Amazon Web Services", category: "cloud", description: "IAM policies, S3 exposure, CloudTrail, encryption at rest/in-transit.", available: false, controls: ["UCO-AC-001", "UCO-DP-002", "UCO-AL-001"] },
  { key: "okta", name: "Okta", category: "identity", description: "SSO, MFA policies, user provisioning, and password controls.", available: false, controls: ["UCO-AI-001", "UCO-AI-003", "UCO-AI-004"] },
  { key: "jira", name: "Jira", category: "ticketing", description: "Vulnerability ticket tracking, SLA compliance, and change management.", available: false, controls: ["UCO-VM-001", "UCO-IR-002"] },
  { key: "slack", name: "Slack", category: "comms", description: "Access controls and retention policies.", available: false, controls: [] },
  { key: "crowdstrike", name: "CrowdStrike", category: "security", description: "Endpoint detection, vulnerability data, and threat intelligence.", available: false, controls: ["UCO-VM-001", "UCO-VM-002"] },
  { key: "jamf", name: "Jamf", category: "endpoint", description: "Mac/iOS device management, encryption status, and patch compliance.", available: false, controls: ["UCO-CM-003", "UCO-VM-002"] },
  { key: "workday", name: "Workday", category: "hr", description: "Employee roster, background checks, and offboarding.", available: false, controls: ["UCO-ST-001", "UCO-AC-005"] },
];

const router = Router();

router.get("/integrations/catalog", async (_req, res) => {
  res.json({ integrations: INTEGRATION_CATALOG });
});

router.get("/orgs/:orgId/integrations", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const connected = await db.query.orgIntegrationsTable.findMany({
      where: eq(orgIntegrationsTable.orgId, req.orgId!),
    });
    const catalog = INTEGRATION_CATALOG.map(c => ({
      ...c,
      connection: connected.find(i => i.integrationKey === c.key) ?? null,
    }));
    res.json({ integrations: catalog });
  } catch (err) { next(err); }
});

router.get("/integrations/github/connect", requireAuth, async (req: AuthRequest, res) => {
  const { orgId } = req.query;
  const state = Buffer.from(JSON.stringify({ orgId, userId: req.clerkUserId })).toString("base64");
  const scope = "read:org,repo,read:user";
  const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  res.redirect(url);
});

router.get("/integrations/github/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    const { orgId } = JSON.parse(Buffer.from(state, "base64").toString());
    const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/github/callback`;

    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return res.redirect("/?error=github_auth_failed");
    }

    const token = tokenData.access_token;
    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    const ghUser = await userResp.json() as { login: string; name?: string; avatar_url?: string };

    const existing = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, Number(orgId)), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (existing) {
      await db.update(orgIntegrationsTable).set({ accessToken: token, status: "connected", accountLogin: ghUser.login, accountName: ghUser.name, accountAvatarUrl: ghUser.avatar_url, lastSyncStatus: "pending" }).where(eq(orgIntegrationsTable.id, existing.id));
    } else {
      await db.insert(orgIntegrationsTable).values({ orgId: Number(orgId), integrationKey: "github", name: "GitHub", status: "connected", accessToken: token, accountLogin: ghUser.login, accountName: ghUser.name, accountAvatarUrl: ghUser.avatar_url, scopes: ["read:org", "repo", "read:user"] });
    }

    await syncGitHub(Number(orgId), token);
    const basePath = process.env.BASE_PATH?.replace(/\/$/, "") ?? "";
    res.redirect(`${req.protocol}://${req.get("host")}${basePath}/integrations?connected=github`);
  } catch (err) { next(err); }
});

router.post("/orgs/:orgId/integrations/github/sync", requireOrg, async (req: AuthRequest, res, next) => {
  try {
    const integration = await db.query.orgIntegrationsTable.findFirst({
      where: and(eq(orgIntegrationsTable.orgId, req.orgId!), eq(orgIntegrationsTable.integrationKey, "github")),
    });
    if (!integration?.accessToken) return res.status(400).json({ error: "GitHub not connected" });
    await syncGitHub(req.orgId!, integration.accessToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

async function syncGitHub(orgId: number, token: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "ColorComply/1.0" };

  try {
    const [userResp, orgsResp, reposResp] = await Promise.all([
      fetch("https://api.github.com/user", { headers }),
      fetch("https://api.github.com/user/orgs?per_page=10", { headers }),
      fetch("https://api.github.com/user/repos?per_page=50&sort=updated", { headers }),
    ]);

    const [ghUser, ghOrgs, repos] = await Promise.all([
      userResp.json() as Promise<any>,
      orgsResp.json() as Promise<any[]>,
      reposResp.json() as Promise<any[]>,
    ]);

    const orgName = Array.isArray(ghOrgs) && ghOrgs.length > 0 ? ghOrgs[0].login : ghUser.login;
    let mfaRequired = false;
    let reposWithProtection = 0;
    let reposWithReviews = 0;
    let totalRepos = 0;

    if (Array.isArray(repos)) {
      totalRepos = repos.length;
      const branchChecks = repos.slice(0, 10).map(async (repo: any) => {
        try {
          const branchResp = await fetch(`https://api.github.com/repos/${repo.full_name}/branches/${repo.default_branch || "main"}`, { headers });
          if (!branchResp.ok) return null;
          return branchResp.json();
        } catch { return null; }
      });
      const branches = await Promise.all(branchChecks);
      for (const b of branches) {
        if (!b) continue;
        if (b.protection?.enabled) reposWithProtection++;
        if (b.protection?.required_pull_request_reviews) reposWithReviews++;
      }
    }

    if (Array.isArray(ghOrgs) && ghOrgs.length > 0) {
      try {
        const orgDetailResp = await fetch(`https://api.github.com/orgs/${ghOrgs[0].login}`, { headers });
        const orgDetail = await orgDetailResp.json() as any;
        mfaRequired = orgDetail.two_factor_requirement_enabled ?? false;
      } catch {}
    }

    const evidenceItems = [];
    const controlResults = [];

    const mfaStatus = mfaRequired ? "passing" : "failing";
    controlResults.push({ ucoControlId: "UCO-AI-001", status: mfaStatus, result: `GitHub org 2FA requirement: ${mfaRequired ? "enabled" : "disabled"}`, integrationKey: "github" });
    evidenceItems.push({ ucoControlId: "UCO-AI-001", title: `GitHub MFA Status — ${orgName}`, description: `Two-factor authentication ${mfaRequired ? "is required" : "is NOT required"} for GitHub organization.`, type: "auto", source: "github" });

    const branchStatus = totalRepos === 0 || reposWithProtection / totalRepos > 0.7 ? "passing" : "failing";
    controlResults.push({ ucoControlId: "UCO-AC-001", status: branchStatus, result: `${reposWithProtection}/${Math.min(totalRepos, 10)} sampled repos have branch protection`, integrationKey: "github" });
    evidenceItems.push({ ucoControlId: "UCO-AC-001", title: "GitHub Branch Protection Status", description: `${reposWithProtection} of ${Math.min(totalRepos, 10)} sampled repositories have branch protection enabled.`, type: "auto", source: "github" });

    const codeReviewStatus = totalRepos === 0 || reposWithReviews / totalRepos > 0.5 ? "passing" : "failing";
    controlResults.push({ ucoControlId: "UCO-CM-002", status: codeReviewStatus, result: `${reposWithReviews}/${Math.min(totalRepos, 10)} repos require PR reviews`, integrationKey: "github" });

    controlResults.push({ ucoControlId: "UCO-CM-001", status: "passing", result: `${totalRepos} repositories using version control`, integrationKey: "github" });

    for (const cr of controlResults) {
      const { eq: eq2, and: and2 } = await import("drizzle-orm");
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and2(eq2(orgControlResultsTable.orgId, orgId), eq2(orgControlResultsTable.ucoControlId, cr.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable).set({ ...cr, lastTestedAt: new Date() }).where(eq2(orgControlResultsTable.id, existing.id));
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

export default router;
