import { Injectable } from "@nestjs/common";
import { db, orgPoliciesTable, orgPolicyAcknowledgmentsTable, orgPeopleTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

export const POLICY_TEMPLATES = [
  { key: "acceptable-use", title: "Acceptable Use Policy", category: "security", description: "Defines acceptable use of company systems, data, and resources." },
  { key: "access-control", title: "Access Control Policy", category: "security", description: "Governs how access to systems is granted, managed, and revoked." },
  { key: "incident-response", title: "Incident Response Policy", category: "security", description: "Procedures for detecting, reporting, and responding to security incidents." },
  { key: "data-classification", title: "Data Classification Policy", category: "data", description: "Framework for categorizing and handling data by sensitivity level." },
  { key: "change-management", title: "Change Management Policy", category: "operations", description: "Process for managing changes to production systems and infrastructure." },
  { key: "vendor-management", title: "Vendor Management Policy", category: "risk", description: "Requirements for assessing and managing third-party vendor risk." },
  { key: "business-continuity", title: "Business Continuity Plan", category: "risk", description: "Plans for maintaining operations during and after disruptive events." },
  { key: "password-policy", title: "Password Policy", category: "security", description: "Requirements for password complexity, rotation, storage, and MFA." },
  { key: "remote-work", title: "Remote Work Security Policy", category: "security", description: "Security requirements for remote and distributed workforce." },
  { key: "vulnerability-management", title: "Vulnerability Management Policy", category: "security", description: "Process for identifying, prioritizing, and remediating vulnerabilities." },
  { key: "data-retention", title: "Data Retention & Disposal Policy", category: "data", description: "Rules for retaining, archiving, and securely disposing of data." },
  { key: "encryption", title: "Encryption Policy", category: "security", description: "Standards for encrypting data at rest and in transit." },
  { key: "audit-logging", title: "Audit Logging Policy", category: "security", description: "Requirements for system logging, log integrity, and log retention." },
  { key: "physical-security", title: "Physical Security Policy", category: "operations", description: "Controls for physical access to facilities and hardware assets." },
  { key: "hr-security", title: "HR Security Policy", category: "hr", description: "Security requirements for hiring, onboarding, and offboarding personnel." },
  { key: "third-party-access", title: "Third-Party Access Policy", category: "risk", description: "Requirements for granting and monitoring third-party system access." },
  { key: "mobile-device", title: "Mobile Device & BYOD Policy", category: "security", description: "Rules for using personal and corporate mobile devices to access company data." },
  { key: "network-security", title: "Network Security Policy", category: "security", description: "Standards for network segmentation, firewalls, and secure connectivity." },
  { key: "security-awareness", title: "Security Awareness Training Policy", category: "hr", description: "Requirements for annual security training and phishing simulations." },
  { key: "ai-use", title: "AI & Generative AI Use Policy", category: "operations", description: "Guidelines for employee use of AI tools and handling of AI-generated content." },
  { key: "cloud-security", title: "Cloud Security Policy", category: "security", description: "Controls for cloud infrastructure configuration, access, and monitoring." },
  { key: "software-development", title: "Secure Software Development Policy", category: "operations", description: "Security requirements for SDLC, code review, and production deployments." },
  { key: "asset-management", title: "Asset Management Policy", category: "operations", description: "Inventory, classification, and lifecycle management of hardware and software assets." },
  { key: "privacy", title: "Privacy Policy (Internal)", category: "data", description: "Internal guidelines for handling personal data of employees and customers." },
  { key: "whistleblower", title: "Whistleblower & Ethics Policy", category: "hr", description: "Protections for employees reporting compliance violations or unethical conduct." },
  { key: "clean-desk", title: "Clean Desk & Screen Lock Policy", category: "security", description: "Requirements for securing workstations and physical documents when unattended." },
  { key: "media-handling", title: "Removable Media Policy", category: "security", description: "Controls for use, encryption, and disposal of USB drives and external storage." },
  { key: "backup-recovery", title: "Backup & Recovery Policy", category: "operations", description: "Requirements for data backup frequency, offsite storage, and tested recovery." },
  { key: "patch-management", title: "Patch Management Policy", category: "security", description: "SLAs and procedures for applying OS, application, and firmware patches." },
  { key: "identity-management", title: "Identity & Access Management Policy", category: "security", description: "Standards for user provisioning, deprovisioning, SSO, and privileged accounts." },
];

@Injectable()
export class PoliciesService {
  getTemplates() {
    return { templates: POLICY_TEMPLATES };
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
        acknowledgmentCount: ackMap.get(p.id) ?? 0,
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
}
