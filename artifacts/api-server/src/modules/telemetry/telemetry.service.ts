import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, orgEvidenceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

export interface TelemetryPayload {
  format: "json" | "xccdf" | "mof" | "hdf" | "auto";
  source: string;
  integrationKey?: string;
  orgId?: number;
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

// Extract text between two XML tags using string search (avoids regex multiline issues)
function extractTag(xml: string, tag: string): string {
  const open = "<" + tag;
  const close = "</" + tag + ">";
  const start = xml.indexOf(open);
  if (start === -1) return "";
  const contentStart = xml.indexOf(">", start) + 1;
  const end = xml.indexOf(close, contentStart);
  return end === -1 ? "" : xml.slice(contentStart, end).trim();
}

function extractAttr(element: string, attr: string): string {
  const marker = attr + "=\"";
  const start = element.indexOf(marker);
  if (start === -1) return "";
  const valStart = start + marker.length;
  const end = element.indexOf("\"", valStart);
  return end === -1 ? "" : element.slice(valStart, end);
}

function splitRuleResults(xml: string): string[] {
  const tag = "<rule-result";
  const closeTag = "</rule-result>";
  const parts: string[] = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf(tag, pos);
    if (start === -1) break;
    const end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    parts.push(xml.slice(start, end + closeTag.length));
    pos = end + closeTag.length;
  }
  return parts;
}

function xccdfResultToStatus(result: string): "compliant" | "non_compliant" | "not_tested" {
  const r = result.toLowerCase().trim();
  if (r === "pass" || r === "fixed") return "compliant";
  if (r === "fail" || r === "error" || r === "unknown") return "non_compliant";
  return "not_tested";
}

function mapRuleIdToUco(ruleId: string): string | null {
  const id = ruleId.toLowerCase();
  if (id.includes("audit") || id.includes("log")) return "UCO-AL-001";
  if (id.includes("password") || id.includes("auth")) return "UCO-AC-001";
  if (id.includes("encrypt") || id.includes("tls") || id.includes("ssl")) return "UCO-DP-001";
  if (id.includes("mfa") || id.includes("2fa")) return "UCO-AI-001";
  if (id.includes("vuln") || id.includes("patch")) return "UCO-VM-001";
  if (id.includes("firewall") || id.includes("network")) return "UCO-NS-002";
  if (id.includes("backup")) return "UCO-ST-001";
  if (id.includes("access") || id.includes("privilege")) return "UCO-AC-003";
  if (id.includes("change") || id.includes("config") || id.includes("baseline")) return "UCO-CM-001";
  if (id.includes("incident") || id.includes("response")) return "UCO-IR-001";
  return null;
}

function mapDscResourceToUco(resourceId: string, moduleName: string): string | null {
  const id = (resourceId + " " + moduleName).toLowerCase();
  if (id.includes("audit")) return "UCO-AL-001";
  if (id.includes("sqlaudit")) return "UCO-AL-002";
  if (id.includes("password") || id.includes("secpol")) return "UCO-AC-001";
  if (id.includes("encrypt") || id.includes("bitlocker") || id.includes("tde")) return "UCO-DP-001";
  if (id.includes("firewall")) return "UCO-NS-002";
  if (id.includes("patch") || id.includes("update")) return "UCO-VM-001";
  if (id.includes("user") || id.includes("group")) return "UCO-AC-003";
  if (id.includes("service") || id.includes("registry")) return "UCO-CM-001";
  if (id.includes("cert") || id.includes("tls")) return "UCO-DP-003";
  return null;
}

function mapHdfControlToUco(controlId: string, tags: string): string | null {
  const combined = (controlId + " " + tags).toLowerCase();
  if (combined.includes("au-") || combined.includes("audit")) return "UCO-AL-001";
  if (combined.includes("ia-") || combined.includes("mfa")) return "UCO-AI-001";
  if (combined.includes("ac-") || combined.includes("access")) return "UCO-AC-001";
  if (combined.includes("sc-") || combined.includes("encrypt")) return "UCO-DP-001";
  if (combined.includes("si-") || combined.includes("vuln")) return "UCO-VM-001";
  if (combined.includes("cm-") || combined.includes("config")) return "UCO-CM-001";
  if (combined.includes("ir-") || combined.includes("incident")) return "UCO-IR-001";
  if (combined.includes("ra-") || combined.includes("risk")) return "UCO-CR-001";
  if (combined.includes("cp-") || combined.includes("backup")) return "UCO-ST-001";
  return null;
}

function parseXccdf(xmlContent: string, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const ruleResults = splitRuleResults(xmlContent);
  for (const part of ruleResults) {
    const ruleId = extractAttr(part, "idref");
    const resultStr = extractTag(part, "result");
    if (!ruleId || !resultStr) continue;
    const ucoId = mapRuleIdToUco(ruleId);
    if (!ucoId) continue;
    events.push({
      ucoControlId: ucoId,
      status: xccdfResultToStatus(resultStr),
      result: "XCCDF: " + ruleId + " = " + resultStr,
      source,
      integrationKey: "xccdf-scanner",
      evidenceTitle: ruleId,
      evidenceDescription: "SCAP/XCCDF automated check. Rule: " + ruleId + ". Result: " + resultStr,
    });
  }
  return events;
}

function parseDscReport(report: Record<string, unknown>, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const desired = (report.ResourcesInDesiredState ?? []) as Record<string, unknown>[];
  const notDesired = (report.ResourcesNotInDesiredState ?? []) as Record<string, unknown>[];
  for (const res of desired) {
    const resourceId = String(res.ResourceId ?? res.InstanceName ?? "");
    const ucoId = mapDscResourceToUco(resourceId, String(res.ModuleName ?? ""));
    if (!ucoId) continue;
    events.push({ ucoControlId: ucoId, status: "compliant", result: "DSC: " + resourceId + " in desired state",
      source, integrationKey: "dsc-agent", evidenceTitle: "DSC: " + resourceId,
      evidenceDescription: "DSC resource " + resourceId + " is compliant per MOF config." });
  }
  for (const res of notDesired) {
    const resourceId = String(res.ResourceId ?? res.InstanceName ?? "");
    const ucoId = mapDscResourceToUco(resourceId, String(res.ModuleName ?? ""));
    if (!ucoId) continue;
    events.push({ ucoControlId: ucoId, status: "non_compliant", result: "DSC drift: " + resourceId + " " + String(res.Error ?? ""),
      source, integrationKey: "dsc-agent", evidenceTitle: "DSC Drift: " + resourceId,
      evidenceDescription: "DSC resource " + resourceId + " drifted from MOF baseline." });
  }
  return events;
}

function parseHdf(hdf: Record<string, unknown>, source: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const profiles = (hdf.profiles ?? [hdf]) as Record<string, unknown>[];
  for (const profile of profiles) {
    const controls = (profile.controls ?? []) as Record<string, unknown>[];
    for (const ctrl of controls) {
      const results = (ctrl.results ?? []) as Record<string, unknown>[];
      const failed = results.some((r) => r.status === "failed");
      const passed = results.every((r) => r.status === "passed");
      const status = failed ? "non_compliant" : passed ? "compliant" : "not_tested";
      const ucoId = mapHdfControlToUco(String(ctrl.id ?? ""), String(ctrl.tags ?? ""));
      if (!ucoId) continue;
      events.push({ ucoControlId: ucoId, status,
        result: "HDF/InSpec: " + ctrl.id + " = " + status,
        source, integrationKey: "inspec-scanner",
        evidenceTitle: "InSpec: " + String(ctrl.title ?? ctrl.id),
        evidenceDescription: "InSpec control " + ctrl.id + ": " + String(ctrl.desc ?? "") });
    }
  }
  return events;
}

function detectFormat(payload: TelemetryPayload): "json" | "xccdf" | "mof" | "hdf" {
  if (payload.format && payload.format !== "auto") return payload.format as "json" | "xccdf" | "mof" | "hdf";
  if (typeof payload.data === "string") {
    const d = payload.data;
    if (d.includes("<Benchmark") || d.includes("<TestResult") || d.includes("xccdf") || d.includes("<rule-result")) return "xccdf";
    return "json";
  }
  if (typeof payload.data === "object" && payload.data !== null) {
    const d = payload.data as Record<string, unknown>;
    if (d.profiles || (d.controls && Array.isArray(d.controls))) return "hdf";
    if (d.ResourcesInDesiredState || d.ResourcesNotInDesiredState) return "mof";
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
      const raw = Array.isArray(payload.data) ? payload.data : [payload.data];
      for (const item of raw as Record<string, unknown>[]) {
        if (!item || !item.ucoControlId) continue;
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
    if (events.length === 0) return { received: 0, mapped: 0, persisted: 0, events: [] };
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
          type: "automated_scan" as any, source: "telemetry:" + ev.integrationKey,
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
      where: eq(orgEvidenceTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
      limit,
    });
    return { items: evidence.filter(e => e.source?.startsWith("telemetry:")) };
  }
}