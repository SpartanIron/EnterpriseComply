// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface Microsoft365CheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "microsoft-365";
}

export interface Microsoft365EvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "microsoft-365";
}

export interface Microsoft365SyncResult {
    controlResults: Microsoft365CheckResult[];
    evidenceItems: Microsoft365EvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
    const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
                  grant_type: "client_credentials",
                  client_id: clientId,
                  client_secret: clientSecret,
                  scope: "https://graph.microsoft.com/.default",
          }),
    });
    const data = (await resp.json()) as any;
    if (!data.access_token) throw new Error("Microsoft 365 OAuth token request failed");
    return data.access_token;
}

export async function runMicrosoft365Checks(tenantId: string, clientId: string, clientSecret: string): Promise<Microsoft365SyncResult> {
    const controlResults: Microsoft365CheckResult[] = [];
    const evidenceItems: Microsoft365EvidenceItem[] = [];

  let headers: Record<string, string>;
    try {
          const token = await getGraphToken(tenantId, clientId, clientSecret);
          headers = { Authorization: `Bearer ${token}` };
    } catch (err) {
          const msg = `Microsoft 365 OAuth token request failed: ${String(err)}`;
          return {
                  controlResults: [
                    { ucoControlId: "UCO-AI-001", status: "failing", result: msg, integrationKey: "microsoft-365" },
                    { ucoControlId: "UCO-AI-002", status: "failing", result: msg, integrationKey: "microsoft-365" },
                    { ucoControlId: "UCO-CM-002", status: "failing", result: msg, integrationKey: "microsoft-365" },
                          ],
                  evidenceItems: [],
                  checksRun: 3,
                  checksPassed: 0,
          };
    }

  // --- MFA registration coverage (UCO-AI-001) ---
  try {
        const authResp = await fetch("https://graph.microsoft.com/v1.0/reports/credentialUserRegistrationDetails?$top=100", { headers });
        if (authResp.ok) {
                const authData = (await authResp.json()) as any;
                const users = authData.value || [];
                const mfaRegistered = users.filter((u: any) => u.isMfaRegistered).length;
                const pct = users.length > 0 ? Math.round((mfaRegistered / users.length) * 100) : 0;
                const status = pct >= 95 ? "passing" : pct >= 80 ? "warning" : "failing";
                controlResults.push({
                          ucoControlId: "UCO-AI-001",
                          status,
                          result: `Microsoft 365: ${mfaRegistered}/${users.length} users MFA registered (${pct}%).`,
                          integrationKey: "microsoft-365",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-AI-001",
                          title: "Microsoft 365 -- MFA Registration",
                          description: `Microsoft 365: ${mfaRegistered}/${users.length} users MFA registered (${pct}%).`,
                          type: "auto",
                          source: "microsoft-365",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-AI-001",
                          status: "failing",
                          result: `Microsoft 365 MFA registration query failed: ${authResp.status} ${authResp.statusText}`,
                          integrationKey: "microsoft-365",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-AI-001", status: "failing", result: `Microsoft 365 MFA registration check failed: ${String(err)}`, integrationKey: "microsoft-365" });
  }

  // --- Conditional Access policies enabled (UCO-AI-002) ---
  try {
        const caResp = await fetch("https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies?$top=50", { headers });
        if (caResp.ok) {
                const caData = (await caResp.json()) as any;
                const policies = caData.value || [];
                const enabled = policies.filter((p: any) => p.state === "enabled").length;
                const status = enabled >= 1 ? "passing" : "failing";
                controlResults.push({
                          ucoControlId: "UCO-AI-002",
                          status,
                          result: `Microsoft 365: ${enabled}/${policies.length} Conditional Access policies enabled.`,
                          integrationKey: "microsoft-365",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-AI-002",
                          title: "Microsoft 365 -- Conditional Access Policies",
                          description: `Microsoft 365: ${enabled}/${policies.length} Conditional Access policies enabled.`,
                          type: "auto",
                          source: "microsoft-365",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-AI-002",
                          status: "failing",
                          result: `Microsoft 365 Conditional Access query failed: ${caResp.status} ${caResp.statusText}`,
                          integrationKey: "microsoft-365",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-AI-002", status: "failing", result: `Microsoft 365 Conditional Access check failed: ${String(err)}`, integrationKey: "microsoft-365" });
  }

  // --- Microsoft Secure Score (UCO-CM-002) ---
  try {
        const scoreResp = await fetch("https://graph.microsoft.com/v1.0/security/secureScores?$top=1", { headers });
        if (scoreResp.ok) {
                const scoreData = (await scoreResp.json()) as any;
                const score = scoreData.value?.[0];
                if (score) {
                          const pct = score.maxScore > 0 ? Math.round((score.currentScore / score.maxScore) * 100) : 0;
                          const status = pct >= 80 ? "passing" : pct >= 60 ? "warning" : "failing";
                          controlResults.push({
                                      ucoControlId: "UCO-CM-002",
                                      status,
                                      result: `Microsoft Secure Score: ${score.currentScore}/${score.maxScore} (${pct}%).`,
                                      integrationKey: "microsoft-365",
                          });
                          evidenceItems.push({
                                      ucoControlId: "UCO-CM-002",
                                      title: "Microsoft 365 -- Secure Score",
                                      description: `Microsoft Secure Score: ${score.currentScore}/${score.maxScore} (${pct}%).`,
                                      type: "auto",
                                      source: "microsoft-365",
                          });
                } else {
                          controlResults.push({
                                      ucoControlId: "UCO-CM-002",
                                      status: "failing",
                                      result: "Microsoft 365 Secure Score query returned no scores.",
                                      integrationKey: "microsoft-365",
                          });
                }
        } else {
                controlResults.push({
                          ucoControlId: "UCO-CM-002",
                          status: "failing",
                          result: `Microsoft 365 Secure Score query failed: ${scoreResp.status} ${scoreResp.statusText}`,
                          integrationKey: "microsoft-365",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-CM-002", status: "failing", result: `Microsoft 365 Secure Score check failed: ${String(err)}`, integrationKey: "microsoft-365" });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
