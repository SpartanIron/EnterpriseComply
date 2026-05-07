import { Injectable } from "@nestjs/common";
import { db, orgRisksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
}
