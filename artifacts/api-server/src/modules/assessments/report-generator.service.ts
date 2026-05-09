import { Injectable, Logger } from "@nestjs/common";
import { db, orgAssessmentsTable, orgQuestionnaireItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AssessmentsService, ASSESSMENT_TEMPLATES } from "./assessments.service";
// Sprint 4: Cloudflare R2 storage + server-side PDF/HTML report generation
// R2 is S3-compatible. Configure via environment variables:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
// Falls back gracefully if R2 is not configured.

const DOMAIN_META: Record<string, { label: string; icon: string }> = {
  identity:     { label: "Identity",     icon: "👤" },
  devices:      { label: "Devices",      icon: "💻" },
  network:      { label: "Network",      icon: "🌐" },
  applications: { label: "Applications", icon: "⚙️" },
  data:         { label: "Data",         icon: "🗄️" },
  governance:   { label: "Governance",   icon: "📋" },
  compliance:   { label: "Compliance",   icon: "✅" },
  operations:   { label: "Operations",   icon: "🔍" },
};

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  // ── Check if R2 is configured ─────────────────────────────────────────────
  private isR2Configured(): boolean {
    return !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );
  }

  // ── Generate HTML report content from assessment data ─────────────────────
  async generateReportHtml(orgId: number, assessmentId: number): Promise<string> {
    const assessment = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, assessmentId)),
    });
    if (!assessment) throw new Error("Assessment not found");

    const items = assessment.questionnaireId
      ? await db.query.orgQuestionnaireItemsTable.findMany({
          where: and(
            eq(orgQuestionnaireItemsTable.orgId, orgId),
            eq(orgQuestionnaireItemsTable.questionnaireId, assessment.questionnaireId),
          ),
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
        })
      : [];

    const fwMeta = ASSESSMENT_TEMPLATES[assessment.frameworkTarget] ?? {
      label: assessment.frameworkTarget,
      description: "",
    };
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const reportId = `EC-ZTA-${new Date().getFullYear()}-${String(assessmentId).padStart(4, "0")}`;
    const overallScore = assessment.overallScore ? Math.round(assessment.overallScore) : null;
    const domainScores: Record<string, number> = (assessment.domainScores as any) ?? {};

    // Group items by domain
    const itemsByDomain: Record<string, typeof items> = {};
    for (const item of items) {
      const d = item.category || "general";
      if (!itemsByDomain[d]) itemsByDomain[d] = [];
      itemsByDomain[d].push(item);
    }

    const ragBg = assessment.ragStatus === "green" ? "#f0fdf4" : assessment.ragStatus === "amber" ? "#fffbeb" : "#fef2f2";
    const ragText = assessment.ragStatus === "green" ? "#15803d" : assessment.ragStatus === "amber" ? "#92400e" : "#991b1b";

    const domainScoreRows = Object.entries(domainScores).map(([domain, score]) => {
      const meta = DOMAIN_META[domain] ?? { label: domain, icon: "📌" };
      const sc = Math.round(score);
      const barColor = sc >= 70 ? "#16a34a" : sc >= 45 ? "#f59e0b" : "#ef4444";
      return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;font-weight:600;color:#1e293b;">${meta.icon} ${meta.label}</span>
          <span style="font-size:13px;font-weight:700;color:${barColor};">${sc}%</span>
        </div>
        <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
          <div style="height:8px;width:${sc}%;background:${barColor};border-radius:4px;"></div>
        </div>
      </div>`;
    }).join("");

    const questionSections = Object.entries(itemsByDomain).map(([domain, domainItems]) => {
      const meta = DOMAIN_META[domain] ?? { label: domain.charAt(0).toUpperCase() + domain.slice(1), icon: "📌" };
      const domainScore = domainScores[domain];
      const qRows = domainItems.map((item, idx) => `
        <div style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;gap:12px;">
            <span style="font-family:monospace;font-size:11px;color:#94a3b8;font-weight:700;flex-shrink:0;padding-top:2px;">Q${idx + 1}</span>
            <div style="flex:1;">
              <p style="font-size:13px;font-weight:600;color:#1e293b;margin:0 0 6px 0;">${item.question}</p>
              <p style="font-size:13px;color:${item.answer ? "#334155" : "#94a3b8"};margin:0;font-style:${item.answer ? "normal" : "italic"};">${item.answer || "— No answer provided —"}</p>
            </div>
          </div>
        </div>`).join("");

      return `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;overflow:hidden;page-break-inside:avoid;">
          <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;">
            <div>
              <span style="font-size:18px;">${meta.icon}</span>
              <span style="font-size:15px;font-weight:700;color:#0f172a;margin-left:8px;">${meta.label}</span>
            </div>
            ${domainScore !== undefined ? `<span style="font-size:14px;font-weight:700;color:${Math.round(domainScore) >= 70 ? "#16a34a" : Math.round(domainScore) >= 45 ? "#d97706" : "#dc2626"};">${Math.round(domainScore)}%</span>` : ""}
          </div>
          <div style="padding:0 20px;">${qRows}</div>
        </div>`;
    }).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${assessment.clientName} — ${fwMeta.label} — ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.5; }
    @media print {
      body { background: white; }
      @page { size: A4; margin: 12mm; }
      * { print-color-adjust: exact !important; }
    }
  </style>
</head>
<body style="max-width:900px;margin:0 auto;padding:40px 20px;">

  <!-- Cover -->
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#3b82f6 100%);border-radius:16px;padding:48px;margin-bottom:32px;">
    <div style="display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:20px;">CONTROLLED — AUTHORIZED PERSONNEL ONLY</div>
    <h1 style="font-size:28px;font-weight:900;color:white;margin-bottom:8px;">${fwMeta.label}</h1>
    <p style="color:rgba(147,197,253,0.9);font-size:14px;margin-bottom:32px;">${(fwMeta as any).subtitle ?? ""}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.2);">
      <div>
        <p style="color:rgba(147,197,253,0.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Client</p>
        <p style="color:white;font-weight:700;">${assessment.clientName}</p>
        ${assessment.clientCompany ? `<p style="color:rgba(147,197,253,0.8);font-size:12px;">${assessment.clientCompany}</p>` : ""}
      </div>
      <div>
        <p style="color:rgba(147,197,253,0.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Assessment Date</p>
        <p style="color:white;font-weight:700;">${today}</p>
      </div>
      <div>
        <p style="color:rgba(147,197,253,0.8);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Report ID</p>
        <p style="color:white;font-weight:700;font-family:monospace;">${reportId}</p>
        ${overallScore !== null ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);padding:4px 12px;border-radius:20px;margin-top:4px;"><span style="color:white;font-weight:800;">${overallScore}%</span><span style="color:rgba(255,255,255,0.7);font-size:11px;">Overall</span></div>` : ""}
      </div>
    </div>
  </div>

  ${assessment.executiveSummary ? `
  <!-- Executive Summary -->
  <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;overflow:hidden;">
    <div style="padding:14px 20px;background:#0f172a;">
      <span style="color:white;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Executive Summary</span>
      ${assessment.ragStatus ? `<span style="float:right;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${ragBg};color:${ragText};">${assessment.ragStatus === "green" ? "Strong Posture" : assessment.ragStatus === "amber" ? "Moderate Posture" : "At Risk"}</span>` : ""}
    </div>
    <div style="padding:20px;">
      <p style="font-size:14px;color:#475569;line-height:1.7;">${assessment.executiveSummary}</p>
    </div>
  </div>` : ""}

  ${Object.keys(domainScores).length > 0 ? `
  <!-- Domain Scores -->
  <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
      <h2 style="font-size:16px;font-weight:700;color:#0f172a;">Domain Maturity Scores</h2>
      ${overallScore !== null ? `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:24px;font-weight:900;color:${overallScore >= 70 ? "#16a34a" : overallScore >= 45 ? "#d97706" : "#dc2626"};">${overallScore}%</span><span style="font-size:12px;color:#94a3b8;">Overall</span></div>` : ""}
    </div>
    <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">${domainScoreRows}</div>
  </div>` : ""}

  <!-- Q&A Sections -->
  ${questionSections}

  <!-- Footer -->
  <div style="text-align:center;padding:32px 0 16px;border-top:1px solid #e2e8f0;margin-top:24px;">
    <p style="font-weight:700;color:#475569;margin-bottom:4px;">EnterpriseComply — Assessment Report</p>
    <p style="font-size:12px;color:#94a3b8;">Report ID: ${reportId} · Generated: ${today} · ${assessment.clientName} · Confidential</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:4px;">Prepared by ColorCode Solutions — Security Architecture | SDVOSB | Federal Compliant</p>
  </div>

</body>
</html>`;
  }

  // ── Upload HTML to Cloudflare R2 ──────────────────────────────────────────
  async uploadToR2(key: string, htmlContent: string): Promise<string> {
    if (!this.isR2Configured()) {
      this.logger.warn("R2 not configured — skipping upload. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.");
      return "";
    }

    const accountId = process.env.R2_ACCOUNT_ID!;
    const bucketName = process.env.R2_BUCKET_NAME!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

    // R2 endpoint
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const url = `${endpoint}/${bucketName}/${key}`;

    // AWS Signature V4 for R2 (S3-compatible)
    const { createHmac, createHash } = await import("crypto");
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").substring(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").substring(0, 15) + "Z";
    const region = "auto";
    const service = "s3";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const body = Buffer.from(htmlContent, "utf-8");
    const bodyHash = createHash("sha256").update(body).digest("hex");

    const headers: Record<string, string> = {
      "content-type": "text/html; charset=utf-8",
      "host": `${accountId}.r2.cloudflarestorage.com`,
      "x-amz-content-sha256": bodyHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
    const canonicalRequest = [`PUT`, `/${bucketName}/${key}`, "", canonicalHeaders, signedHeaders, bodyHash].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");

    const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: { ...headers, Authorization: authorization },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`R2 upload failed: ${response.status} ${text}`);
    }

    // Return the key (not a signed URL — we use the key to generate signed URLs on demand)
    return key;
  }

  // ── Generate a time-limited presigned download URL for R2 ─────────────────
  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.isR2Configured()) return "";

    const accountId = process.env.R2_ACCOUNT_ID!;
    const bucketName = process.env.R2_BUCKET_NAME!;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;

    const { createHmac, createHash } = await import("crypto");
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").substring(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").substring(0, 15) + "Z";
    const region = "auto";
    const service = "s3";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKeyId}/${credentialScope}`;

    const queryParams = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-SignedHeaders": "host",
    });

    const canonicalRequest = [
      "GET",
      `/${bucketName}/${key}`,
      queryParams.toString(),
      `host:${accountId}.r2.cloudflarestorage.com\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
    const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    queryParams.append("X-Amz-Signature", signature);

    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}?${queryParams.toString()}`;
  }

  // ── Main: generate report, upload to R2, store URL on assessment ──────────
  async generateAndStore(orgId: number, assessmentId: number): Promise<{ reportUrl: string; reportKey: string; isR2: boolean }> {
    const html = await this.generateReportHtml(orgId, assessmentId);
    const key = `reports/${orgId}/${assessmentId}/report-${Date.now()}.html`;

    let reportUrl = "";
    let isR2 = false;

    if (this.isR2Configured()) {
      const uploadedKey = await this.uploadToR2(key, html);
      reportUrl = await this.getSignedDownloadUrl(uploadedKey);
      isR2 = true;
      this.logger.log(`Report uploaded to R2: ${key}`);
    } else {
      // No R2: return inline data URL (base64 HTML) — browser-printable
      this.logger.warn("R2 not configured — returning inline HTML for print-to-PDF");
      reportUrl = `data:text/html;base64,${Buffer.from(html).toString("base64")}`;
    }

    // Store the report URL on the assessment record
    await db.update(orgAssessmentsTable)
      .set({ reportUrl, reportGeneratedAt: new Date(), status: "complete", completedAt: new Date() })
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, assessmentId)));

    return { reportUrl, reportKey: key, isR2 };
  }
}
