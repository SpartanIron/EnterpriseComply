// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface KnowBe4CheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "knowbe4";
}

export interface KnowBe4EvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "knowbe4";
}

export interface KnowBe4SyncResult {
  controlResults: KnowBe4CheckResult[];
  evidenceItems: KnowBe4EvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

export async function runKnowBe4Checks(apiKey: string, region?: string): Promise<KnowBe4SyncResult> {
  const controlResults: KnowBe4CheckResult[] = [];
  const evidenceItems: KnowBe4EvidenceItem[] = [];
  const base = `https://${region || "us"}.api.knowbe4.com`;
  const headers = { Authorization: `Bearer ${apiKey}` };

// --- Security awareness training completion (UCO-ST-002) ---
try {
  const campResp = await fetch(`${base}/v1/training/campaigns?status=complete&per_page=10`, { headers });
  if (campResp.ok) {
    const campaigns = (await campResp.json()) as any;
    const avg = Array.isArray(campaigns) && campaigns.length > 0
    ? Math.round(campaigns.reduce((a: number, c: any) => a + (c.completion_percentage || 0), 0) / campaigns.length)
      : 0;
    const status = avg >= 90 ? "passing" : avg >= 70 ? "warning" : "failing";
    controlResults.push({
      ucoControlId: "UCO-ST-002",
      status,
      result: `KnowBe4: ${campaigns.length} completed training campaigns. Avg completion: ${avg}%.`,
      integrationKey: "knowbe4",
    });
    evidenceItems.push({
      ucoControlId: "UCO-ST-002",
      title: "KnowBe4 -- Training Campaigns",
      description: `KnowBe4: ${campaigns.length} campaigns. Avg completion: ${avg}%.`,
      type: "auto",
      source: "knowbe4",
    });
  } else {
    controlResults.push({
      ucoControlId: "UCO-ST-002",
      status: "failing",
      result: `KnowBe4 training campaign query failed: ${campResp.status} ${campResp.statusText}`,
      integrationKey: "knowbe4",
    });
  }
} catch (err) {
  controlResults.push({ ucoControlId: "UCO-ST-002", status: "failing", result: `KnowBe4 training campaign check failed: ${String(err)}`, integrationKey: "knowbe4" });
}

// --- Phishing simulation click rate (UCO-ST-001) ---
try {
  const phishResp = await fetch(`${base}/v1/phishing/campaigns?per_page=5&status=closed`, { headers });
  if (phishResp.ok) {
    const phishing = (await phishResp.json()) as any;
    const avgClick = Array.isArray(phishing) && phishing.length > 0
    ? Math.round(phishing.reduce((a: number, p: any) => a + (p.pct_clicked || 0), 0) / phishing.length)
      : 0;
    const status = avgClick < 10 ? "passing" : avgClick < 20 ? "warning" : "failing";
    controlResults.push({
      ucoControlId: "UCO-ST-001",
      status,
      result: `KnowBe4 Phishing: avg click rate ${avgClick}%. ${avgClick < 10 ? "Good posture." : "Training recommended."}`,
      integrationKey: "knowbe4",
    });
    evidenceItems.push({
      ucoControlId: "UCO-ST-001",
      title: "KnowBe4 -- Phishing Simulations",
      description: `KnowBe4 Phishing: avg click rate ${avgClick}%. ${avgClick < 10 ? "Good posture." : "Training recommended."}`,
      type: "auto",
      source: "knowbe4",
    });
  } else {
    controlResults.push({
      ucoControlId: "UCO-ST-001",
      status: "failing",
      result: `KnowBe4 phishing campaign query failed: ${phishResp.status} ${phishResp.statusText}`,
      integrationKey: "knowbe4",
    });
  }
} catch (err) {
  controlResults.push({ ucoControlId: "UCO-ST-001", status: "failing", result: `KnowBe4 phishing simulation check failed: ${String(err)}`, integrationKey: "knowbe4" });
}

const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
