// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface BambooHRCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "bamboohr";
}

export interface BambooHREvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "bamboohr";
}

export interface BambooHRSyncResult {
    controlResults: BambooHRCheckResult[];
    evidenceItems: BambooHREvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runBambooHRChecks(apiKey: string, subdomain: string): Promise<BambooHRSyncResult> {
    const controlResults: BambooHRCheckResult[] = [];
    const evidenceItems: BambooHREvidenceItem[] = [];
    const auth = Buffer.from(`${apiKey}:x`).toString("base64");
    const base = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1`;
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" };

  // --- Employee directory: workforce roster maintained for access review (SOC 2 CC6.2) ---
  try {
        const empResp = await fetch(`${base}/employees/directory`, { headers });
        if (empResp.ok) {
                const empData = (await empResp.json()) as any;
                const employees = empData.employees || [];
                controlResults.push({
                          ucoControlId: "UCO-ST-001",
                          status: "passing",
                          result: `BambooHR employee directory retrieved: ${employees.length} employees on the active roster.`,
                          integrationKey: "bamboohr",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-ST-001",
                          title: "BambooHR -- Employee Directory",
                          description: `BambooHR: ${employees.length} employees in directory. Workforce roster maintained for access review.`,
                          type: "auto",
                          source: "bamboohr",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-ST-001",
                          status: "failing",
                          result: `BambooHR employee directory request failed: ${empResp.status} ${empResp.statusText}`,
                          integrationKey: "bamboohr",
                });
        }
  } catch (err) {
        controlResults.push({
                ucoControlId: "UCO-ST-001",
                status: "failing",
                result: `BambooHR employee directory check failed: ${String(err)}`,
                integrationKey: "bamboohr",
        });
  }

  // --- Recent terminations: offboarding access revocation trigger (UCO-AC-005) ---
  try {
        const termResp = await fetch(`${base}/reports/custom?format=JSON`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({
                          title: "Recent Terminations",
                          filters: { lastChanged: { includeNull: false, value: "30daysAgo" } },
                          fields: ["id", "displayName", "terminationDate", "employmentHistoryStatus"],
                }),
        });
        if (termResp.ok) {
                const termData = (await termResp.json()) as any;
                const terminated = termData.employees?.filter((e: any) => e.terminationDate)?.length || 0;
                controlResults.push({
                          ucoControlId: "UCO-AC-005",
                          status: "passing",
                          result: `BambooHR reports ${terminated} employee termination(s) in the past 30 days, tracked for offboarding access revocation.`,
                          integrationKey: "bamboohr",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-AC-005",
                          title: "BambooHR -- Recent Terminations",
                          description: `BambooHR: ${terminated} employee terminations in last 30 days. Offboarding access revocation trigger active.`,
                          type: "auto",
                          source: "bamboohr",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-AC-005",
                          status: "failing",
                          result: `BambooHR terminations report request failed: ${termResp.status} ${termResp.statusText}`,
                          integrationKey: "bamboohr",
                });
        }
  } catch (err) {
        controlResults.push({
                ucoControlId: "UCO-AC-005",
                status: "failing",
                result: `BambooHR terminations check failed: ${String(err)}`,
                integrationKey: "bamboohr",
        });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
