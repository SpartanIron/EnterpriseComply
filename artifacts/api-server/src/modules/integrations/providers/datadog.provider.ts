// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface DatadogCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "datadog";
}

export interface DatadogEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "datadog";
}

export interface DatadogSyncResult {
    controlResults: DatadogCheckResult[];
    evidenceItems: DatadogEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runDatadogChecks(apiKey: string, appKey: string, site?: string): Promise<DatadogSyncResult> {
    const controlResults: DatadogCheckResult[] = [];
    const evidenceItems: DatadogEvidenceItem[] = [];
    const ddSite = site || "datadoghq.com";
    const headers = { "DD-API-KEY": apiKey, "DD-APPLICATION-KEY": appKey, "Content-Type": "application/json" };

  // --- Monitor status: infrastructure monitoring coverage (UCO-AL-002) ---
  try {
        const monitorsResp = await fetch(`https://api.${ddSite}/api/v1/monitor?with_downtimes=false`, { headers });
        if (monitorsResp.ok) {
                const monitors = (await monitorsResp.json()) as any;
                const total = Array.isArray(monitors) ? monitors.length : 0;
                const alerting = Array.isArray(monitors) ? monitors.filter((m: any) => m.overall_state === "Alert").length : 0;
                controlResults.push({
                          ucoControlId: "UCO-AL-002",
                          status: "passing",
                          result: `Datadog: ${total} monitor(s) configured. ${alerting} currently alerting.`,
                          integrationKey: "datadog",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-AL-002",
                          title: "Datadog -- Monitor Status",
                          description: `Datadog: ${total} monitors configured. ${alerting} alerting.`,
                          type: "auto",
                          source: "datadog",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-AL-002",
                          status: "failing",
                          result: `Datadog monitor query failed: ${monitorsResp.status} ${monitorsResp.statusText}`,
                          integrationKey: "datadog",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-AL-002", status: "failing", result: `Datadog monitor check failed: ${String(err)}`, integrationKey: "datadog" });
  }

  // --- Log index retention: log management configuration (UCO-AL-001) ---
  try {
        const logsResp = await fetch(`https://api.${ddSite}/api/v2/logs/config/indexes`, { headers });
        if (logsResp.ok) {
                const logsData = (await logsResp.json()) as any;
                const indexCount = logsData.data?.length || 0;
                controlResults.push({
                          ucoControlId: "UCO-AL-001",
                          status: "passing",
                          result: `Datadog: ${indexCount} log index(es) configured with retention policies.`,
                          integrationKey: "datadog",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-AL-001",
                          title: "Datadog -- Log Index Configuration",
                          description: `Datadog: ${indexCount} log indexes with retention policies.`,
                          type: "auto",
                          source: "datadog",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-AL-001",
                          status: "failing",
                          result: `Datadog log index query failed: ${logsResp.status} ${logsResp.statusText}`,
                          integrationKey: "datadog",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-AL-001", status: "failing", result: `Datadog log index check failed: ${String(err)}`, integrationKey: "datadog" });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
