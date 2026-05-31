import { Injectable, BadRequestException } from "@nestjs/common";
import { db, orgControlResultsTable, orgEvidenceTable, orgIntegrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

export interface TelemetryPayload {
  format: "json" | "xccdf" | "mof" | "hdf" | "auto";
  source: string;
  integrationKey?: string;
  data: unknown;
}

export interface NormalizedEvent {
  ucoControlId: string;
  status: "compliant" | "non_compliant" | "not_tested";
  result: string;
  source: string;
  integrationKey: string;
  evidenceTitle?: string;
  evidenceDescription?: string;
}

// XCCDF result rule-result to status mapping
function xccdfResultToStatus(result: string): "compliant" | "non_compliant" | "not_tested" {
  const r = result.toLowerCase();
  if (r === "pass" || r === "fixed") return "compliant";
  if (r === "fail" || r === "error" || r === "unknown") return "non_compliant";
  return "not_tested";
}

// Parse XCCDF XML (SCAP/OpenSCAP/SCC output) to normalized events
function parseXccdf(xmlContent: string, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  // Extract rule-result elements
  const ruleResultRegex = /<rule-result[^>]*idref="([^"]*)"[^>]*>([sS]*?)</rule-result>/g;
  const resultRegex = /<result>(.*?)</result>/;
  const titleRegex = /<title[^>]*>(.*?)</title>/;
  let match;
  while ((match = ruleResultRegex.exec(xmlContent)) !== null) {
    const ruleId = match[1];
    const body = match[2];
    const resultMatch = resultRegex.exec(body);
    const titleMatch = titleRegex.exec(body);
    if (!resultMatch) continue;
    const resultStr = resultMatch[1].trim();
    // Map XCCDF rule IDs to UCO controls via keyword matching
    const ucoId = mapRuleIdToUco(ruleId);
    if (!ucoId) continue;
    events.push({
      ucoControlId: ucoId,
      status: xccdfResultToStatus(resultStr),
      result: `XCCDF: ${ruleId} = ${resultStr}${titleMatch ? " (" + titleMatch[1] + ")" : ""}`,
      source,
      integrationKey: "xccdf-scanner",
      evidenceTitle: titleMatch?.[1] ?? ruleId,
      evidenceDescription: `SCAP/XCCDF automated check. Rule: ${ruleId}. Result: ${resultStr}`,
    });
  }
  return events;
}

// Parse PowerShell DSC MOF compliance report JSON (converted from MOF by DSC agent)
function parseDscReport(report: Record<string, unknown>, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const resources = (report.resources ?? report.ResourcesInDesiredState ?? []) as Record<string, unknown>[];
  const outOfDesired = (report.ResourcesNotInDesiredState ?? []) as Record<string, unknown>[];
  for (const res of resources) {
    const resourceId = String(res.ResourceId ?? res.InstanceName ?? "");
    const ucoId = mapDscResourceToUco(resourceId, String(res.ModuleName ?? ""));
    if (!ucoId) continue;
    events.push({
      ucoControlId: ucoId,
      status: "compliant",
      result: `DSC: ${resourceId} is in desired state`,
      source,
      integrationKey: "dsc-agent",
      evidenceTitle: `DSC Compliance: ${resourceId}`,
      evidenceDescription: `PowerShell DSC resource ${resourceId} is compliant per MOF configuration.`,
    });
  }
  for (const res of outOfDesired) {
    const resourceId = String(res.ResourceId ?? res.InstanceName ?? "");
    const ucoId = mapDscResourceToUco(resourceId, String(res.ModuleName ?? ""));
    if (!ucoId) continue;
    events.push({
      ucoControlId: ucoId,
      status: "non_compliant",
      result: `DSC drift: ${resourceId} not in desired state. ${res.Error ?? ""}`,
      source,
      integrationKey: "dsc-agent",
      evidenceTitle: `DSC Drift Detected: ${resourceId}`,
      evidenceDescription: `PowerShell DSC resource ${resourceId} has drifted from MOF baseline. Remediation required.`,
    });
  }
  return events;
}

// Parse InSpec/HDF (Heimdall Data Format) profiles
function parseHdf(hdf: Record<string, unknown>, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const profiles = (hdf.profiles ?? [hdf]) as Record<string, unknown>[];
  for (const profile of profiles) {
    const controls = (profile.controls ?? []) as Record<string, unknown>[];
    for (const ctrl of controls) {
      const results = (ctrl.results ?? []) as Record<string, unknown>[];
      const passed = results.every((r) => r.status === "passed");
      const failed = results.some((r) => r.status === "failed");
      const status = failed ? "non_compliant" : passed ? "compliant" : "not_tested";
      const ucoId = mapHdfControlToUco(String(ctrl.id ?? ""), String(ctrl.tags ?? ""));
      if (!ucoId) continue;
      events.push({
        ucoControlId: ucoId,
        status,
        result: `HDF/InSpec: ${ctrl.id} - ${ctrl.title ?? ""} = ${status}`,
        source,
        integrationKey: "inspec-scanner",
        evidenceTitle: `InSpec: ${ctrl.title ?? ctrl.id}`,
        evidenceDescription: `InSpec/HDF control ${ctrl.id}: ${ctrl.desc ?? ""}. Result: ${status}.`,
      });
    }
  }
  return events;
}

// UCO mapping helpers
function mapRuleIdToUco(ruleId: string): string | null {
  const id = ruleId.toLowerCase();
  if (id.includes("audit") || id.includes("log")) return "UCO-AL-001";
  if (id.includes("password") || id.includes("pwd") || id.includes("auth")) return "UCO-AC-001";
  if (id.includes("encrypt") || id.includes("tls") || id.includes("ssl") || id.includes("cipher")) return "UCO-DP-001";
  if (id.includes("mfa") || id.includes("multi-factor") || id.includes("2fa")) return "UCO-AI-001";
  if (id.includes("vuln") || id.includes("patch") || id.includes("update")) return "UCO-VM-001";
  if (id.includes("firewall") || id.includes("network") || id.includes("fw")) return "UCO-NS-002";
  if (id.includes("backup") || id.includes("recovery")) return "UCO-ST-001";
  if (id.includes("access") || id.includes("privilege") || id.includes("least")) return "UCO-AC-003";
  if (id.includes("change") || id.includes("config") || id.includes("baseline")) return "UCO-CM-001";
  if (id.includes("incident") || id.includes("response") || id.includes("ir")) return "UCO-IR-001";
  return null;
}

function mapDscResourceToUco(resourceId: string, moduleName: string): string | null {
  const id = (resourceId + " " + moduleName).toLowerCase();
  if (id.includes("audit") || id.includes("log")) return "UCO-AL-001";
  if (id.includes("sqlaudit") || id.includes("sql") && id.includes("audit")) return "UCO-AL-002";
  if (id.includes("password") || id.includes("secpol")) return "UCO-AC-001";
  if (id.includes("encrypt") || id.includes("bitlocker") || id.includes("tde")) return "UCO-DP-001";
  if (id.includes("firewall") || id.includes("netfw")) return "UCO-NS-002";
  if (id.includes("patch") || id.includes("update") || id.includes("wua")) return "UCO-VM-001";
  if (id.includes("user") || id.includes("localuser") || id.includes("group")) return "UCO-AC-003";
  if (id.includes("service") || id.includes("svc")) return "UCO-CM-001";
  if (id.includes("registry") || id.includes("reg")) return "UCO-CM-003";
  if (id.includes("backup") || id.includes("shadow")) return "UCO-ST-001";
  if (id.includes("cert") || id.includes("tls") || id.includes("ssl")) return "UCO-DP-003";
  return null;
}

function mapHdfControlToUco(controlId: string, tags: string): string | null {
  const combined = (controlId + " " + tags).toLowerCase();
  if (combined.includes("au-") || combined.includes("audit")) return "UCO-AL-001";
  if (combined.includes("ia-") || combined.includes("mfa") || combined.includes("identity")) return "UCO-AI-001";
  if (combined.includes("ac-") || combined.includes("access")) return "UCO-AC-001";
  if (combined.includes("sc-") || combined.includes("encrypt") || combined.includes("tls")) return "UCO-DP-001";
  if (combined.includes("si-") || combined.includes("vuln") || combined.includes("patch")) return "UCO-VM-001";
  if (combined.includes("cm-") || combined.includes("config") || combined.includes("change")) return "UCO-CM-001";
  if (combined.includes("ir-") || combined.includes("incident")) return "UCO-IR-001";
  if (combined.includes("ra-") || combined.includes("risk")) return "UCO-CR-001";
  if (combined.includes("cp-") || combined.includes("backup") || combined.includes("recovery")) return "UCO-ST-001";
  return null;
}

// Detect format from payload
function detectFormat(payload: TelemetryPayload): "json" | "xccdf" | "mof" | "hdf" {
  if (payload.format && payload.format !== "auto") return payload.format as "json" | "xccdf" | "mof" | "hdf";
  if (typeof payload.data === "string") {
    const d = payload.data;
    if (d.includes("<Benchmark") || d.includes("<TestResult") || d.includes("xccdf")) return "xccdf";
    return "json";
  }
  if (typeof payload.data === "object" && payload.data !== null) {
    const d = payload.data as Record<string, unknown>;
    if (d.profiles || (d.controls && Array.isArray(d.controls))) return "hdf";
    if (d.ResourcesInDesiredState || d.ResourcesNotInDesiredState || d.resources) return "mof";
  }
  return "json";
}

@Injectable()
export class TelemetryService {
  async ingest(orgId: number, clerkUserId: string, payload: TelemetryPayload): Promise<{
    received: number; mapped: number; persisted: number; events: NormalizedEvent[];
  }> {
    const format = detectFormat(payload);
    let events: NormalizedEvent[] = [];

    if (format === "xccdf" && typeof payload.data === "string") {
      events = parseXccdf(payload.data, payload.source);
    } else if (format === "mof") {
      events = parseDscReport(payload.data as Record<string, unknown>, payload.source);
    } else if (format === "hdf") {
      events = parseHdf(payload.data as Record<string, unknown>, payload.source);
    } else {
      // Generic JSON: expect array of {ucoControlId, status, result} or single object
      const raw = Array.isArray(payload.data) ? payload.data : [payload.data];
      for (const item of raw as Record<string, unknown>[]) {
        if (!item.ucoControlId) continue;
        events.push({
          ucoControlId: String(item.ucoControlId),
          status: (item.status as "compliant" | "non_compliant" | "not_tested") ?? "not_tested",
          result: String(item.result ?? item.message ?? ""),
          source: payload.source,
          integrationKey: payload.integrationKey ?? "api-ingest",
          evidenceTitle: String(item.title ?? item.ucoControlId),
          evidenceDescription: String(item.description ?? item.result ?? ""),
        });
      }
    }

    if (events.length === 0) {
      return { received: 0, mapped: 0, persisted: 0, events: [] };
    }

    // Persist to orgControlResults and orgEvidence
    let persisted = 0;
    for (const ev of events) {
      const existing = await db.query.orgControlResultsTable.findFirst({
        where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.ucoControlId, ev.ucoControlId)),
      });
      if (existing) {
        await db.update(orgControlResultsTable)
          .set({ status: ev.status as any, result: ev.result, integrationKey: ev.integrationKey, lastTestedAt: new Date() })
          .where(eq(orgControlResultsTable.id, existing.id));
      } else {
        await db.insert(orgControlResultsTable).values({
          orgId, ucoControlId: ev.ucoControlId, status: ev.status as any,
          result: ev.result, integrationKey: ev.integrationKey, lastTestedAt: new Date(),
        });
      }
      if (ev.evidenceTitle) {
        await db.insert(orgEvidenceTable).values({
          orgId, ucoControlId: ev.ucoControlId,
          title: ev.evidenceTitle, description: ev.evidenceDescription ?? ev.result,
          type: "automated_scan" as any, source: `telemetry:${ev.integrationKey}`,
          collectedAt: new Date(), expiresAt: new Date(Date.now() + 90 * 86400 * 1000),
        });
      }
      persisted++;
    }

    await writeAuditLog(orgId, clerkUserId, "telemetry.ingest", {
      format, source: payload.source, eventsReceived: events.length, persisted,
    });

    return { received: events.length, mapped: events.length, persisted, events };
  }

  async getIngestLog(orgId: number, limit = 100) {
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: and(eq(orgEvidenceTable.orgId, orgId)),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
      limit,
    });
    return { items: evidence.filter(e => e.source?.startsWith("telemetry:")) };
  }
}
