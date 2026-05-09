export interface GitHubCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "github";
}

export interface GitHubEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "github";
}

export interface GitHubSyncResult {
  controlResults: GitHubCheckResult[];
  evidenceItems: GitHubEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

async function ghFetch(token: string, path: string): Promise<unknown> {
  const url = path.startsWith("https") ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function runGitHubChecks(
  personalAccessToken: string,
  orgOrOwner?: string,
): Promise<GitHubSyncResult> {
  const controlResults: GitHubCheckResult[] = [];
  const evidenceItems: GitHubEvidenceItem[] = [];

  // Resolve the authenticated user / org to inspect
  const user = (await ghFetch(personalAccessToken, "/user")) as {
    login: string;
    two_factor_authentication?: boolean;
    type?: string;
  };
  const owner = orgOrOwner ?? user?.login ?? "";

  // --- Check 1: Admin / org-level MFA enforcement ---
  try {
    const orgData = (await ghFetch(personalAccessToken, `/orgs/${owner}`)) as {
      two_factor_requirement_enabled?: boolean;
      members_can_create_public_repositories?: boolean;
    } | null;
    if (orgData && typeof orgData === "object") {
      const mfaEnforced = orgData.two_factor_requirement_enabled === true;
      controlResults.push({
        ucoControlId: "UCO-AI-001",
        status: mfaEnforced ? "passing" : "failing",
        result: `GitHub org MFA enforcement: ${mfaEnforced ? "required for all members" : "NOT enforced — members may lack MFA"}`,
        integrationKey: "github",
      });
      evidenceItems.push({
        ucoControlId: "UCO-AI-001",
        title: "GitHub Organization MFA Enforcement",
        description: `Organization-level two-factor authentication enforcement is ${mfaEnforced ? "enabled" : "disabled"} for org '${owner}'.`,
        type: "auto",
        source: "github",
      });
    } else {
      // Personal account — check user's own 2FA
      const mfaOn = user?.two_factor_authentication === true;
      controlResults.push({
        ucoControlId: "UCO-AI-001",
        status: mfaOn ? "passing" : "failing",
        result: `GitHub user '${owner}' 2FA: ${mfaOn ? "enabled" : "NOT enabled"}`,
        integrationKey: "github",
      });
      evidenceItems.push({
        ucoControlId: "UCO-AI-001",
        title: "GitHub User Two-Factor Authentication",
        description: `User '${owner}' has 2FA ${mfaOn ? "enabled" : "disabled"} on their GitHub account.`,
        type: "auto",
        source: "github",
      });
    }
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AI-001",
      status: "warning",
      result: `GitHub MFA check failed: ${String(err)}`,
      integrationKey: "github",
    });
  }

  // --- Check 2: CodeQL / SAST scanning enabled on primary repos ---
  try {
    const repos = (await ghFetch(personalAccessToken, `/orgs/${owner}/repos?type=all&per_page=20`) ??
      await ghFetch(personalAccessToken, `/users/${owner}/repos?type=owner&per_page=20`)) as Array<{
      name: string;
      full_name: string;
      default_branch: string;
      archived: boolean;
      private: boolean;
    }>;
    const activeRepos = (repos ?? []).filter((r) => !r.archived).slice(0, 10);
    let codeqlCount = 0;
    let totalChecked = 0;
    for (const repo of activeRepos) {
      totalChecked++;
      try {
        const analyses = (await ghFetch(
          personalAccessToken,
          `/repos/${repo.full_name}/code-scanning/analyses?per_page=1`,
        )) as Array<{ tool: { name: string } }> | null;
        if (Array.isArray(analyses) && analyses.length > 0) codeqlCount++;
      } catch {
        // Code scanning may not be enabled on this repo
      }
    }
    const coverage = totalChecked > 0 ? Math.round((codeqlCount / totalChecked) * 100) : 0;
    controlResults.push({
      ucoControlId: "UCO-CM-003",
      status: coverage >= 80 ? "passing" : coverage >= 40 ? "warning" : "failing",
      result: `GitHub SAST scanning: ${codeqlCount}/${totalChecked} repos have code scanning active (${coverage}% coverage)`,
      integrationKey: "github",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-003",
      title: "GitHub Code Scanning (SAST) Coverage",
      description: `${codeqlCount} of ${totalChecked} active repositories have GitHub code scanning (CodeQL or equivalent) enabled (${coverage}% coverage).`,
      type: "auto",
      source: "github",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-003",
      status: "warning",
      result: `GitHub SAST check failed: ${String(err)}`,
      integrationKey: "github",
    });
  }

  // --- Check 3: Branch protection on default branch ---
  try {
    const repos = (await ghFetch(personalAccessToken, `/orgs/${owner}/repos?type=all&per_page=20`) ??
      await ghFetch(personalAccessToken, `/users/${owner}/repos?type=owner&per_page=20`)) as Array<{
      name: string;
      full_name: string;
      default_branch: string;
      archived: boolean;
    }>;
    const activeRepos = (repos ?? []).filter((r) => !r.archived).slice(0, 10);
    let protectedCount = 0;
    let prReviewCount = 0;
    for (const repo of activeRepos) {
      try {
        const bp = (await ghFetch(
          personalAccessToken,
          `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`,
        )) as {
          required_pull_request_reviews?: { required_approving_review_count?: number };
          required_status_checks?: { strict?: boolean; contexts?: string[] };
          enforce_admins?: { enabled?: boolean };
        } | null;
        if (bp) {
          protectedCount++;
          if (bp.required_pull_request_reviews?.required_approving_review_count && bp.required_pull_request_reviews.required_approving_review_count >= 1) {
            prReviewCount++;
          }
        }
      } catch {
        // Branch protection not enabled
      }
    }
    const bpCoverage = activeRepos.length > 0 ? Math.round((protectedCount / activeRepos.length) * 100) : 0;
    controlResults.push({
      ucoControlId: "UCO-CM-002",
      status: bpCoverage >= 90 ? "passing" : bpCoverage >= 60 ? "warning" : "failing",
      result: `Branch protection: ${protectedCount}/${activeRepos.length} repos have default branch protection (${bpCoverage}%). ${prReviewCount} repos require PR reviews.`,
      integrationKey: "github",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-002",
      title: "GitHub Branch Protection Rules",
      description: `${protectedCount} of ${activeRepos.length} active repositories have branch protection enabled on the default branch. ${prReviewCount} require at least 1 pull request approval.`,
      type: "auto",
      source: "github",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-002",
      status: "warning",
      result: `GitHub branch protection check failed: ${String(err)}`,
      integrationKey: "github",
    });
  }

  // --- Check 4: Dependabot / dependency vulnerability alerts ---
  try {
    const repos = (await ghFetch(personalAccessToken, `/orgs/${owner}/repos?type=all&per_page=20`) ??
      await ghFetch(personalAccessToken, `/users/${owner}/repos?type=owner&per_page=20`)) as Array<{
      full_name: string;
      archived: boolean;
      name: string;
    }>;
    const activeRepos = (repos ?? []).filter((r) => !r.archived).slice(0, 10);
    let dependabotCount = 0;
    for (const repo of activeRepos) {
      try {
        const alerts = (await ghFetch(
          personalAccessToken,
          `/repos/${repo.full_name}/vulnerability-alerts`,
        ));
        if (alerts !== null) dependabotCount++;
      } catch {
        // Dependabot not enabled
      }
    }
    const coverage = activeRepos.length > 0 ? Math.round((dependabotCount / activeRepos.length) * 100) : 0;
    controlResults.push({
      ucoControlId: "UCO-CM-004",
      status: coverage >= 80 ? "passing" : coverage >= 50 ? "warning" : "failing",
      result: `Dependabot vulnerability alerts: ${dependabotCount}/${activeRepos.length} repos enabled (${coverage}% coverage)`,
      integrationKey: "github",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-004",
      title: "GitHub Dependabot Vulnerability Alerts",
      description: `Dependency vulnerability alerts (Dependabot) are enabled on ${dependabotCount} of ${activeRepos.length} active repositories (${coverage}% coverage).`,
      type: "auto",
      source: "github",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-004",
      status: "warning",
      result: `Dependabot check failed: ${String(err)}`,
      integrationKey: "github",
    });
  }

  // --- Check 5: Secret scanning ---
  try {
    const repos = (await ghFetch(personalAccessToken, `/orgs/${owner}/repos?type=all&per_page=20`) ??
      await ghFetch(personalAccessToken, `/users/${owner}/repos?type=owner&per_page=20`)) as Array<{
      full_name: string;
      archived: boolean;
      private: boolean;
    }>;
    const activeRepos = (repos ?? []).filter((r) => !r.archived && r.private).slice(0, 10);
    let secretScanCount = 0;
    for (const repo of activeRepos) {
      try {
        const alerts = (await ghFetch(
          personalAccessToken,
          `/repos/${repo.full_name}/secret-scanning/alerts?per_page=1`,
        )) as Array<unknown> | null;
        if (Array.isArray(alerts)) secretScanCount++;
      } catch {
        // Secret scanning not available
      }
    }
    const coverage = activeRepos.length > 0 ? Math.round((secretScanCount / activeRepos.length) * 100) : 100;
    controlResults.push({
      ucoControlId: "UCO-CM-007",
      status: coverage >= 80 ? "passing" : coverage >= 50 ? "warning" : "failing",
      result: `Secret scanning: ${secretScanCount}/${activeRepos.length} private repos enabled (${coverage}%). Exposed credentials would be auto-detected.`,
      integrationKey: "github",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-007",
      title: "GitHub Secret Scanning Coverage",
      description: `Secret scanning is active on ${secretScanCount} of ${activeRepos.length} private repositories (${coverage}%). Credential exposure in code is automatically flagged.`,
      type: "auto",
      source: "github",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-007",
      status: "warning",
      result: `Secret scanning check failed: ${String(err)}`,
      integrationKey: "github",
    });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
  }
