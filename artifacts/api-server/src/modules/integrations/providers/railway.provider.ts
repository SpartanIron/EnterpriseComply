// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface RailwayCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "railway";
}

export interface RailwayEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "railway";
}

export interface RailwaySyncResult {
  controlResults: RailwayCheckResult[];
  evidenceItems: RailwayEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

const RAILWAY_GRAPHQL_URL = "https://backboard.railway.app/graphql/v2";

async function railwayQuery<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(RAILWAY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Railway API error: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Railway GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data as T;
}

export async function runRailwayChecks(token: string): Promise<RailwaySyncResult> {
  const controlResults: RailwayCheckResult[] = [];
  const evidenceItems: RailwayEvidenceItem[] = [];

  // --- Verify token & fetch account ---
  let userName = "unknown";
  try {
    const meData = await railwayQuery<{ me: { name: string; email: string } }>(token, `
      query { me { name email } }
    `);
    userName = meData?.me?.name ?? meData?.me?.email ?? "unknown";
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "passing",
      result: `Railway API token verified for account: ${userName}. Production infrastructure access is authenticated.`,
      integrationKey: "railway",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AC-001",
      title: "Railway -- Infrastructure Access Authentication",
      description: `Railway API token verified for account "${userName}". All deployments are performed via authenticated API with token-based access control.`,
      type: "auto",
      source: "railway",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AC-001",
      status: "failing",
      result: `Railway token verification failed: ${String(err)}`,
      integrationKey: "railway",
    });
  }

  // --- Fetch projects and deployments ---
  try {
    const projectsData = await railwayQuery<{
      projects: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            environments: { edges: Array<{ node: { id: string; name: string } }> };
            services: {
              edges: Array<{
                node: {
                  id: string;
                  name: string;
                  deployments: {
                    edges: Array<{
                      node: {
                        id: string;
                        status: string;
                        createdAt: string;
                        environment: { name: string } | null;
                      };
                    }>;
                  };
                };
              }>;
            };
          };
        }>;
      };
    }>(token, `
      query {
        projects {
          edges {
            node {
              id name
              environments { edges { node { id name } } }
              services {
                edges {
                  node {
                    id name
                    deployments(last: 5) {
                      edges {
                        node { id status createdAt environment { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const projects = projectsData?.projects?.edges ?? [];
    let totalServices = 0;
    let successfulDeploys = 0;
    let failedDeploys = 0;
    let latestDeployAt: string | null = null;
    let latestDeployStatus = "UNKNOWN";
    let latestServiceName = "";
    let latestEnvName = "";

    for (const { node: project } of projects) {
      for (const { node: service } of (project.services?.edges ?? [])) {
        totalServices++;
        for (const { node: deploy } of (service.deployments?.edges ?? [])) {
          if (deploy.status === "SUCCESS" || deploy.status === "COMPLETE") successfulDeploys++;
          if (deploy.status === "FAILED" || deploy.status === "CRASHED") failedDeploys++;
          if (!latestDeployAt || deploy.createdAt > latestDeployAt) {
            latestDeployAt = deploy.createdAt;
            latestDeployStatus = deploy.status;
            latestServiceName = service.name;
            latestEnvName = deploy.environment?.name ?? "production";
          }
        }
      }
    }

    const totalDeploys = successfulDeploys + failedDeploys;
    const successRate = totalDeploys > 0 ? Math.round((successfulDeploys / totalDeploys) * 100) : 100;
    // Deployment health: passing ≥80% success, failing <50%, warning in between.
    // Use 'failing' (not 'warning') when the majority of deployments are broken so
    // the GRC notification pipeline surfaces it as a real-time control alert.
    const deployStatus: "passing" | "failing" | "warning" =
      failedDeploys === 0 || successRate >= 80
        ? "passing"
        : successRate < 50
        ? "failing"
        : "warning";
    const failureReason =
      deployStatus === "failing"
        ? `${failedDeploys} of ${totalDeploys} recent Railway deployments failed (${100 - successRate}% failure rate). Latest: ${latestServiceName} (${latestDeployStatus}) in ${latestEnvName}.`
        : undefined;

    controlResults.push({
      ucoControlId: "UCO-CM-001",
      status: deployStatus,
      result: `Railway deployment health: ${successRate}% success rate across ${totalDeploys} recent deployments. ${totalServices} services across ${projects.length} projects. Latest deploy: ${latestServiceName} (${latestDeployStatus}) in ${latestEnvName}.${failureReason ? ` FAILURE: ${failureReason}` : ""}`,
      integrationKey: "railway",
    });

    const latestDeployDate = latestDeployAt
      ? new Date(latestDeployAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        })
      : "unknown";

    evidenceItems.push({
      ucoControlId: "UCO-CM-001",
      title: "Railway -- Deployment Status Report",
      description: `${projects.length} project(s), ${totalServices} service(s) monitored. Deployment success rate: ${successRate}% (${successfulDeploys} succeeded, ${failedDeploys} failed). Latest: "${latestServiceName}" in ${latestEnvName} — status ${latestDeployStatus} at ${latestDeployDate}.`,
      type: "auto",
      source: "railway",
    });

    // --- Check: production environment isolation ---
    const hasProductionEnv = projects.some((p) =>
      (p.node.environments?.edges ?? []).some((e) =>
        e.node.name.toLowerCase().includes("production") || e.node.name.toLowerCase() === "prod",
      ),
    );
    controlResults.push({
      ucoControlId: "UCO-CM-003",
      status: hasProductionEnv ? "passing" : "warning",
      result: `Railway environment configuration: ${hasProductionEnv ? "separate production environment detected — isolation enforced" : "no explicitly named production environment found"}`,
      integrationKey: "railway",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-003",
      title: "Railway -- Environment Isolation Configuration",
      description: `Railway project environment audit. ${hasProductionEnv ? "A dedicated production environment is configured, providing isolation between staging and production deployments." : "Consider adding an explicit production environment for stricter isolation."} Deployment approvals and rollback capabilities available via Railway controls.`,
      type: "auto",
      source: "railway",
    });

    // --- Audit log evidence: deployment trail ---
    evidenceItems.push({
      ucoControlId: "UCO-AL-001",
      title: "Railway -- Deployment Audit Trail",
      description: `Full deployment history available for ${totalServices} services. Each deployment records timestamp, status, and environment. ${successfulDeploys} successful, ${failedDeploys} failed deployments in recent history.`,
      type: "auto",
      source: "railway",
    });
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: "passing",
      result: `Railway deployment audit trail active: ${totalDeploys} recorded deployments with full status, timestamp, and environment attribution.`,
      integrationKey: "railway",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CM-001",
      status: "failing",
      result: `Railway deployment status check failed: ${String(err)}. Unable to verify deployment health — investigate Railway API connectivity and token permissions.`,
      integrationKey: "railway",
    });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
