// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface JiraCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "jira";
}

export interface JiraEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "jira";
}

export interface JiraSyncResult {
    controlResults: JiraCheckResult[];
    evidenceItems: JiraEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runJiraChecks(domain: string, email: string, apiToken: string, projectKey?: string): Promise<JiraSyncResult> {
    const controlResults: JiraCheckResult[] = [];
    const evidenceItems: JiraEvidenceItem[] = [];
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = `https://${domain}.atlassian.net`;
    const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // --- Security vulnerability tickets (UCO-VM-001) ---
  try {
        const jql = projectKey ? `project=${projectKey} AND labels=security AND status!=Done ORDER BY created DESC` : `labels=security AND status!=Done ORDER BY created DESC`;
        const issuesResp = await fetch(`${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50`, { headers });
        if (issuesResp.ok) {
                const issuesData = (await issuesResp.json()) as any;
                const secIssues = issuesData.total || 0;
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "passing",
                          result: `Jira: ${secIssues} open security tickets. Vulnerability remediation tracking active.`,
                          integrationKey: "jira",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-VM-001",
                          title: "Jira -- Security Tickets",
                          description: `Jira: ${secIssues} open security tickets. Vulnerability remediation tracking active.`,
                          type: "auto",
                          source: "jira",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "failing",
                          result: `Jira security ticket query failed: ${issuesResp.status} ${issuesResp.statusText}`,
                          integrationKey: "jira",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-VM-001", status: "failing", result: `Jira security ticket check failed: ${String(err)}`, integrationKey: "jira" });
  }

  // --- Change management tickets (UCO-CM-003) ---
  try {
        const changeJql = `type=Change AND status=Done ORDER BY resolved DESC`;
        const changeResp = await fetch(`${base}/rest/api/3/search?jql=${encodeURIComponent(changeJql)}&maxResults=50`, { headers });
        if (changeResp.ok) {
                const changeData = (await changeResp.json()) as any;
                const completedChanges = changeData.total || 0;
                controlResults.push({
                          ucoControlId: "UCO-CM-003",
                          status: "passing",
                          result: `Jira: Change management workflow active. ${completedChanges} completed change tickets.`,
                          integrationKey: "jira",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-CM-003",
                          title: "Jira -- Change Management",
                          description: `Jira: Change management workflow active. ${completedChanges} completed change tickets.`,
                          type: "auto",
                          source: "jira",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-CM-003",
                          status: "failing",
                          result: `Jira change management query failed: ${changeResp.status} ${changeResp.statusText}`,
                          integrationKey: "jira",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-CM-003", status: "failing", result: `Jira change management check failed: ${String(err)}`, integrationKey: "jira" });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
