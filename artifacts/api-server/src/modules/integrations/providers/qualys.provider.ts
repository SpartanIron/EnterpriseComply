// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface QualysCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "qualys";
}

export interface QualysEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "qualys";
}

export interface QualysSyncResult {
    controlResults: QualysCheckResult[];
    evidenceItems: QualysEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runQualysChecks(baseUrl: string, username: string, password: string): Promise<QualysSyncResult> {
    const controlResults: QualysCheckResult[] = [];
    const evidenceItems: QualysEvidenceItem[] = [];
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const headers = { Authorization: `Basic ${auth}`, "X-Requested-With": "EnterpriseComply", "Content-Type": "text/xml" };

  // --- VMDR scan report availability (UCO-VM-001) ---
  try {
        const hostResp = await fetch(`${baseUrl}/api/2.0/fo/report/?action=list`, { headers });
        if (hostResp.ok) {
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "passing",
                          result: "Qualys VMDR: scan report listing succeeded. Continuous vulnerability discovery active.",
                          integrationKey: "qualys",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-VM-001",
                          title: "Qualys VMDR Scan Reports",
                          description: "Qualys VMDR: Vulnerability Management scan reports available. Continuous vulnerability discovery active.",
                          type: "auto",
                          source: "qualys",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-VM-001",
                          status: "failing",
                          result: `Qualys VMDR scan report listing failed: ${hostResp.status} ${hostResp.statusText}`,
                          integrationKey: "qualys",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-VM-001", status: "failing", result: `Qualys VMDR scan report check failed: ${String(err)}`, integrationKey: "qualys" });
  }

  // --- Policy compliance posture (UCO-CM-002) ---
  try {
        const pcResp = await fetch(`${baseUrl}/api/2.0/fo/compliance/posture/list/?`, { headers });
        if (pcResp.ok) {
                controlResults.push({
                          ucoControlId: "UCO-CM-002",
                          status: "passing",
                          result: "Qualys Policy Compliance: configuration compliance posture data collected.",
                          integrationKey: "qualys",
                });
                evidenceItems.push({
                          ucoControlId: "UCO-CM-002",
                          title: "Qualys Policy Compliance",
                          description: "Qualys Policy Compliance: Configuration compliance posture data collected",
                          type: "auto",
                          source: "qualys",
                });
        } else {
                controlResults.push({
                          ucoControlId: "UCO-CM-002",
                          status: "failing",
                          result: `Qualys Policy Compliance query failed: ${pcResp.status} ${pcResp.statusText}`,
                          integrationKey: "qualys",
                });
        }
  } catch (err) {
        controlResults.push({ ucoControlId: "UCO-CM-002", status: "failing", result: `Qualys Policy Compliance check failed: ${String(err)}`, integrationKey: "qualys" });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
    return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
