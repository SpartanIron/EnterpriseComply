import { Injectable } from "@nestjs/common";
import {
  db, orgFrameworksTable, orgControlResultsTable, orgEvidenceTable,
  ucoControlsTable, organizationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface AuditPackageControl {
  controlId: string;
  controlName: string;
  description?: string;
  status: string;
  result?: string;
  integrationKey?: string;
  lastTestedAt?: Date;
}

export interface AuditPackageEvidence {
  title: string;
  description?: string;
  type: string;
  source: string;
  collectedAt: Date;
  expiresAt?: Date;
  controlId?: string;
  url?: string;
}

export interface AuditPackageOutput {
  orgName: string;
  frameworkName: string;
  frameworkKey: string;
  generatedAt: Date;
  overallScore: number;
  passingControls: AuditPackageControl[];
  failingControls: AuditPackageControl[];
  notTestedControls: AuditPackageControl[];
  evidence: AuditPackageEvidence[];
  testRunSummary: { total: number; passing: number; failing: number; notTested: number };
  html: string;
  json: Record<string, unknown>;
}

@Injectable()
export class AuditPackageService {
  /**
   * Generate a complete audit-ready package for a given org + framework.
   * Returns structured data (JSON), a full HTML report, and a summary — all in one call.
   * The frontend uses this to offer a one-click "Export Audit Package" button.
   */
  async generateAuditPackage(orgId: number, frameworkKey: string): Promise<AuditPackageOutput> {
    const generatedAt = new Date();

    // Get org info
    const org = await db.query.organizationsTable.findFirst({ where: eq(organizationsTable.id, orgId) });
    const orgName = org?.name ?? `Org #${orgId}`;

    // Get framework
    const framework = await db.query.orgFrameworksTable.findFirst({
      where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.frameworkKey, frameworkKey)),
    });
    const frameworkName = framework?.name ?? frameworkKey.toUpperCase();

    // Get all UCO controls for this framework
    const ucoControls = await db.query.ucoControlsTable.findMany();
    const controlMap = new Map(ucoControls.map(c => [c.controlId, c]));

    // Get org control results
    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });

    // Get all evidence
    const allEvidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.collectedAt)],
    });

    // Build control lists
    const passingControls: AuditPackageControl[] = [];
    const failingControls: AuditPackageControl[] = [];
    const notTestedControls: AuditPackageControl[] = [];

    for (const result of controlResults) {
      const uco = controlMap.get(result.ucoControlId);
      const control: AuditPackageControl = {
        controlId: result.ucoControlId,
        controlName: uco?.name ?? result.ucoControlId,
        description: uco?.description ?? undefined,
        status: result.status,
        result: result.result ?? undefined,
        integrationKey: result.integrationKey ?? undefined,
        lastTestedAt: result.lastTestedAt ?? undefined,
      };
      if (result.status === "passing" || result.status === "compliant") {
        passingControls.push(control);
      } else if (result.status === "failing" || result.status === "non_compliant") {
        failingControls.push(control);
      } else {
        notTestedControls.push(control);
      }
    }

    const total = controlResults.length;
    const passing = passingControls.length;
    const failing = failingControls.length;
    const notTested = notTestedControls.length;
    const overallScore = total > 0 ? Math.round((passing / total) * 100) : 0;

    // Build evidence list
    const evidenceItems: AuditPackageEvidence[] = allEvidence.map(e => ({
      title: e.title,
      description: e.description ?? undefined,
      type: e.type,
      source: e.source,
      collectedAt: e.collectedAt,
      expiresAt: e.expiresAt ?? undefined,
      controlId: e.ucoControlId ?? undefined,
      url: e.url ?? undefined,
    }));

    // Generate HTML report
    const html = this.generateHtmlReport({
      orgName, frameworkName, frameworkKey, generatedAt, overallScore,
      passingControls, failingControls, notTestedControls, evidenceItems,
    });

    const json: Record<string, unknown> = {
      metadata: {
        orgName, frameworkName, frameworkKey,
        generatedAt: generatedAt.toISOString(),
        overallScore,
        exportedBy: "EnterpriseComply Audit Package Generator",
        version: "1.0",
      },
      summary: { total, passing, failing, notTested },
      passingControls,
      failingControls,
      notTestedControls,
      evidence: evidenceItems,
    };

    return {
      orgName, frameworkName, frameworkKey, generatedAt, overallScore,
      passingControls, failingControls, notTestedControls,
      evidence: evidenceItems,
      testRunSummary: { total, passing, failing, notTested },
      html,
      json,
    };
  }

  private generateHtmlReport(opts: {
    orgName: string; frameworkName: string; frameworkKey: string; generatedAt: Date;
    overallScore: number; passingControls: AuditPackageControl[];
    failingControls: AuditPackageControl[]; notTestedControls: AuditPackageControl[];
    evidenceItems: AuditPackageEvidence[];
  }): string {
    const { orgName, frameworkName, generatedAt, overallScore, passingControls, failingControls, notTestedControls, evidenceItems } = opts;
    const total = passingControls.length + failingControls.length + notTestedControls.length;
    const scoreColor = overallScore >= 80 ? "#16a34a" : overallScore >= 50 ? "#d97706" : "#dc2626";

    const controlRow = (c: AuditPackageControl, status: string, color: string) =>
      `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${c.controlId}</td><td style="padding:8px;border:1px solid #e5e7eb;">${c.controlName}</td><td style="padding:8px;border:1px solid #e5e7eb;color:${color};font-weight:600;">${status}</td><td style="padding:8px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${c.integrationKey ?? "manual"}</td><td style="padding:8px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleDateString() : "—"}</td></tr>`;

    const evidenceRow = (e: AuditPackageEvidence) =>
      `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${e.title}</td><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${e.controlId ?? "—"}</td><td style="padding:8px;border:1px solid #e5e7eb;">${e.type}</td><td style="padding:8px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${new Date(e.collectedAt).toLocaleDateString()}</td><td style="padding:8px;border:1px solid #e5e7eb;font-size:12px;color:${e.expiresAt && new Date(e.expiresAt) < new Date() ? "#dc2626" : "#6b7280"};">${e.expiresAt ? new Date(e.expiresAt).toLocaleDateString() : "—"}</td></tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Audit Package — ${orgName} — ${frameworkName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; margin: 0; padding: 40px; background: #fff; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 32px 0 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .score-badge { font-size: 48px; font-weight: 700; color: ${scoreColor}; }
  .meta { color: #6b7280; font-size: 14px; margin-top: 8px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0 32px; }
  .stat { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }
  .stat-value { font-size: 28px; font-weight: 700; } .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
  th { background: #f9fafb; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #e5e7eb; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Audit Package — ${frameworkName}</h1>
    <p class="meta"><strong>${orgName}</strong> &bull; Generated ${generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} ${generatedAt.toLocaleTimeString()} UTC</p>
  </div>
  <div style="text-align:right">
    <div class="score-badge">${overallScore}%</div>
    <div style="color:#6b7280;font-size:14px;">Compliance Score</div>
  </div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total Controls</div></div>
  <div class="stat"><div class="stat-value" style="color:#16a34a">${passingControls.length}</div><div class="stat-label">Passing</div></div>
  <div class="stat"><div class="stat-value" style="color:#dc2626">${failingControls.length}</div><div class="stat-label">Failing</div></div>
  <div class="stat"><div class="stat-value" style="color:#6b7280">${notTestedControls.length}</div><div class="stat-label">Not Tested</div></div>
</div>

${failingControls.length > 0 ? `<h2>⚠️ Failing Controls (${failingControls.length})</h2>
<table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th><th>Source</th><th>Last Tested</th></tr></thead><tbody>${failingControls.map(c => controlRow(c, "FAILING", "#dc2626")).join("")}</tbody></table>` : ""}

<h2>✅ Passing Controls (${passingControls.length})</h2>
<table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th><th>Source</th><th>Last Tested</th></tr></thead><tbody>${passingControls.map(c => controlRow(c, "PASSING", "#16a34a")).join("")}</tbody></table>

${notTestedControls.length > 0 ? `<h2>○ Not Tested Controls (${notTestedControls.length})</h2>
<table><thead><tr><th>Control ID</th><th>Name</th><th>Status</th><th>Source</th><th>Last Tested</th></tr></thead><tbody>${notTestedControls.map(c => controlRow(c, "NOT TESTED", "#6b7280")).join("")}</tbody></table>` : ""}

${evidenceItems.length > 0 ? `<h2>📎 Evidence Artifacts (${evidenceItems.length})</h2>
<table><thead><tr><th>Title</th><th>Control</th><th>Type</th><th>Collected</th><th>Expires</th></tr></thead><tbody>${evidenceItems.map(evidenceRow).join("")}</tbody></table>` : ""}

<div class="footer">
  Generated by EnterpriseComply Audit Package Generator &bull; grc.colorcodesolutions.com &bull; ${generatedAt.toISOString()}
</div>
</body>
</html>`;
  }
}
