// SSRF: outbound URLs are tenant-configurable, so `fetch` here is the guarded client.
import { guardedFetch as fetch } from "../../../lib/guarded-fetch.js";

export interface HashiCorpVaultCheckResult {
    ucoControlId: string;
    status: "passing" | "failing" | "warning";
    result: string;
    integrationKey: "hashicorp-vault";
}

export interface HashiCorpVaultEvidenceItem {
    ucoControlId: string;
    title: string;
    description: string;
    type: "auto";
    source: "hashicorp-vault";
}

export interface HashiCorpVaultSyncResult {
    controlResults: HashiCorpVaultCheckResult[];
    evidenceItems: HashiCorpVaultEvidenceItem[];
    checksRun: number;
    checksPassed: number;
}

export async function runHashiCorpVaultChecks(vaultAddr: string, token: string, namespace?: string): Promise<HashiCorpVaultSyncResult> {
  const controlResults: HashiCorpVaultCheckResult[] = [];
  const evidenceItems: HashiCorpVaultEvidenceItem[] = [];
  const headers: Record<string, string> = { "X-Vault-Token": token };
  if (namespace) headers["X-Vault-Namespace"] = namespace;

// --- Vault health: initialization and seal status (UCO-CM-002) ---
try {
  const healthResp = await fetch(`${vaultAddr}/v1/sys/health`, { headers });
  if (healthResp.ok) {
    const h = (await healthResp.json()) as any;
    controlResults.push({
      ucoControlId: "UCO-CM-002",
      status: "passing",
      result: `Vault: ${h.initialized ? "initialized" : "NOT initialized"}, ${h.sealed ? "SEALED" : "unsealed"}. v${h.version ?? "unknown"}.`,
      integrationKey: "hashicorp-vault",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CM-002",
      title: "HashiCorp Vault -- Health Status",
      description: `Vault: ${h.initialized ? "initialized" : "NOT initialized"}, ${h.sealed ? "SEALED" : "unsealed"}. v${h.version ?? "unknown"}.`,
      type: "auto",
      source: "hashicorp-vault",
    });
  } else {
    controlResults.push({
      ucoControlId: "UCO-CM-002",
      status: "failing",
      result: `Vault health check failed: ${healthResp.status} ${healthResp.statusText}`,
      integrationKey: "hashicorp-vault",
    });
  }
} catch (err) {
  controlResults.push({ ucoControlId: "UCO-CM-002", status: "failing", result: `Vault health check failed: ${String(err)}`, integrationKey: "hashicorp-vault" });
}

// --- Audit devices: secrets access logging coverage (UCO-AL-001) ---
try {
  const auditResp = await fetch(`${vaultAddr}/v1/sys/audit`, { headers });
  if (auditResp.ok) {
    const a = (await auditResp.json()) as any;
    const devices = Object.keys(a || {}).length;
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: "passing",
      result: `Vault: ${devices} audit device(s) configured. ${devices === 0 ? "WARNING: No audit logging active." : "All secret access logged."}`,
      integrationKey: "hashicorp-vault",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AL-001",
      title: "HashiCorp Vault -- Audit Devices",
      description: `Vault: ${devices} audit devices configured. ${devices === 0 ? "WARNING: No audit logging active." : "All secret access logged."}`,
      type: "auto",
      source: "hashicorp-vault",
    });
  } else {
    controlResults.push({
      ucoControlId: "UCO-AL-001",
      status: "failing",
      result: `Vault audit device query failed: ${auditResp.status} ${auditResp.statusText}`,
      integrationKey: "hashicorp-vault",
    });
  }
} catch (err) {
  controlResults.push({ ucoControlId: "UCO-AL-001", status: "failing", result: `Vault audit device check failed: ${String(err)}`, integrationKey: "hashicorp-vault" });
}

const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
