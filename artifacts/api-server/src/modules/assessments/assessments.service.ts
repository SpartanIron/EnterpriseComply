import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db,
  orgAssessmentsTable,
  orgQuestionnairesTable,
  orgQuestionnaireItemsTable,
  orgControlResultsTable,
  orgEvidenceTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "placeholder";
const openai = new OpenAI({
  ...(openaiBaseURL ? { baseURL: openaiBaseURL } : {}),
  apiKey: openaiApiKey,
});

// ─── Sprint 2: Zero Trust Posture Assessment question template ────────────────
const ZT_QUESTIONS = {
  identity: [
    "Do you enforce Multi-Factor Authentication (MFA) for all user accounts?",
    "Do you use Single Sign-On (SSO) across all enterprise applications?",
    "Do you have a formal Identity and Access Management (IAM) policy?",
    "Do you enforce Role-Based Access Control (RBAC) with least privilege?",
    "Do you conduct periodic access reviews (at least annually)?",
    "Do you have Privileged Access Management (PAM) for admin/service accounts?",
    "Do you have automated user provisioning and de-provisioning processes?",
  ],
  devices: [
    "Do you have a Mobile Device Management (MDM) or endpoint management solution?",
    "Are all corporate devices enrolled in your MDM platform?",
    "Do you enforce device health checks before granting access to resources?",
    "Is full-disk encryption enabled on all corporate endpoints?",
    "Do you run endpoint detection and response (EDR) or antivirus on all devices?",
    "Do you have a formal patch management policy with defined SLAs?",
    "Are personal/BYOD devices managed or restricted from accessing corporate data?",
  ],
  network: [
    "Have you implemented network micro-segmentation or VLAN segregation?",
    "Do you use a Web Application Firewall (WAF) or equivalent DDoS protection?",
    "Do you enforce TLS 1.2+ encryption for all data in transit?",
    "Do you use DNS filtering or Secure Web Gateway for internet traffic?",
    "Is remote access provided via Zero Trust Network Access (ZTNA) or VPN with MFA?",
    "Do you monitor network traffic for anomalies (SIEM, IDS/IPS)?",
    "Do you maintain a network topology diagram updated within the last 12 months?",
  ],
  applications: [
    "Do you perform static application security testing (SAST) in your CI/CD pipeline?",
    "Do you conduct dynamic application security testing (DAST) or penetration testing?",
    "Do you have a formal Software Development Lifecycle (SDLC) with security gates?",
    "Do you perform dependency scanning for known vulnerabilities (SCA)?",
    "Is API access authenticated with short-lived tokens (OAuth 2.0/JWT)?",
    "Do you have a vulnerability disclosure or bug bounty program?",
    "Do you use container image scanning in your deployment pipeline?",
  ],
  data: [
    "Do you have a formal data classification policy (Public, Internal, Confidential, Restricted)?",
    "Is sensitive data encrypted at rest using AES-256 or equivalent?",
    "Do you know where all CUI, PII, and sensitive data resides (data inventory)?",
    "Do you enforce data loss prevention (DLP) controls?",
    "Do you have a formal data retention and destruction policy?",
    "Are backups of critical data performed and tested regularly?",
    "Do you restrict data access on a need-to-know basis with documented justification?",
  ],
  governance: [
    "Do you have a documented Information Security Policy reviewed annually?",
    "Do you conduct annual security awareness training for all employees?",
    "Do you have a formal Incident Response Plan (IRP) tested at least annually?",
    "Do you have a Business Continuity / Disaster Recovery plan?",
    "Do you perform annual risk assessments?",
    "Do you have a vendor/third-party risk management program?",
    "Do you maintain an inventory of all IT assets (hardware and software)?",
  ],
  compliance: [
    "Are you pursuing or do you hold any compliance certifications (SOC 2, ISO 27001, FedRAMP, CMMC)?",
    "Do you have a Plan of Action and Milestones (POA&M) for open compliance gaps?",
    "Do you use a GRC platform to manage compliance controls and evidence?",
    "Do you conduct internal audits of your security controls at least annually?",
    "Do you have a formal compliance program owner or dedicated security team?",
    "Is audit log data retained for at least 12 months?",
    "Do you have controls mapped to NIST 800-171, CMMC, or equivalent frameworks?",
  ],
  operations: [
    "Do you have a centralized SIEM or log management platform?",
    "Do you have defined Recovery Time Objective (RTO) and Recovery Point Objective (RPO)?",
    "Do you conduct tabletop exercises or incident response drills?",
    "Do you perform vulnerability scanning at least monthly?",
    "Do you have an on-call escalation process for critical security incidents?",
    "Do you track and remediate findings from penetration tests within defined SLAs?",
    "Do you monitor third-party advisories and apply patches within 30 days for critical CVEs?",
  ],
};

// Build flat question list with domain metadata
function buildZTQuestions(): Array<{ question: string; domain: string; index: number }> {
  const list: Array<{ question: string; domain: string; index: number }> = [];
  let idx = 0;
  for (const [domain, questions] of Object.entries(ZT_QUESTIONS)) {
    for (const q of questions) {
      list.push({ question: q, domain, index: idx++ });
    }
  }
  return list;
}

// NIST 800-171 intake questions (high-level, maps to 14 control families)
const NIST_171_QUESTIONS = [
  "Do you control who can access your systems and data (Access Control — 3.1)?",
  "Do you conduct security awareness training for all users (Awareness & Training — 3.2)?",
  "Do you maintain audit logs of system access and activity (Audit — 3.3)?",
  "Do you manage system configuration and change management (Configuration — 3.4)?",
  "Do you verify the identity of users before granting access (Identification & Auth — 3.5)?",
  "Do you have an incident response plan and process (Incident Response — 3.6)?",
  "Do you perform maintenance on systems and control who does it (Maintenance — 3.7)?",
  "Do you protect sensitive media and control physical access to it (Media Protection — 3.8)?",
  "Do you screen personnel before granting access to CUI (Personnel Security — 3.9)?",
  "Do you protect your facilities and limit physical access to systems (Physical Protection — 3.10)?",
  "Do you assess security risks and remediate identified gaps (Risk Assessment — 3.11)?",
  "Do you have a security assessment program for your controls (Security Assessment — 3.12)?",
  "Do you protect communications and control what data leaves your network (System & Comms Protection — 3.13)?",
  "Do you protect system integrity and perform vulnerability management (System Integrity — 3.14)?",
];

// CMMC L2 key practice areas (subset of 110 NIST 800-171 practices)
const CMMC_L2_QUESTIONS = [
  "Can you demonstrate documented policies for all 14 NIST 800-171 control families?",
  "Do you have written procedures for Access Control (AC) practices?",
  "Is MFA implemented for all privileged and remote access?",
  "Do you use encryption for CUI stored on mobile devices and removable media?",
  "Do you have a documented System Security Plan (SSP) for your CUI environment?",
  "Do you sanitize or destroy media containing CUI before disposal?",
  "Do you perform background checks on individuals with access to CUI?",
  "Do you limit system access to authorized users, processes, and devices?",
  "Do you protect audit information from unauthorized access or modification?",
  "Do you scan for vulnerabilities in systems processing CUI periodically?",
  "Do you use deny-by-default / allow-by-exception for security configurations?",
  "Do you monitor systems to detect attacks and unauthorized access?",
  "Do you control remote access sessions and encrypt all remote access communications?",
  "Do you provide CUI protection training to personnel handling CUI?",
  "Do you have a continuous monitoring capability for your CUI environment?",
];

// SOC 2 Type II readiness questions
const SOC2_QUESTIONS = [
  "Do you have a formal information security policy reviewed at least annually? (CC1.1)",
  "Do you perform background checks on employees with access to customer data? (CC1.1)",
  "Do you conduct security awareness training annually? (CC1.4)",
  "Do you enforce MFA for logical access to systems? (CC6.1)",
  "Do you have a formal change management process for infrastructure? (CC8.1)",
  "Do you perform penetration testing at least annually? (CC4.1)",
  "Do you have a Business Continuity Plan (BCP) tested annually? (A1.3)",
  "Do you maintain audit logs retained for at least 12 months? (CC7.2)",
  "Do you have a SIEM or centralized log monitoring system? (CC7.2)",
  "Do you have documented Incident Response procedures? (CC7.3)",
  "Do you perform vendor risk assessments for critical third parties? (CC9.2)",
  "Do you encrypt customer data at rest and in transit? (CC6.7)",
  "Do you have a formal vulnerability management program? (CC7.1)",
  "Do you perform access reviews at least semi-annually? (CC6.2)",
  "Do you have a documented data classification policy? (CC6.5)",
];

export const ASSESSMENT_TEMPLATES: Record<string, {
  label: string;
  description: string;
  domains: string[];
  questions: Array<{ question: string; domain: string }>;
}> = {
  "zero-trust": {
    label: "Zero Trust Posture Assessment",
    description: "Comprehensive 56-question assessment across 8 Zero Trust domains: Identity, Devices, Network, Applications, Data, Governance, Compliance, and Operations.",
    domains: ["identity", "devices", "network", "applications", "data", "governance", "compliance", "operations"],
    questions: buildZTQuestions(),
  },
  "nist-800-171": {
    label: "NIST 800-171 Readiness Assessment",
    description: "14-question intake covering all NIST 800-171 control families. Used for CMMC L2 eligibility and DoD contract readiness.",
    domains: ["access_control", "awareness", "audit", "configuration", "identification", "incident_response", "maintenance", "media_protection", "personnel", "physical", "risk", "security_assessment", "system_comms", "system_integrity"],
    questions: NIST_171_QUESTIONS.map((q, i) => ({ question: q, domain: "nist-171" })),
  },
  "cmmc-l2": {
    label: "CMMC Level 2 Readiness Assessment",
    description: "15-question CMMC Level 2 readiness assessment covering key practice areas for organizations handling CUI under DoD contracts.",
    domains: ["access_control", "identification", "media_protection", "personnel", "risk_assessment", "system_integrity"],
    questions: CMMC_L2_QUESTIONS.map((q, i) => ({ question: q, domain: "cmmc-l2" })),
  },
  "soc2": {
    label: "SOC 2 Type II Readiness Assessment",
    description: "15-question SOC 2 Trust Services Criteria readiness check covering CC1–CC9 and Availability criteria.",
    domains: ["CC1", "CC4", "CC6", "CC7", "CC8", "CC9", "A1"],
    questions: SOC2_QUESTIONS.map((q, i) => ({ question: q, domain: "soc2" })),
  },
};

@Injectable()
export class AssessmentsService {
  // ── List all assessments for an org ────────────────────────────────────────
  async list(orgId: number) {
    const assessments = await db.query.orgAssessmentsTable.findMany({
      where: eq(orgAssessmentsTable.orgId, orgId),
      orderBy: [desc(orgAssessmentsTable.createdAt)],
    });
    return { assessments };
  }

  // ── Get a single assessment with its questionnaire items ───────────────────
  async getById(orgId: number, id: number) {
    const assessment = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!assessment) throw new NotFoundException("Assessment not found");

    let items: any[] = [];
    if (assessment.questionnaireId) {
      const itemsResult = await db.query.orgQuestionnaireItemsTable.findMany({
        where: and(
          eq(orgQuestionnaireItemsTable.orgId, orgId),
          eq(orgQuestionnaireItemsTable.questionnaireId, assessment.questionnaireId),
        ),
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      });
      items = itemsResult;
    }
    return { assessment, items };
  }

  // ── Create a new assessment engagement ────────────────────────────────────
  async create(orgId: number, clerkUserId: string, body: {
    clientName: string;
    clientEmail?: string;
    clientCompany?: string;
    clientIndustry?: string;
    clientSize?: string;
    frameworkTarget: string;
    deliveryModel?: string;
    consultantName?: string;
    consultantEmail?: string;
    dueDate?: string;
    notes?: string;
  }) {
    const template = ASSESSMENT_TEMPLATES[body.frameworkTarget];
    if (!template) throw new Error(`Unknown framework target: ${body.frameworkTarget}`);

    // Fetch org's existing control results and evidence for auto-answering
    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
    });
    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));

    // Create the questionnaire record
    const [questionnaire] = await db.insert(orgQuestionnairesTable).values({
      orgId,
      title: `${template.label} — ${body.clientName}`,
      requesterName: body.clientName,
      requesterCompany: body.clientCompany,
      requesterEmail: body.clientEmail,
      type: body.frameworkTarget,
      totalItems: template.questions.length,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdBy: clerkUserId,
    }).returning();

    // Insert questionnaire items with auto-answer
    const items = await Promise.all(
      template.questions.map(async ({ question, domain }, idx) => {
        const { answer, controlId, confidence } = this.autoAnswer(question, resultMap, evidence, domain);
        return db.insert(orgQuestionnaireItemsTable).values({
          orgId,
          questionnaireId: questionnaire.id,
          question,
          category: domain,
          answer,
          confidence,
          matchedControlId: controlId,
          status: answer ? "answered" : "unanswered",
          sortOrder: idx,
        }).returning();
      }),
    );

    const answered = items.filter((i) => i[0]?.answer).length;
    await db.update(orgQuestionnairesTable)
      .set({ answeredItems: answered })
      .where(eq(orgQuestionnairesTable.id, questionnaire.id));

    // Create the assessment record linking to the questionnaire
    const [assessment] = await db.insert(orgAssessmentsTable).values({
      orgId,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientCompany: body.clientCompany,
      clientIndustry: body.clientIndustry,
      clientSize: body.clientSize,
      frameworkTarget: body.frameworkTarget,
      deliveryModel: body.deliveryModel ?? "guided",
      questionnaireId: questionnaire.id,
      consultantName: body.consultantName,
      consultantEmail: body.consultantEmail,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes,
      createdBy: clerkUserId,
    }).returning();

    return { assessment, questionnaire: { ...questionnaire, answeredItems: answered } };
  }

  // ── Update assessment status / metadata ───────────────────────────────────
  async update(orgId: number, id: number, body: Partial<{
    clientName: string;
    clientEmail: string;
    clientCompany: string;
    status: string;
    notes: string;
    consultantName: string;
    consultantEmail: string;
    dueDate: string;
  }>) {
    const existing = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Assessment not found");

    const updates: Record<string, any> = {};
    if (body.clientName !== undefined) updates.clientName = body.clientName;
    if (body.clientEmail !== undefined) updates.clientEmail = body.clientEmail;
    if (body.clientCompany !== undefined) updates.clientCompany = body.clientCompany;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.consultantName !== undefined) updates.consultantName = body.consultantName;
    if (body.consultantEmail !== undefined) updates.consultantEmail = body.consultantEmail;
    if (body.dueDate !== undefined) updates.dueDate = new Date(body.dueDate);
    if (body.status === "complete") updates.completedAt = new Date();

    const [updated] = await db.update(orgAssessmentsTable)
      .set(updates)
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)))
      .returning();

    return { assessment: updated };
  }

  // ── Delete an assessment and its questionnaire ────────────────────────────
  async delete(orgId: number, id: number) {
    const existing = await db.query.orgAssessmentsTable.findFirst({
      where: and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Assessment not found");

    if (existing.questionnaireId) {
      await db.delete(orgQuestionnaireItemsTable).where(
        and(
          eq(orgQuestionnaireItemsTable.orgId, orgId),
          eq(orgQuestionnaireItemsTable.questionnaireId, existing.questionnaireId),
        ),
      );
      await db.delete(orgQuestionnairesTable).where(
        and(eq(orgQuestionnairesTable.orgId, orgId), eq(orgQuestionnairesTable.id, existing.questionnaireId)),
      );
    }

    await db.delete(orgAssessmentsTable).where(
      and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)),
    );
    return { success: true };
  }

  // ── Score a completed assessment by domain ────────────────────────────────
  async score(orgId: number, id: number) {
    const { assessment, items } = await this.getById(orgId, id);
    if (!items.length) return { assessment, domainScores: {}, overallScore: 0, ragStatus: "red" };

    // Affirmative answer keywords
    const POSITIVE = ["yes", "we do", "enforced", "implemented", "we have", "we use", "active", "enabled", "deployed", "completed", "annual", "in place"];
    const NEGATIVE = ["no", "we do not", "not yet", "not implemented", "we don't", "gap", "missing", "not deployed", "pending", "not currently"];

    function scoreAnswer(answer: string): number {
      if (!answer) return 0;
      const lower = answer.toLowerCase();
      if (NEGATIVE.some(n => lower.includes(n))) return 0;
      if (POSITIVE.some(p => lower.includes(p))) return 1;
      // Partial credit for partial answers
      if (lower.length > 20) return 0.5;
      return 0;
    }

    // Group by domain
    const domainMap: Record<string, { total: number; score: number }> = {};
    for (const item of items) {
      const domain = item.category || "general";
      if (!domainMap[domain]) domainMap[domain] = { total: 0, score: 0 };
      domainMap[domain].total++;
      domainMap[domain].score += scoreAnswer(item.answer || "");
    }

    const domainScores: Record<string, number> = {};
    for (const [domain, { total, score }] of Object.entries(domainMap)) {
      domainScores[domain] = Math.round((score / total) * 100);
    }

    const allScores = Object.values(domainScores);
    const overallScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    const ragStatus = overallScore >= 70 ? "green" : overallScore >= 45 ? "amber" : "red";

    // Generate AI executive summary
    const frameworkLabel = ASSESSMENT_TEMPLATES[assessment.frameworkTarget]?.label ?? assessment.frameworkTarget;
    const weakDomains = Object.entries(domainScores)
      .filter(([, s]) => s < 50)
      .sort(([, a], [, b]) => a - b)
      .map(([d, s]) => `${d} (${s}%)`)
      .join(", ");

    let executiveSummary = `${assessment.clientName || "The assessed organization"} achieved an overall Zero Trust maturity score of ${overallScore}% against the ${frameworkLabel}. `;
    executiveSummary += overallScore >= 70
      ? "The organization demonstrates a solid security foundation with strong controls in most domains."
      : overallScore >= 45
      ? `The organization has foundational controls in place but requires targeted improvements. Priority domains: ${weakDomains}.`
      : `Significant gaps exist across multiple security domains. Immediate remediation required. Priority domains: ${weakDomains}.`;

    try {
      const prompt = `You are a senior cybersecurity consultant. Write a 3-sentence executive summary for a ${frameworkLabel} assessment.
Client: ${assessment.clientName || "Assessed Organization"}. Industry: ${assessment.clientIndustry || "Technology"}.
Overall Score: ${overallScore}%. Domain scores: ${JSON.stringify(domainScores)}.
Weakest domains: ${weakDomains || "none identified"}.
Be specific, professional, and actionable. Focus on the top 2 risk areas and one immediate action.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      executiveSummary = response.choices[0]?.message?.content ?? executiveSummary;
    } catch {
      // Use fallback summary
    }

    // Update assessment with scores
    await db.update(orgAssessmentsTable)
      .set({
        domainScores,
        overallScore,
        ragStatus,
        executiveSummary,
      })
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)));

    return { assessment: { ...assessment, domainScores, overallScore, ragStatus, executiveSummary }, domainScores, overallScore, ragStatus };
  }

  // ── Get available templates ───────────────────────────────────────────────
  async getTemplates() {
    return {
      templates: Object.entries(ASSESSMENT_TEMPLATES).map(([key, t]) => ({
        key,
        label: t.label,
        description: t.description,
        questionCount: t.questions.length,
        domains: t.domains,
      })),
    };
  }

  // ── Storethe R2 report URL on the assessment record ───────────────────────
  async setReportUrl(orgId: number, id: number, reportUrl: string) {
    await db.update(orgAssessmentsTable)
      .set({ reportUrl, reportGeneratedAt: new Date() })
      .where(and(eq(orgAssessmentsTable.orgId, orgId), eq(orgAssessmentsTable.id, id)));
    return { reportUrl };
  }

  // ── Private: auto-answer a question from org's compliance data ────────────
  private autoAnswer(
    question: string,
    resultMap: Map<string, { status: string; result?: string | null }>,
    evidence: { title: string; description?: string | null }[],
    domain: string,
  ): { answer: string; controlId?: string; confidence: number } {
    const q = question.toLowerCase();

    // MFA / Multi-factor
    if (q.includes("mfa") || q.includes("multi-factor") || q.includes("two-factor")) {
      const r = resultMap.get("UCO-AI-001");
      if (r?.status === "passing") return { answer: "Yes, MFA is enforced for all user accounts and privileged access via Clerk authentication.", controlId: "UCO-AI-001", confidence: 0.92 };
      if (r?.status === "failing") return { answer: "MFA is not currently enforced for all accounts. This is an identified gap with a remediation plan in place (Clerk Pro upgrade required).", controlId: "UCO-AI-001", confidence: 0.88 };
    }

    // SSO
    if (q.includes("sso") || q.includes("single sign-on") || q.includes("sign-on")) {
      const r = resultMap.get("UCO-AI-002");
      if (r?.status === "passing") return { answer: "Yes, SSO is implemented via Clerk with OIDC support across enterprise applications.", controlId: "UCO-AI-002", confidence: 0.88 };
    }

    // Encryption
    if (q.includes("encrypt") && (q.includes("rest") || q.includes("transit"))) {
      const r = resultMap.get("UCO-DP-002");
      if (r?.status === "passing") return { answer: "Yes, all data is encrypted at rest using AES-256 and in transit using TLS 1.3.", controlId: "UCO-DP-002", confidence: 0.90 };
    }

    // Access Control / RBAC / least privilege
    if (q.includes("access control") || q.includes("rbac") || q.includes("least privilege") || q.includes("role-based")) {
      const r = resultMap.get("UCO-AC-001");
      if (r?.status === "passing") return { answer: "Yes, Role-Based Access Control (RBAC) is enforced with least-privilege principles. Access is granted based on job function and reviewed quarterly.", controlId: "UCO-AC-001", confidence: 0.87 };
    }

    // Access reviews
    if (q.includes("access review") || q.includes("periodic") || q.includes("semi-annual")) {
      const r = resultMap.get("UCO-AC-002");
      if (r?.status === "passing") return { answer: "Yes, formal access reviews are conducted at least semi-annually, with results documented and remediated within 30 days.", controlId: "UCO-AC-002", confidence: 0.84 };
    }

    // Incident Response
    if (q.includes("incident") || (q.includes("response") && q.includes("plan"))) {
      const r = resultMap.get("UCO-IR-001");
      if (r?.status === "passing") return { answer: "Yes, a documented Incident Response Plan (IRP) exists, modeled on NIST 800-61. It is reviewed and tabletop-tested annually.", controlId: "UCO-IR-001", confidence: 0.87 };
    }

    // Vulnerability management / patching
    if (q.includes("vulnerab") || q.includes("patch") || q.includes("cve")) {
      const r = resultMap.get("UCO-VM-001");
      if (r?.status === "passing") return { answer: "Yes, weekly vulnerability scans are performed and critical patches are applied within 30 days per our vulnerability management policy.", controlId: "UCO-VM-001", confidence: 0.85 };
    }

    // Audit logging / SIEM
    if (q.includes("audit log") || q.includes("logging") || q.includes("siem") || q.includes("log management")) {
      const r = resultMap.get("UCO-AL-001");
      if (r?.status === "passing") return { answer: "Yes, comprehensive audit logging is enabled across all systems. Logs are retained for 12 months and reviewed via our monitoring platform.", controlId: "UCO-AL-001", confidence: 0.86 };
    }

    // Training / security awareness
    if (q.includes("training") || q.includes("awareness") || q.includes("annual")) {
      const r = resultMap.get("UCO-ST-001");
      if (r?.status === "passing") return { answer: "Yes, all employees complete annual security awareness training. Completion rates are tracked and reported to leadership.", controlId: "UCO-ST-001", confidence: 0.84 };
    }

    // WAF
    if (q.includes("waf") || q.includes("web application firewall") || q.includes("ddos")) {
      return { answer: "Cloudflare is deployed as our CDN and DDoS protection layer. WAF managed rules are on the product roadmap pending plan upgrade.", confidence: 0.78 };
    }

    // TLS
    if (q.includes("tls") || q.includes("https") || q.includes("transit")) {
      return { answer: "Yes, TLS 1.3 is enforced for all web traffic. HSTS with a 1-year max-age is configured via Cloudflare on all domains.", confidence: 0.92 };
    }

    // Change management
    if (q.includes("change management") || q.includes("change control")) {
      const r = resultMap.get("UCO-CM-001");
      if (r?.status === "passing") return { answer: "Yes, a formal change management process is in place. All changes are peer-reviewed via GitHub pull requests with CODEOWNERS approval required.", controlId: "UCO-CM-001", confidence: 0.86 };
    }

    // Backup / BCP / DR
    if (q.includes("backup") || q.includes("recovery") || q.includes("continuity") || q.includes("rto") || q.includes("rpo")) {
      return { answer: "Automated daily database backups are performed with tested restoration procedures. RTO is 4 hours; RPO is 24 hours. BCP documentation is in development.", confidence: 0.73 };
    }

    // SOC 2 / ISO 27001 / certifications
    if (q.includes("soc 2") || q.includes("iso 27001") || q.includes("certification") || q.includes("fedramp")) {
      return { answer: "SOC 2 Type II certification is actively being pursued. Compliance posture is managed via EnterpriseComply GRC platform.", confidence: 0.80 };
    }

    // Security policy
    if (q.includes("security policy") || q.includes("information security policy")) {
      const hasEvidence = evidence.some(e => e.title.toLowerCase().includes("polic"));
      if (hasEvidence) return { answer: "Yes, a formal Information Security Policy exists, is reviewed annually, and is available to all employees.", confidence: 0.82 };
    }

    // MDM / endpoint management
    if (q.includes("mdm") || q.includes("mobile device management") || q.includes("endpoint management")) {
      return { answer: "MDM is on the Phase 3 implementation roadmap. Currently, all corporate devices are managed via company-issued configurations and browser fingerprinting via Clerk.", confidence: 0.65 };
    }

    // SDLC
    if (q.includes("sdlc") || q.includes("development lifecycle") || q.includes("security gate")) {
      return { answer: "Yes, a formal SDLC is in place using GitHub with CODEOWNERS-enforced peer review, branch protection, and Dependabot automated dependency scanning.", confidence: 0.83 };
    }

    // Data classification
    if (q.includes("data classif") || q.includes("classification policy")) {
      return { answer: "A data classification scheme is documented with four tiers: Public, Internal, Confidential, and Restricted. CUI handling procedures are maintained for federal engagements.", confidence: 0.77 };
    }

    // Vendor risk
    if (q.includes("vendor") || q.includes("third-party") || q.includes("supply chain")) {
      return { answer: "Third-party vendor assessments are conducted using SIG-Lite questionnaires via our Questionnaires module. Critical vendors are reviewed annually.", confidence: 0.75 };
    }

    // Physical security
    if (q.includes("physical") || q.includes("facility") || q.includes("data center")) {
      return { answer: "Operations run in cloud infrastructure (Railway/Cloudflare). Physical security obligations are met by our cloud providers per their compliance certifications.", confidence: 0.80 };
    }

    return { answer: "", confidence: 0 };
  }
}
