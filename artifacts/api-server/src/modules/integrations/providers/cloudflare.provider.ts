export interface CloudflareCheckResult {
  ucoControlId: string;
  status: "passing" | "failing" | "warning";
  result: string;
  integrationKey: "cloudflare";
}

export interface CloudflareEvidenceItem {
  ucoControlId: string;
  title: string;
  description: string;
  type: "auto";
  source: "cloudflare";
}

export interface CloudflareSyncResult {
  controlResults: CloudflareCheckResult[];
  evidenceItems: CloudflareEvidenceItem[];
  checksRun: number;
  checksPassed: number;
}

async function cfFetch(apiToken: string, path: string): Promise<unknown> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Cloudflare API ${path}: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { success: boolean; result: unknown; errors?: unknown[] };
  if (!json.success) throw new Error(`Cloudflare API error on ${path}: ${JSON.stringify(json.errors)}`);
  return json.result;
}

export async function runCloudflareChecks(
  apiToken: string,
  zoneId: string,
): Promise<CloudflareSyncResult> {
  const controlResults: CloudflareCheckResult[] = [];
  const evidenceItems: CloudflareEvidenceItem[] = [];

  // --- Check 1: TLS minimum version ---
  try {
    const settings = (await cfFetch(apiToken, `/zones/${zoneId}/settings/min_tls_version`)) as {
      value: string;
    };
    const tlsVersion = settings?.value ?? "1.0";
    const passing = tlsVersion === "1.2" || tlsVersion === "1.3";
    const warning = tlsVersion === "1.1";
    controlResults.push({
      ucoControlId: "UCO-DP-003",
      status: passing ? "passing" : warning ? "warning" : "failing",
      result: `Cloudflare minimum TLS version: ${tlsVersion}. ${passing ? "TLS 1.2+ enforced." : "Upgrade required to TLS 1.2 minimum."}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-DP-003",
      title: "Cloudflare Minimum TLS Version",
      description: `Minimum TLS version is set to ${tlsVersion} on zone ${zoneId}. TLS 1.0 and 1.1 are deprecated protocols with known vulnerabilities.`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-DP-003",
      status: "warning",
      result: `Cloudflare TLS version check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  // --- Check 2: Always Use HTTPS ---
  try {
    const setting = (await cfFetch(apiToken, `/zones/${zoneId}/settings/always_use_https`)) as {
      value: string;
    };
    const enabled = setting?.value === "on";
    controlResults.push({
      ucoControlId: "UCO-NS-002",
      status: enabled ? "passing" : "failing",
      result: `Cloudflare Always Use HTTPS: ${enabled ? "enabled — HTTP requests are redirected to HTTPS" : "DISABLED — HTTP traffic accepted without redirect"}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-NS-002",
      title: "Cloudflare Always Use HTTPS",
      description: `Always Use HTTPS is ${enabled ? "enabled" : "disabled"} for zone ${zoneId}. ${enabled ? "All HTTP requests are automatically redirected to HTTPS." : "Unencrypted HTTP access is permitted."}`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-NS-002",
      status: "warning",
      result: `Cloudflare HTTPS enforcement check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  // --- Check 3: HSTS (HTTP Strict Transport Security) ---
  try {
    const setting = (await cfFetch(apiToken, `/zones/${zoneId}/settings/security_header`)) as {
      value?: { strict_transport_security?: { enabled?: boolean; max_age?: number; include_subdomains?: boolean; preload?: boolean } };
    };
    const hsts = setting?.value?.strict_transport_security;
    const enabled = hsts?.enabled === true;
    const maxAge = hsts?.max_age ?? 0;
    const longEnough = maxAge >= 31536000; // 1 year
    const passing = enabled && longEnough;
    controlResults.push({
      ucoControlId: "UCO-DP-003",
      status: passing ? "passing" : enabled ? "warning" : "failing",
      result: `Cloudflare HSTS: ${enabled ? `enabled (max-age=${maxAge}s${hsts?.include_subdomains ? ", includeSubDomains" : ""}${hsts?.preload ? ", preload" : ""})` : "NOT enabled — browsers may allow HTTP connections"}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-DP-003",
      title: "Cloudflare HSTS Configuration",
      description: `HSTS is ${enabled ? `enabled with max-age ${maxAge} seconds${longEnough ? " (meets 1-year minimum)" : " (below 1-year recommended minimum)"}` : "not configured"} on zone ${zoneId}.`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-DP-003",
      status: "warning",
      result: `Cloudflare HSTS check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  // --- Check 4: WAF managed rules ---
  try {
    const rulesets = (await cfFetch(apiToken, `/zones/${zoneId}/rulesets`)) as Array<{
      id: string;
      name: string;
      phase: string;
      kind: string;
    }>;
    const wafRuleset = (rulesets ?? []).find(
      (r) => r.phase === "http_request_firewall_managed" || r.name?.toLowerCase().includes("cloudflare managed"),
    );
    const hasWaf = !!wafRuleset;
    controlResults.push({
      ucoControlId: "UCO-AS-002",
      status: hasWaf ? "passing" : "failing",
      result: `Cloudflare WAF managed rules: ${hasWaf ? `active (ruleset: ${wafRuleset?.name ?? wafRuleset?.id})` : "NO managed WAF ruleset deployed — applications are unprotected"}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AS-002",
      title: "Cloudflare WAF Managed Rules",
      description: `WAF managed rules are ${hasWaf ? `deployed on zone ${zoneId} (ruleset: ${wafRuleset?.name ?? wafRuleset?.id})` : "not active"} . These rules protect against OWASP Top 10 attacks including SQLi, XSS, and RCE.`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AS-002",
      status: "warning",
      result: `Cloudflare WAF check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  // --- Check 5: DDoS protection level ---
  try {
    const setting = (await cfFetch(apiToken, `/zones/${zoneId}/settings/security_level`)) as {
      value: string;
    };
    const level = setting?.value ?? "off";
    const levelMap: Record<string, number> = { off: 0, essentially_off: 1, low: 2, medium: 3, high: 4, under_attack: 5 };
    const score = levelMap[level] ?? 0;
    const passing = score >= 3;
    controlResults.push({
      ucoControlId: "UCO-AS-002",
      status: passing ? "passing" : score >= 2 ? "warning" : "failing",
      result: `Cloudflare DDoS/security level: ${level} — ${passing ? "adequate protection against automated threats" : "insufficient protection level"}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-AS-002",
      title: "Cloudflare Security Level (DDoS Protection)",
      description: `Cloudflare security level is set to "${level}" for zone ${zoneId}. Medium or higher is recommended for production applications.`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-AS-002",
      status: "warning",
      result: `Cloudflare security level check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  // --- Check 6: SSL/TLS encryption mode ---
  try {
    const setting = (await cfFetch(apiToken, `/zones/${zoneId}/settings/ssl`)) as {
      value: string;
    };
    const sslMode = setting?.value ?? "off";
    const passing = sslMode === "full" || sslMode === "strict";
    const warning = sslMode === "flexible";
    controlResults.push({
      ucoControlId: "UCO-CR-001",
      status: passing ? "passing" : warning ? "warning" : "failing",
      result: `Cloudflare SSL/TLS mode: ${sslMode}. ${passing ? "Full encryption in transit enforced." : sslMode === "flexible" ? "Flexible mode — traffic to origin server is unencrypted." : "SSL disabled."}`,
      integrationKey: "cloudflare",
    });
    evidenceItems.push({
      ucoControlId: "UCO-CR-001",
      title: "Cloudflare SSL/TLS Encryption Mode",
      description: `SSL/TLS mode is "${sslMode}" for zone ${zoneId}. Full or Strict mode encrypts traffic between Cloudflare and the origin server. Flexible mode leaves origin traffic unencrypted.`,
      type: "auto",
      source: "cloudflare",
    });
  } catch (err) {
    controlResults.push({
      ucoControlId: "UCO-CR-001",
      status: "warning",
      result: `Cloudflare SSL mode check failed: ${String(err)}`,
      integrationKey: "cloudflare",
    });
  }

  const checksPassed = controlResults.filter((r) => r.status === "passing").length;
  return { controlResults, evidenceItems, checksRun: controlResults.length, checksPassed };
}
