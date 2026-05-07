import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db, orgQuestionnairesTable, orgQuestionnaireItemsTable,
  orgControlResultsTable, orgEvidenceTable, ucoControlsTable,
  orgVendorAssessmentsTable, orgVendorsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const QUESTION_CATEGORY_MAP: Record<string, string[]> = {
  access_control: ["UCO-AC-001", "UCO-AC-002", "UCO-AC-003", "UCO-AI-001", "UCO-AI-002"],
  encryption: ["UCO-DP-002", "UCO-DP-003"],
  incident_response: ["UCO-IR-001", "UCO-IR-002"],
  vulnerability_management: ["UCO-VM-001", "UCO-VM-002"],
  change_management: ["UCO-CM-001", "UCO-CM-002", "UCO-CM-003"],
  data_protection: ["UCO-DP-001", "UCO-DP-002"],
  audit_logging: ["UCO-AL-001", "UCO-AL-002"],
  security_training: ["UCO-ST-001"],
  third_party: ["UCO-TP-001"],
};

@Injectable()
export class QuestionnairesService {
  async getQuestionnaires(orgId: number) {
    const questionnaires = await db.query.orgQuestionnairesTable.findMany({
      where: eq(orgQuestionnairesTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return { questionnaires };
  }

  async createQuestionnaire(orgId: number, clerkUserId: string, body: {
    title: string; requesterName?: string; requesterCompany?: string;
    requesterEmail?: string; type?: string; dueDate?: string;
    questions: string[];
  }) {
    const [questionnaire] = await db.insert(orgQuestionnairesTable).values({
      orgId,
      title: body.title,
      requesterName: body.requesterName,
      requesterCompany: body.requesterCompany,
      requesterEmail: body.requesterEmail,
      type: body.type ?? "custom",
      totalItems: body.questions.length,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdBy: clerkUserId,
    }).returning();

    const controlResults = await db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    });
    const evidence = await db.query.orgEvidenceTable.findMany({
      where: eq(orgEvidenceTable.orgId, orgId),
    });

    const resultMap = new Map(controlResults.map((r) => [r.ucoControlId, r]));

    const items = await Promise.all(
      body.questions.map(async (question, idx) => {
        const { answer, controlId, confidence } = this.autoAnswer(question, resultMap, evidence);
        return db.insert(orgQuestionnaireItemsTable).values({
          orgId,
          questionnaireId: questionnaire.id,
          question,
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

    return { questionnaire: { ...questionnaire, answeredItems: answered } };
  }

  async getItems(orgId: number, questionnaireId: number) {
    const items = await db.query.orgQuestionnaireItemsTable.findMany({
      where: and(
        eq(orgQuestionnaireItemsTable.orgId, orgId),
        eq(orgQuestionnaireItemsTable.questionnaireId, questionnaireId),
      ),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    });
    return { items };
  }

  async updateItem(orgId: number, itemId: number, body: { answer: string }) {
    const [item] = await db.update(orgQuestionnaireItemsTable)
      .set({ answer: body.answer, status: "answered" })
      .where(and(
        eq(orgQuestionnaireItemsTable.orgId, orgId),
        eq(orgQuestionnaireItemsTable.id, itemId),
      ))
      .returning();
    return { item };
  }

  async deleteQuestionnaire(orgId: number, id: number) {
    const existing = await db.query.orgQuestionnairesTable.findFirst({
      where: and(eq(orgQuestionnairesTable.orgId, orgId), eq(orgQuestionnairesTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Questionnaire not found");
    await db.delete(orgQuestionnaireItemsTable).where(
      and(eq(orgQuestionnaireItemsTable.orgId, orgId), eq(orgQuestionnaireItemsTable.questionnaireId, id)),
    );
    await db.delete(orgQuestionnairesTable).where(
      and(eq(orgQuestionnairesTable.orgId, orgId), eq(orgQuestionnairesTable.id, id)),
    );
    return { success: true };
  }

  async getVendorAssessments(orgId: number) {
    const assessments = await db.query.orgVendorAssessmentsTable.findMany({
      where: eq(orgVendorAssessmentsTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.sentAt)],
    });
    const vendors = await db.query.orgVendorsTable.findMany({
      where: eq(orgVendorsTable.orgId, orgId),
    });
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    return {
      assessments: assessments.map((a) => ({
        ...a,
        vendor: vendorMap.get(a.vendorId) ?? null,
      })),
    };
  }

  async sendVendorAssessment(orgId: number, clerkUserId: string, body: {
    vendorId: number; templateType: string; dueDate?: string;
  }) {
    const vendor = await db.query.orgVendorsTable.findFirst({
      where: and(eq(orgVendorsTable.orgId, orgId), eq(orgVendorsTable.id, body.vendorId)),
    });
    if (!vendor) throw new Error("Vendor not found");

    const templateItems: Record<string, number> = {
      "sig-lite": 30,
      "caiq": 50,
      "custom": 20,
    };

    const [assessment] = await db.insert(orgVendorAssessmentsTable).values({
      orgId,
      vendorId: body.vendorId,
      templateType: body.templateType,
      status: "sent",
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      totalItems: templateItems[body.templateType] ?? 20,
      createdBy: clerkUserId,
    }).returning();
    return { assessment };
  }

  private autoAnswer(
    question: string,
    resultMap: Map<string, { status: string; result?: string | null }>,
    evidence: { title: string; description?: string | null }[],
  ): { answer: string; controlId?: string; confidence: number } {
    const q = question.toLowerCase();

    if (q.includes("mfa") || q.includes("multi-factor") || q.includes("two-factor")) {
      const r = resultMap.get("UCO-AI-001");
      if (r?.status === "passing") return { answer: "Yes, multi-factor authentication is enforced for all user accounts and privileged access.", controlId: "UCO-AI-001", confidence: 0.92 };
      if (r?.status === "failing") return { answer: "MFA is not currently enforced for all accounts. This is an identified gap with a remediation plan in place.", controlId: "UCO-AI-001", confidence: 0.88 };
    }
    if (q.includes("encrypt") || q.includes("encryption")) {
      const r = resultMap.get("UCO-DP-002");
      if (r?.status === "passing") return { answer: "All data is encrypted at rest using AES-256 and in transit using TLS 1.2+.", controlId: "UCO-DP-002", confidence: 0.90 };
    }
    if (q.includes("access review") || q.includes("access control") || q.includes("least privilege")) {
      const r = resultMap.get("UCO-AC-001");
      if (r?.status === "passing") return { answer: "Access controls are enforced based on role-based access control (RBAC) with least privilege principles. Quarterly access reviews are conducted.", controlId: "UCO-AC-001", confidence: 0.85 };
    }
    if (q.includes("incident") || q.includes("breach")) {
      const r = resultMap.get("UCO-IR-001");
      if (r?.status === "passing") return { answer: "We maintain a documented incident response plan tested annually. Our target response time for critical incidents is 4 hours.", controlId: "UCO-IR-001", confidence: 0.87 };
    }
    if (q.includes("vulnerability") || q.includes("patching") || q.includes("patch")) {
      const r = resultMap.get("UCO-VM-001");
      if (r?.status === "passing") return { answer: "We conduct weekly vulnerability scans and apply critical patches within 30 days per our vulnerability management policy.", controlId: "UCO-VM-001", confidence: 0.83 };
    }
    if (q.includes("audit log") || q.includes("logging") || q.includes("monitoring")) {
      const r = resultMap.get("UCO-AL-001");
      if (r?.status === "passing") return { answer: "Comprehensive audit logging is enabled for all system access and administrative actions. Logs are retained for 12 months.", controlId: "UCO-AL-001", confidence: 0.86 };
    }
    if (q.includes("training") || q.includes("security awareness")) {
      const r = resultMap.get("UCO-ST-001");
      if (r?.status === "passing") return { answer: "All employees complete annual security awareness training. Completion is tracked and enforced as part of onboarding.", controlId: "UCO-ST-001", confidence: 0.84 };
    }
    if (q.includes("backup") || q.includes("recovery") || q.includes("continuity")) {
      return { answer: "We maintain automated daily backups with tested restoration procedures. Our RTO is 4 hours and RPO is 24 hours.", confidence: 0.75 };
    }
    if (q.includes("soc 2") || q.includes("iso 27001") || q.includes("certification")) {
      return { answer: "Our compliance posture is managed through EnterpriseComply. We are actively pursuing SOC 2 Type II certification.", confidence: 0.80 };
    }
    return { answer: "", confidence: 0 };
  }
}
