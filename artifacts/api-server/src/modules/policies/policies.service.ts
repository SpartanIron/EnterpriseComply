import { Injectable } from "@nestjs/common";
import { db, orgPoliciesTable, orgPolicyAcknowledgmentsTable, orgPeopleTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadTemplate(key: string): string {
  const filePath = join(process.cwd(), "artifacts/api-server/policy-templates", `${key}.md`);
  if (!existsSync(filePath)) {
    return `# ${key}\n\nTemplate content pending.`;
  }
  return readFileSync(filePath, "utf-8");
}

export const POLICY_TEMPLATES = [
  {
    key: "information-security",
    title: "Information Security Policy",
    category: "governance",
    description: "Master information security policy establishing the security program, CISO authority, scope, and reference to all subordinate policies. Required foundation for SOC 2, FedRAMP, and CMMC.",
    content: loadTemplate("information-security"),
  },
  {
    key: "acceptable-use",
    title: "Acceptable Use Policy",
    category: "security",
    description: "Defines acceptable use of company systems, data, and resources.",
    content: loadTemplate("acceptable-use"),
  },
  {
    key: "access-control",
    title: "Access Control Policy",
    category: "security",
    description: "Governs how access to systems is granted, managed, and revoked.",
    content: loadTemplate("access-control"),
  },
  {
    key: "incident-response",
    title: "Incident Response Policy",
    category: "security",
    description: "Procedures for detecting, reporting, and responding to security incidents.",
    content: loadTemplate("incident-response"),
  },
  {
    key: "data-classification",
    title: "Data Classification Policy",
    category: "data",
    description: "Framework for categorizing and handling data by sensitivity level.",
    content: loadTemplate("data-classification"),
  },
  {
    key: "password-policy",
    title: "Password Policy",
    category: "security",
    description: "Requirements for password complexity, rotation, storage, and MFA.",
    content: loadTemplate("password-policy"),
  },
  {
    key: "incident-response-plan",
    title: "Incident Response Plan",
    category: "security",
    description: "Operational procedures and contact information for executing incident response.",
    content: loadTemplate("incident-response-plan"),
  },
  {
    key: "change-management",
    title: "Change Management Policy",
    category: "operations",
    description: "Process for managing changes to production systems and infrastructure.",
    content: loadTemplate("change-management"),
  },
  {
    key: "vendor-management",
    title: "Vendor Management Policy",
    category: "risk",
    description: "Requirements for assessing and managing third-party vendor risk.",
    content: loadTemplate("vendor-management"),
  },
  {
    key: "business-continuity",
    title: "Business Continuity Plan",
    category: "risk",
    description: "Plans for maintaining operations during and after disruptive events.",
    content: loadTemplate("business-continuity"),
  },
  {
    key: "encryption",
    title: "Encryption Policy",
    category: "security",
    description: "Standards for encrypting data at rest and in transit.",
    content: loadTemplate("encryption"),
  },
  {
    key: "audit-logging",
    title: "Audit Logging Policy",
    category: "security",
    description: "Requirements for system logging, log integrity, and log retention.",
    content: loadTemplate("audit-logging"),
  },
,
  {
    key: "remote-work",
    title: "Remote Work Security Policy",
    category: "security",
    description: "Security requirements for remote and distributed employees accessing organizational systems from outside corporate facilities.",
    content: loadTemplate("remote-work"),
  },
  {
    key: "vulnerability-management",
    title: "Vulnerability Management Policy",
    category: "security",
    description: "Process for identifying, prioritizing, and remediating vulnerabilities across infrastructure, applications, and cloud environments. Satisfies CMMC SI.1.210, FedRAMP RA-5, SOC 2 CC7.1.",
    content: loadTemplate("vulnerability-management"),
  },
  {
    key: "data-retention",
    title: "Data Retention & Disposal Policy",
    category: "data",
    description: "Retention schedules by data type, legal hold procedures, and secure disposal requirements per NIST 800-88.",
    content: loadTemplate("data-retention"),
  },
  {
    key: "physical-security",
    title: "Physical Security Policy",
    category: "operations",
    description: "Controls for physical access to facilities, data centers, and hardware assets.",
    content: loadTemplate("physical-security"),
  },
  {
    key: "hr-security",
    title: "HR Security Policy",
    category: "hr",
    description: "Security requirements for pre-employment screening, onboarding, role changes, and offboarding of personnel.",
    content: loadTemplate("hr-security"),
  },
  {
    key: "third-party-access",
    title: "Third-Party Access Policy",
    category: "risk",
    description: "Requirements for granting, monitoring, and revoking third-party and contractor access to organizational systems.",
    content: loadTemplate("third-party-access"),
  },
  {
    key: "mobile-device",
    title: "Mobile Device & BYOD Policy",
    category: "security",
    description: "Security requirements for corporate and employee-owned devices accessing organizational data, including MDM enrollment, encryption, and acceptable use.",
    content: loadTemplate("mobile-device"),
  },
  {
    key: "network-security",
    title: "Network Security Policy",
    category: "security",
    description: "Standards for network segmentation, firewall management, VPN, wireless security, and network monitoring. Satisfies CMMC SC.1.175, FedRAMP SC-7, SOC 2 CC6.6.",
    content: loadTemplate("network-security"),
  },
  {
    key: "security-awareness",
    title: "Security Awareness Training Policy",
    category: "hr",
    description: "Requirements for security awareness training, phishing simulations, and role-based security education. Satisfies CMMC AT.2.056, FedRAMP AT-2, SOC 2 CC1.4.",
    content: loadTemplate("security-awareness"),
  },
  {
    key: "ai-use",
    title: "AI & Generative AI Use Policy",
    category: "operations",
    description: "Guidelines for responsible employee use of AI and generative AI tools, including data input restrictions, output review, and approved tool list.",
    content: loadTemplate("ai-use"),
  },
  {
    key: "cloud-security",
    title: "Cloud Security Policy",
    category: "security",
    description: "Security controls for cloud infrastructure including IaC, IAM, CSPM, data residency, and approved services. Satisfies CMMC SC.3.187, FedRAMP SA-9, SOC 2 A1.1.",
    content: loadTemplate("cloud-security"),
  },
  {
    key: "software-development",
    title: "Secure Software Development Policy",
    category: "operations",
    description: "Security requirements for the SDLC including threat modeling, code review, SAST/DAST, secrets management, and deployment approvals.",
    content: loadTemplate("software-development"),
  },
  {
    key: "asset-management",
    title: "Asset Management Policy",
    category: "operations",
    description: "Requirements for hardware and software asset inventory, classification, lifecycle management, and secure decommissioning.",
    content: loadTemplate("asset-management"),
  },
  {
    key: "privacy",
    title: "Privacy Policy (Internal Data Handling)",
    category: "data",
    description: "Internal guidelines for collecting, processing, storing, and protecting personal data of employees, clients, and users. Supports GDPR, CCPA, SOC 2 Privacy, and FedRAMP AR-1.",
    content: loadTemplate("privacy"),
  },
  {
    key: "whistleblower",
    title: "Whistleblower & Ethics Policy",
    category: "hr",
    description: "Protections and procedures for employees reporting compliance violations, unethical conduct, or security concerns in good faith.",
    content: loadTemplate("whistleblower"),
  },
  {
    key: "clean-desk",
    title: "Clean Desk & Screen Lock Policy",
    category: "security",
    description: "Requirements for securing workstations, screens, and physical documents when unattended to prevent unauthorized viewing or access.",
    content: loadTemplate("clean-desk"),
  },
  {
    key: "media-handling",
    title: "Removable Media Policy",
    category: "security",
    description: "Controls for the use, encryption, tracking, and secure disposal of USB drives, external hard drives, and other removable storage media.",
    content: loadTemplate("media-handling"),
  },
  {
    key: "backup-recovery",
    title: "Backup & Recovery Policy",
    category: "operations",
    description: "Requirements for data backup frequency, offsite storage, encryption, and tested restoration to meet RTO/RPO targets. Satisfies CMMC CP.2.001, FedRAMP CP-9, SOC 2 A1.2.",
    content: loadTemplate("backup-recovery"),
  },
  {
    key: "patch-management",
    title: "Patch Management Policy",
    category: "security",
    description: "SLA-based requirements for scanning, prioritizing, and applying security patches to OS, applications, containers, and cloud infrastructure. Satisfies CMMC SI.2.214, FedRAMP SI-2, SOC 2 CC7.1.",
    content: loadTemplate("patch-management"),
  },
  {
    key: "identity-management",
    title: "Identity & Access Management Policy",
    category: "security",
    description: "Standards for user provisioning, deprovisioning, SSO, access reviews, and privileged account management. Satisfies CMMC AC.1.001, FedRAMP AC-2, SOC 2 CC6.2.",
    content: loadTemplate("identity-management"),
  },
  {
    key: "configuration-management",
    title: "Configuration Management Policy",
    category: "operations",
    description: "Requirements for security baseline configuration, IaC standards, configuration drift detection, and change control. Satisfies CMMC CM.2.061, FedRAMP CM-6, SOC 2 CC8.1.",
    content: loadTemplate("configuration-management"),
  },
  {
    key: "supply-chain-risk",
    title: "Supply Chain Risk Management Policy",
    category: "risk",
    description: "Controls for managing cybersecurity risk from software, hardware, and service suppliers including SBOM, vendor assessments, and CMMC SR domain requirements.",
    content: loadTemplate("supply-chain-risk"),
  },
  {
    key: "contingency-planning",
    title: "Contingency Planning Policy",
    category: "risk",
    description: "Disaster recovery planning, system criticality tiers, RTO/RPO targets, and DR test requirements. Satisfies CMMC CP.2.001, FedRAMP CP-1 through CP-9, SOC 2 A1.2.",
    content: loadTemplate("contingency-planning"),
  },
  {
    key: "personnel-security",
    title: "Personnel Security Policy",
    category: "hr",
    description: "Background screening requirements, security clearance management, and insider threat procedures for personnel with access to sensitive systems.",
    content: loadTemplate("personnel-security"),
  },
  {
    key: "security-authorization",
    title: "Security Assessment & Authorization Policy",
    category: "operations",
    description: "Governs the authorization process for information systems to operate, including ATO lifecycle, continuous monitoring, and POA&M management. Required for FedRAMP CA controls.",
    content: loadTemplate("security-authorization"),
  },
  {
    key: "api-security",
    title: "API Security Policy",
    category: "security",
    description: "Security standards for API design, authentication, rate limiting, input validation, and OWASP API Top 10 compliance.",
    content: loadTemplate("api-security"),
  },
  {
    key: "responsible-disclosure",
    title: "Responsible Disclosure & Vulnerability Reporting Policy",
    category: "security",
    description: "Safe harbor and process for external security researchers to report vulnerabilities, including scope, response timelines, and disclosure coordination.",
    content: loadTemplate("responsible-disclosure"),
  },
  {
    key: "zero-trust",
    title: "Zero Trust Architecture Policy",
    category: "security",
    description: "Governs implementation of never-trust-always-verify principles across identity, device, network, application, and data security domains.",
    content: loadTemplate("zero-trust"),
  },
  {
    key: "cookie-consent",
    title: "Cookie & Consent Management Policy",
    category: "data",
    description: "Cookie categories, consent banner requirements, user rights, and compliance obligations under GDPR, CCPA, and ePrivacy regulations.",
    content: loadTemplate("cookie-consent"),
  },
  {
    key: "iot-security",
    title: "IoT & Connected Device Security Policy",
    category: "security",
    description: "Security controls for Internet of Things devices, operational technology, and other connected hardware used in organizational facilities or networks.",
    content: loadTemplate("iot-security"),
  },
  {
    key: "board-cybersecurity",
    title: "Board-Level Cybersecurity Governance Policy",
    category: "operations",
    description: "CISO reporting cadence to board, board oversight responsibilities, cyber risk appetite, and executive governance of the information security program.",
    content: loadTemplate("board-cybersecurity"),
  },
  {
    key: "mfa-policy",
    title: "Multi-Factor Authentication (MFA) Policy",
    category: "security",
    description: "Mandatory MFA requirements for all organizational systems, approved MFA methods, exceptions process, and enforcement. Highest urgency per remediation plan. Satisfies CMMC IA.3.083, FedRAMP IA-2(1), SOC 2 CC6.1.",
    content: loadTemplate("mfa-policy"),
  },
  {
    key: "privileged-access",
    title: "Privileged Access Management Policy",
    category: "security",
    description: "Controls for provisioning, securing, auditing, and revoking privileged and administrative access. Satisfies CMMC AC.2.006, FedRAMP AC-6(5), SOC 2 CC6.3.",
    content: loadTemplate("privileged-access"),
  },
  {
    key: "endpoint-security",
    title: "Endpoint Security Policy",
    category: "security",
    description: "Security requirements for workstations, laptops, mobile devices, and servers including EDR, full disk encryption, MDM, and removable media controls. Satisfies CMMC MP.2.120, FedRAMP SC-28, SOC 2 CC6.8.",
    content: loadTemplate("endpoint-security"),
  },
  {
    key: "data-breach-response",
    title: "Data Breach Response Policy",
    category: "security",
    description: "Detection, containment, investigation, notification, and post-incident procedures for data breaches and security incidents. Satisfies CMMC IR.2.092, SOC 2 CC7.3, GDPR Article 33.",
    content: loadTemplate("data-breach-response"),
  },
  {
    key: "secure-communications",
    title: "Secure Communications Policy",
    category: "security",
    description: "Requirements for encrypted data transmission, approved communication channels, prohibited practices, and key management. Satisfies CMMC SC.3.177, FedRAMP SC-8, SOC 2 CC6.7.",
    content: loadTemplate("secure-communications"),
  },
  {
    key: "risk-assessment",
    title: "Risk Assessment Policy",
    category: "compliance",
    description: "Framework for identifying, scoring, and treating organizational risk including assessment frequency, risk register management, and risk acceptance criteria. Satisfies CMMC CA.2.157, FedRAMP RA-3, SOC 2 CC9.1.",
    content: loadTemplate("risk-assessment"),
  },
  {
    key: "cmmc-compliance",
    title: "CMMC Compliance Policy",
    category: "federal",
    description: "Policy establishing [Organization Name]'s commitment to CMMC Level 2 compliance, CUI handling requirements, subcontractor obligations, and assessment schedule. Satisfies DFARS 252.204-7012 and NIST SP 800-171.",
    content: loadTemplate("cmmc-compliance"),
  },
  {
    key: "fedramp-compliance",
    title: "FedRAMP Compliance Policy",
    category: "federal",
    description: "Policy establishing [Organization Name]'s commitment to FedRAMP Moderate authorization, including SSP maintenance, ConMon obligations, and the authorization boundary.",
    content: loadTemplate("fedramp-compliance"),
  },
  {
    key: "dpa-template",
    title: "Data Processing Agreement (DPA) Template",
    category: "legal",
    description: "Template DPA for use with clients and subprocessors where ColorCode Solutions acts as a data processor handling personal data. Required before onboarding clients under GDPR Article 28 and SOC 2 C1.2.",
    content: loadTemplate("dpa-template"),
  },
  {
    key: "terms-of-service",
    title: "Terms of Service Template",
    category: "legal",
    description: "Template Terms of Service for the EnterpriseComply platform, covering acceptable use, service commitments, data ownership, liability limitations, and termination. Review by Legal required before publication.",
    content: loadTemplate("terms-of-service"),
  }

];

@Injectable()
export class PoliciesService {
  getTemplates() {
    return { templates: POLICY_TEMPLATES.filter(Boolean) };
  }

  async getOrgPolicies(orgId: number) {
    const policies = await db.query.orgPoliciesTable.findMany({
      where: eq(orgPoliciesTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    const ackCounts = await Promise.all(
      policies.map(async (p) => {
        const acks = await db.query.orgPolicyAcknowledgmentsTable.findMany({
          where: eq(orgPolicyAcknowledgmentsTable.policyId, p.id),
        });
        return { policyId: p.id, count: acks.length };
      }),
    );
    const ackMap = new Map(ackCounts.map((a) => [a.policyId, a.count]));
    return {
      policies: policies.map((p) => ({
        ...p,
        acknowledgedCount: ackMap.get(p.id) ?? 0,
        lastReviewedAt: (p as any).last_reviewed_at ?? null,
        version: (p as any).version ?? "1.0",
      })),
    };
  }

  async createPolicy(orgId: number, body: Record<string, unknown>) {
    const [policy] = await db.insert(orgPoliciesTable).values({ orgId, ...body } as any).returning();
    await writeAuditLog(orgId, "policy.created", "policy", String(policy.id), { title: policy.title, status: policy.status });
    return { policy };
  }

  async updatePolicy(orgId: number, id: number, body: Record<string, unknown>) {
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.status === "published") {
      updates.publishedAt = new Date();
    }
    const [policy] = await db
      .update(orgPoliciesTable)
      .set(updates)
      .where(and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)))
      .returning();
    const action = body.status === "published" ? "policy.published" : "policy.updated";
    await writeAuditLog(orgId, action, "policy", String(id), { title: policy?.title, status: policy?.status });
    return { policy };
  }

  async deletePolicy(orgId: number, id: number) {
    await db
      .delete(orgPoliciesTable)
      .where(and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)));
    await writeAuditLog(orgId, "policy.deleted", "policy", String(id));
    return { success: true };
  }

  async getAcknowledgments(orgId: number, policyId: number) {
    const acks = await db.query.orgPolicyAcknowledgmentsTable.findMany({
      where: and(
        eq(orgPolicyAcknowledgmentsTable.orgId, orgId),
        eq(orgPolicyAcknowledgmentsTable.policyId, policyId),
      ),
    });
    const people = await db.query.orgPeopleTable.findMany({
      where: eq(orgPeopleTable.orgId, orgId),
    });
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    return {
      acknowledgments: acks.map((a) => ({
        ...a,
        person: peopleMap.get(a.personId) ?? null,
      })),
      total: people.length,
      acknowledged: acks.length,
      pending: Math.max(0, people.length - acks.length),
    };
  }

  async acknowledgePolicy(orgId: number, policyId: number, body: { personId: number; ipAddress?: string }) {
    const existing = await db.query.orgPolicyAcknowledgmentsTable.findFirst({
      where: and(
        eq(orgPolicyAcknowledgmentsTable.orgId, orgId),
        eq(orgPolicyAcknowledgmentsTable.policyId, policyId),
        eq(orgPolicyAcknowledgmentsTable.personId, body.personId),
      ),
    });
    if (existing) return { acknowledgment: existing, alreadyAcknowledged: true };

    const [ack] = await db.insert(orgPolicyAcknowledgmentsTable).values({
      orgId,
      policyId,
      personId: body.personId,
      ipAddress: body.ipAddress,
    }).returning();
    await writeAuditLog(orgId, "policy.acknowledged", "policy", String(policyId), { personId: body.personId });
    return { acknowledgment: ack, alreadyAcknowledged: false };
  }

  async bulkRequestAcknowledgment(orgId: number, policyId: number) {
    const policy = await db.query.orgPoliciesTable.findFirst({
      where: and(eq(orgPoliciesTable.id, policyId), eq(orgPoliciesTable.orgId, orgId)),
    });
    if (!policy) return { success: false };
    const people = await db.query.orgPeopleTable.findMany({
      where: and(eq(orgPeopleTable.orgId, orgId), eq(orgPeopleTable.active, true)),
    });
    await writeAuditLog(orgId, "policy.ack_requested", "policy", String(policyId), { title: policy.title, recipients: people.length });
    return { requested: people.length, policy };
  }

  async getPolicyReviews(orgId: number, policyId: number) {
    await this.ensurePolicyReviewsTable();
    const rows = await db.execute(
      sql`SELECT * FROM org_policy_reviews WHERE org_id = \${orgId} AND policy_id = \${policyId} ORDER BY reviewed_at DESC LIMIT 50`
    );
    return { reviews: rows.rows ?? rows };
  }

  async reviewPolicy(orgId: number, id: number, body: { notes?: string; bumpVersion?: boolean }) {
    await this.ensurePolicyReviewsTable();
    const existing = await db.query.orgPoliciesTable.findFirst({
      where: and(eq(orgPoliciesTable.id, id), eq(orgPoliciesTable.orgId, orgId)),
    });
    if (!existing) throw new Error("Policy not found");
    const currentVersion = String((existing as any).version ?? "1.0");
    let newVersion = currentVersion;
    if (body.bumpVersion) {
      const parts = currentVersion.split(".");
      const minor = parseInt(parts[1] ?? "0", 10) + 1;
      newVersion = `${parts[0]}.${minor}`;
    }
    const now = new Date();
    await db.execute(
      sql`UPDATE org_policies SET status = 'published', last_reviewed_at = \${now}, version = \${newVersion}, updated_at = \${now} WHERE id = \${id} AND org_id = \${orgId}`
    );
    await db.execute(
      sql`INSERT INTO org_policy_reviews (org_id, policy_id, notes, version_before, version_after, reviewed_at) VALUES (\${orgId}, \${id}, \${body.notes ?? null}, \${currentVersion}, \${newVersion}, \${now})`
    );
    await writeAuditLog(orgId, "policy.reviewed", "policy", String(id), { title: existing.title, version: newVersion, notes: body.notes });
    return { success: true, version: newVersion, reviewedAt: now };
  }

  private async ensurePolicyReviewsTable() {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS org_policy_reviews (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL,
        policy_id INTEGER NOT NULL,
        notes TEXT,
        version_before TEXT,
        version_after TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

}
