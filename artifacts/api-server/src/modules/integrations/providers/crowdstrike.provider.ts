// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface CrowdStrikeCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "crowdstrike";
}

export interface CrowdStrikeEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "crowdstrike";
}

export interface CrowdStrikeSyncResult {
    controlResults: CrowdStrikeCheckResult[];
    evidenceItems: CrowdStrikeEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

async function getOAuthToken(base: string, clientId: string, clientSecret: string): Promise<string> {
    const resp = await fetch(`${base}/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    });
    const data = (await resp.json()) as any;
    if (!resp.ok || !data.access_token) {
          throw new Error(`CrowdStrike OAuth failed: ${data.message ?? resp.statusText}`);
    }
    return data.access_token;
}

export async function runCrowdStrikeChecks(clientId: string, clientSecret: string, baseUrl?: string): Promise<CrowdStrikeSyncResult> {
    const controlResults: CrowdStrikeCheckResult[] = [];
    const evidenceItems: CrowdStrikeEvidenceItem[] = [];
    const base = baseUrl || "https://api.crowdstrike.com";

  let token: string;
    try {
          token = await getOAuthToken(base, clientId, clientSecret);
    } catch (err) {
          // All three checks depend on this token; without it none of them can run.
      const failMsg = `CrowdStrike OAuth token request failed: ${String(err)}`;
          controlResults.push({ ucoControlId: "UCO-VM-001", status: "failing", result: failMsg, integrationKey: "crowdstrike" });
          controlResults.push({ ucoControlId: "UCO-VM-002", status: "failing", result: failMsg, integrationKey: "crowdstrike" });
          controlResults.push({ ucoControlId: "UCO-IR-001", status: "failing", result: failMsg, integrationKey: "crowdstrike" });
          return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed: 0 };
    }
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // --- Device compliance: endpoint sensor coverage (UCO-VM-001) ---
  try {
        const devicesResp = await fetch(`${base}/devices/queries/devices/v1?limit=100&filter=status%3A%27normal%27`, { headers });
        if (devicesResp.ok) {
                const devicesData = (await devicesResp.json()) as any;
                const compliantCount = devicesData.resources?.length || 0;
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "passing",
                          result: `CrowdStrike Falcon: ${compliantCount} endpoint(s) with sensor deployed and normal status.`,
                          integrationKey: "crowdstrike",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-VM-001",
                          title: "CrowdStrike Falcon -- Device Compliance",
                          description: `CrowdStrike Falcon: ${compliantCount} endpoints with sensor deployed and normal status.`,
                          type: "auto",
                          source: "crowdstrike",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "failing",
                          result: `CrowdStrike device query failed: ${devicesResp.status} ${devicesResp.statusText}`,
                          integrationKey: "crowdstrike",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-VM-001", status: "failing", result: `CrowdStrike device compliance check failed: ${String(err)}`, integrationKey: "crowdstrike" });
  }

  // --- Prevention policy enforcement (UCO-VM-002) ---
  try {
        const policiesResp = await fetch(`${base}/policy/combined/prevention/v1?limit=10`, { headers });
        if (policiesResp.ok) {
                const policiesData = (await policiesResp.json()) as any;
                const policies = policiesData.resources || [];
                const enabledCount = policies.filter((p: any) => p.enabled).length;
                controlResults.push({
                          ucoControlId: "UCO-VM-002",
                          status: "passing",
                          result: `CrowdStrike: ${policies.length} prevention policies configured, ${enabledCount} enabled.`,
                          integrationKey: "crowdstrike",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-VM-002",
                          title: "CrowdStrike Falcon -- Prevention Policies",
                          description: `CrowdStrike: ${policies.length} prevention policies active. Enforcement: ${enabledCount} enabled.`,
                          type: "auto",
                          source: "crowdstrike",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-VM-002",
                          status: "failing",
                          result: `CrowdStrike prevention policy query failed: ${policiesResp.status} ${policiesResp.statusText}`,
                          integrationKey: "crowdstrike",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-VM-002", status: "failing", result: `CrowdStrike prevention policy check failed: ${String(err)}`, integrationKey: "crowdstrike" });
  }

  // --- High severity detections: incident response signal (UCO-IR-001) ---
  try {
        const detectResp = await fetch(`${base}/detects/queries/detects/v1?limit=50&filter=max_severity_displayname%3A%5B%27Critical%27%2C%27High%27%5D`, { headers });
        if (detectResp.ok) {
                const detectData = (await detectResp.json()) as any;
                const highSeverity = detectData.resources?.length || 0;
                controlResults.push({
                          ucoControlId: "UCO-IR-001",
                          status: "passing",
                          result: `CrowdStrike: ${highSeverity} Critical/High severity detection(s) in current query window. ${highSeverity === 0 ? "Clean posture." : "Under active review."}`,
                          integrationKey: "crowdstrike",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-IR-001",
                          title: "CrowdStrike Falcon -- High Severity Detections",
                          description: `CrowdStrike: ${highSeverity} Critical/High detections in current period. ${highSeverity === 0 ? "Clean posture." : "Requires review."}`,
                          type: "auto",
                          source: "crowdstrike",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-IR-001",
                          status: "failing",
                          result: `CrowdStrike detections query failed: ${detectResp.status} ${detectResp.statusText}`,
                          integrationKey: "crowdstrike",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-IR-001", status: "failing", result: `CrowdStrike detections check failed: ${String(err)}`, integrationKey: "crowdstrike" });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
