import { Injectable } from "@nestjs/common";
import { db, orgRisksTable, orgControlResultsTable, ucoControlsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const CONTROL_RISK_SUGGESTIONS: Record<string, { title: string; description: string; category: string; threat: string; asset: string; likelihood: number; impact: number; treatment: string }> = {
  "UCO-AI-001": { title: "Account Takeover via Compromised Credentials", description: "Without MFA, a single compromised password grants full account access to critical systems.", category: "technical", threat: "Credential phishing and brute force attacks", asset: "User accounts and identity systems", likelihood: 4, impact: 5, treatment: "mitigate" },
  "UCO-AI-002": { title: "Privilege Escalation via Over-Provisioned Admin Accounts", description: "Uncontrolled privileged accounts increase blast radius from compromise or insider threat.", category: "technical", threat: "Insider threat and compromised admin accounts", asset: "Administrative access to all systems", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-AC-001": { title: "Unauthorized Access to Sensitive Systems", description: "Without RBAC, users may access data and systems beyond their job function.", category: "technical", threat: "Internal access abuse and broken access control", asset: "Production systems and customer data", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-AC-004": { title: "Stale Access Rights from Departed Employees", description: "Without periodic access reviews, former employees or changed roles retain inappropriate access.", category: "compliance", threat: "Unauthorized access from orphaned accounts", asset: "All organizational systems and data", likelihood: 4, impact: 4, treatment: "mitigate" },
  "UCO-AC-005": { title: "Unauthorized Access by Ex-Employees", description: "Delayed offboarding leaves active accounts for departed personnel, enabling unauthorized access.", category: "technical", threat: "Ex-employee malicious or accidental access", asset: "All corporate systems and data", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-AL-001": { title: "Undetected Security Breach Due to Missing Audit Logs", description: "Without audit logging, security incidents cannot be detected, investigated, or timed accurately.", category: "compliance", threat: "Undetected intrusion and data exfiltration", asset: "All information systems", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-CM-001": { title: "Uncontrolled Code Changes Introducing Vulnerabilities", description: "Without version control, changes to code and infrastructure cannot be tracked or rolled back.", category: "technical", threat: "Unauthorized code modifications and deploy errors", asset: "Application codebase and infrastructure", likelihood: 2, impact: 4, treatment: "mitigate" },
  "UCO-CM-002": { title: "Vulnerable Code Deployed Without Review", description: "Without mandatory code review, security vulnerabilities may be introduced directly to production.", category: "technical", threat: "Security defects in production code", asset: "Production application and customer data", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-CM-003": { title: "Undetected Application Vulnerabilities in Production", description: "Without SAST/DAST scanning, known vulnerabilities in code go undetected until exploited.", category: "technical", threat: "OWASP Top 10 and injection attacks", asset: "Web applications and APIs", likelihood: 4, impact: 4, treatment: "mitigate" },
  "UCO-CM-004": { title: "Supply Chain Attack via Vulnerable Dependencies", description: "Third-party dependencies may contain malicious code or unpatched CVEs exploitable by attackers.", category: "technical", threat: "Software supply chain compromise (e.g., SolarWinds-style)", asset: "Application dependencies and build pipeline", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-DP-002": { title: "Data Breach from Unencrypted Storage", description: "Sensitive data stored without encryption is exposed in full if storage media is compromised.", category: "technical", threat: "Database breach and unauthorized storage access", asset: "Customer PII and sensitive business data", likelihood: 2, impact: 5, treatment: "mitigate" },
  "UCO-DP-003": { title: "Credential and Data Interception via Man-in-the-Middle", description: "Without TLS enforcement, traffic can be intercepted in transit.", category: "technical", threat: "Network eavesdropping and MITM attacks", asset: "Data in transit across all systems", likelihood: 2, impact: 4, treatment: "mitigate" },
  "UCO-DP-005": { title: "Unrecoverable Data Loss from System Failure or Ransomware", description: "Without tested backups, a ransomware attack or system failure results in permanent data loss.", category: "technical", threat: "Ransomware, hardware failure, accidental deletion", asset: "All organizational data and systems", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-IR-001": { title: "Prolonged Security Incident Due to No Response Plan", description: "Without a documented IR plan, security incidents escalate due to lack of coordination and defined roles.", category: "operational", threat: "Uncontrolled breach spread and regulatory non-compliance", asset: "Business operations and customer trust", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-RM-001": { title: "Unidentified Critical Business Risks", description: "Without formal risk assessments, significant threats may go unrecognized until they materialize.", category: "compliance", threat: "Business risk materialization and regulatory audit findings", asset: "Entire organization", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-RM-002": { title: "Third-Party Vendor Data Breach Impacting Your Organization", description: "Vendors with access to your data represent a significant attack surface outside your direct control.", category: "operational", threat: "Third-party data breach and supply chain risk", asset: "Customer data held by vendors", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-RM-004": { title: "Unexploited Vulnerabilities from Lack of Adversarial Testing", description: "Without penetration testing, vulnerabilities that automated scanners miss remain undetected.", category: "technical", threat: "Advanced exploitation of unknown vulnerabilities", asset: "Production systems and applications", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-ST-001": { title: "Human Error Enabling Phishing or Social Engineering Attack", description: "Untrained employees represent the most common entry point for attackers through phishing.", category: "operational", threat: "Phishing, spear phishing, and social engineering", asset: "Employee accounts and credentials", likelihood: 4, impact: 4, treatment: "mitigate" },
  "UCO-VM-001": { title: "Exploitation of Unpatched Critical Vulnerabilities", description: "Known CVEs with available patches remain exploitable until remediated per defined SLAs.", category: "technical", threat: "Ransomware and targeted exploitation of known CVEs", asset: "All servers, workstations, and applications", likelihood: 4, impact: 5, treatment: "mitigate" },
  "UCO-VM-002": { title: "System Compromise via Unpatched Operating Systems", description: "Without timely patching, known vulnerabilities become exploitable attack vectors.", category: "technical", threat: "N-day exploitation and automated vulnerability scanning by attackers", asset: "Servers, workstations, and network devices", likelihood: 4, impact: 4, treatment: "mitigate" },
  "UCO-NS-001": { title: "Lateral Movement After Initial Compromise", description: "Without network segmentation, an attacker who gains initial access can move freely to other systems.", category: "technical", threat: "Network lateral movement and privilege escalation", asset: "Internal network and production systems", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-NS-002": { title: "Unauthorized External Access via Misconfigured Firewall", description: "Firewall misconfigurations can expose internal services to the internet.", category: "technical", threat: "Direct exploitation of exposed internal services", asset: "Internal services and databases", likelihood: 2, impact: 5, treatment: "mitigate" },
  "UCO-EP-001": { title: "Undetected Malware Executing on Endpoints", description: "Without EDR, malware can execute and persist on endpoints for months before detection.", category: "technical", threat: "Ransomware, spyware, and advanced persistent threats on endpoints", asset: "Laptops and workstations", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-EP-002": { title: "Data Breach from Lost or Stolen Laptops", description: "Without full disk encryption, a lost device exposes all stored data.", category: "technical", threat: "Physical theft and unauthorized access to device data", asset: "Sensitive data on endpoints", likelihood: 3, impact: 4, treatment: "mitigate" },
  "UCO-AS-002": { title: "Web Application Exploitation (SQLi, XSS, CSRF)", description: "Internet-facing applications without WAF protection are vulnerable to automated and targeted attacks.", category: "technical", threat: "Web application attacks targeting customer-facing systems", asset: "Web applications and customer data", likelihood: 4, impact: 4, treatment: "mitigate" },
  "UCO-AS-004": { title: "Credentials Exposed via Source Code Repository", description: "Secrets accidentally committed to repos are immediately harvestable by attackers scanning public code.", category: "technical", threat: "Automated credential harvesting from public repositories", asset: "API keys, database credentials, and access tokens", likelihood: 3, impact: 5, treatment: "mitigate" },
  "UCO-PR-003": { title: "Regulatory Fine for Failure to Honor Data Subject Rights", description: "Failure to respond to GDPR/CCPA deletion or access requests within required timeframes results in regulatory action.", category: "legal", threat: "Regulatory audit and enforcement action", asset: "Customer trust and financial position", likelihood: 2, impact: 4, treatment: "mitigate" },
  "UCO-CR-001": { title: "Encrypted Data Exposed Due to Key Management Failure", description: "Poor key management allows extraction of encryption keys, defeating data-at-rest protection.", category: "technical", threat: "Cryptographic key extraction and data decryption", asset: "All encrypted data at rest", likelihood: 2, impact: 5, treatment: "mitigate" },
  "UCO-CM-007": { title: "Credential Exposure via Hardcoded Secrets in Code", description: "Secrets stored in environment files, config files, or source code are exposed in breaches.", category: "technical", threat: "Unauthorized API access using exposed credentials", asset: "Third-party integrations and production systems", likelihood: 3, impact: 5, treatment: "mitigate" },
};

@Injectable()
export class RisksService {
  async getRisks(orgId: number) {
    const risks = await db.query.orgRisksTable.findMany({
      where: eq(orgRisksTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.inherentScore)],
    });
    const summary = {
      total: risks.length,
      open: risks.filter((r) => r.status === "open").length,
      mitigated: risks.filter((r) => r.status === "mitigated").length,
      accepted: risks.filter((r) => r.status === "accepted").length,
      critical: risks.filter((r) => (r.inherentScore ?? 0) >= 15).length,
      high: risks.filter((r) => (r.inherentScore ?? 0) >= 9 && (r.inherentScore ?? 0) < 15).length,
      medium: risks.filter((r) => (r.inherentScore ?? 0) >= 4 && (r.inherentScore ?? 0) < 9).length,
      low: risks.filter((r) => (r.inherentScore ?? 0) < 4).length,
    };
    return { risks, summary };
  }

  async createRisk(orgId: number, clerkUserId: string, body: Record<string, unknown>) {
    const likelihood = Number(body.likelihood ?? 3);
    const impact = Number(body.impact ?? 3);
    const inherentScore = likelihood * impact;
    const residualLikelihood = Math.max(1, likelihood - 1);
    const residualImpact = Math.max(1, impact - 1);

    const [risk] = await db.insert(orgRisksTable).values({
      orgId,
      title: String(body.title),
      description: body.description ? String(body.description) : undefined,
      category: body.category ? String(body.category) : "operational",
      asset: body.asset ? String(body.asset) : undefined,
      threat: body.threat ? String(body.threat) : undefined,
      likelihood,
      impact,
      inherentScore,
      treatment: body.treatment ? String(body.treatment) : "mitigate",
      treatmentPlan: body.treatmentPlan ? String(body.treatmentPlan) : undefined,
      residualLikelihood,
      residualImpact,
      residualScore: residualLikelihood * residualImpact,
      ownerName: body.ownerName ? String(body.ownerName) : undefined,
      ownerEmail: body.ownerEmail ? String(body.ownerEmail) : undefined,
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
      relatedControlId: body.relatedControlId ? String(body.relatedControlId) : undefined,
      relatedFrameworkKey: body.relatedFrameworkKey ? String(body.relatedFrameworkKey) : undefined,
      createdBy: clerkUserId,
    }).returning();
    return { risk };
  }

  async updateRisk(orgId: number, riskId: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.likelihood !== undefined) updates.likelihood = Number(body.likelihood);
    if (body.impact !== undefined) updates.impact = Number(body.impact);
    if (body.treatment !== undefined) updates.treatment = body.treatment;
    if (body.treatmentPlan !== undefined) updates.treatmentPlan = body.treatmentPlan;
    if (body.status !== undefined) updates.status = body.status;
    if (body.ownerName !== undefined) updates.ownerName = body.ownerName;
    if (body.ownerEmail !== undefined) updates.ownerEmail = body.ownerEmail;
    if (body.dueDate !== undefined) updates.dueDate = new Date(String(body.dueDate));
    if (body.residualLikelihood !== undefined) updates.residualLikelihood = Number(body.residualLikelihood);
    if (body.residualImpact !== undefined) updates.residualImpact = Number(body.residualImpact);
    if (updates.likelihood && updates.impact) {
      updates.inherentScore = Number(updates.likelihood) * Number(updates.impact);
    }
    if (updates.residualLikelihood && updates.residualImpact) {
      updates.residualScore = Number(updates.residualLikelihood) * Number(updates.residualImpact);
    }
    updates.updatedAt = new Date();

    const [risk] = await db.update(orgRisksTable)
      .set(updates as any)
      .where(eq(orgRisksTable.id, riskId))
      .returning();
    return { risk };
  }

  async deleteRisk(orgId: number, riskId: number) {
    await db.delete(orgRisksTable).where(eq(orgRisksTable.id, riskId));
    return { success: true };
  }

  async suggestRisksFromControls(orgId: number) {
    const failingControls = await db.query.orgControlResultsTable.findMany({
      where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.status, "failing")),
    });

    const existingRisks = await db.query.orgRisksTable.findMany({
      where: eq(orgRisksTable.orgId, orgId),
    });
    const existingControlIds = new Set(existingRisks.map((r) => r.relatedControlId).filter(Boolean));

    const suggestions = failingControls
      .filter((cr) => CONTROL_RISK_SUGGESTIONS[cr.ucoControlId] && !existingControlIds.has(cr.ucoControlId))
      .map((cr) => {
        const s = CONTROL_RISK_SUGGESTIONS[cr.ucoControlId];
        return {
          ...s,
          relatedControlId: cr.ucoControlId,
          inherentScore: s.likelihood * s.impact,
          residualLikelihood: Math.max(1, s.likelihood - 1),
          residualImpact: Math.max(1, s.impact - 1),
          residualScore: Math.max(1, s.likelihood - 1) * Math.max(1, s.impact - 1),
        };
      });

    const ucoControls = await db.query.ucoControlsTable.findMany();
    const controlMap = new Map(ucoControls.map((c) => [c.controlId, c.name]));

    return {
      suggestions: suggestions.map((s) => ({
        ...s,
        controlName: controlMap.get(s.relatedControlId ?? "") ?? s.relatedControlId,
      })),
    };
  }

  async importRiskSuggestions(orgId: number, clerkUserId: string, controlIds: string[]) {
    const created: any[] = [];
    for (const controlId of controlIds) {
      const s = CONTROL_RISK_SUGGESTIONS[controlId];
      if (!s) continue;
      const inherentScore = s.likelihood * s.impact;
      const residualLikelihood = Math.max(1, s.likelihood - 1);
      const residualImpact = Math.max(1, s.impact - 1);
      const [risk] = await db.insert(orgRisksTable).values({
        orgId,
        title: s.title,
        description: s.description,
        category: s.category,
        threat: s.threat,
        asset: s.asset,
        likelihood: s.likelihood,
        impact: s.impact,
        inherentScore,
        treatment: s.treatment,
        residualLikelihood,
        residualImpact,
        residualScore: residualLikelihood * residualImpact,
        relatedControlId: controlId,
        createdBy: clerkUserId,
      }).returning();
      created.push(risk);
    }
    return { created: created.length, risks: created };
  }
  async getComplianceCalendar(orgId: number) {
    try {
      const { sql } = await import("drizzle-orm");
      const events = await db.execute(sql.raw(
        "SELECT * FROM org_compliance_calendar WHERE org_id = " + orgId + " ORDER BY due_date ASC LIMIT 100"
      ));
      const rows = (events.rows ?? events) as any[];
      const overdue = rows.filter((e: any) => new Date(e.due_date) < new Date() && e.status === 'upcoming').length;
      return { events: rows, total: rows.length, overdue };
    } catch { return { events: [], total: 0, overdue: 0 }; }
  }

  async createCalendarEvent(orgId: number, data: any) {
    try {
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql.raw(
        "INSERT INTO org_compliance_calendar (org_id, title, description, event_type, due_date, recurrence, framework_key, assigned_to, status) VALUES (" +
        orgId + ", '" + (data.title||'').replace(/'/g,"''") + "', '" + (data.description||'').replace(/'/g,"''") + "', '" +
        (data.event_type||'review') + "', '" + (data.due_date||new Date().toISOString()) + "', '" +
        (data.recurrence||'annual') + "', '" + (data.framework_key||'') + "', '" +
        (data.assigned_to||'').replace(/'/g,"''") + "', 'upcoming') RETURNING *"
      ));
      return { event: ((result.rows ?? result) as any[])[0] };
    } catch (err) { return { event: null, error: String(err) }; }
  }

  async updateCalendarEvent(orgId: number, eventId: number, data: any) {
    try {
      const { sql } = await import("drizzle-orm");
      const sets: string[] = [];
      if (data.status) sets.push("status = '" + data.status + "'");
      if (data.title) sets.push("title = '" + data.title.replace(/'/g,"''") + "'");
      if (data.assigned_to) sets.push("assigned_to = '" + data.assigned_to.replace(/'/g,"''") + "'");
      if (data.status === 'completed') sets.push("completed_at = NOW()");
      sets.push("updated_at = NOW()");
      await db.execute(sql.raw("UPDATE org_compliance_calendar SET " + sets.join(", ") + " WHERE id = " + eventId + " AND org_id = " + orgId));
      return { success: true };
    } catch (err) { return { success: false, error: String(err) }; }
  }

  async getSubProcessors(orgId: number) {
    try {
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql.raw("SELECT * FROM org_sub_processors WHERE org_id = " + orgId + " ORDER BY name ASC"));
      const rows = (result.rows ?? result) as any[];
      return { subProcessors: rows, total: rows.length };
    } catch { return { subProcessors: [], total: 0 }; }
  }

}
