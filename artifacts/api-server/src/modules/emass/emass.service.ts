import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable, orgPoamItemsTable, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { writeAuditLog } from "../../lib/audit-log.js";

export interface EMassUpdate {
  id: string;
  orgId: number;
  ucoControlId: string;
  nistControlId: string;
  nistControlName: string;
  status: "compliant" | "non_compliant" | "not_tested";
  result: string;
  poamId?: number;
  poamWeakness?: string;
  scheduledCompletionDate?: string;
  createdAt: string;
  requiresEdipi: boolean;
}

export interface EnclaveAgentPullResponse {
  updates: EMassUpdate[];
  count: number;
  nextPollAt: string;
}

// In-memory secure queue (production: replace with AWS SQS or Redis Streams)
// Each org has its own queue partition
const eMassQueue: Map<number, EMassUpdate[]> = new Map();

function queueFor(orgId: number): EMassUpdate[] {
  if (!eMassQueue.has(orgId)) eMassQueue.set(orgId, []);
  return eMassQueue.get(orgId)!;
}

@Injectable()
export class EMassService {
  // Called by the UCO engine when a NIST 800-53 control changes status
  async queueUpdate(orgId: number, ucoControlId: string, status: string, result: string): Promise<void> {
    // Find NIST 800-53 mappings for this UCO control
    const mappings = await db.query.ucoFrameworkMappingsTable.findMany({
      where: and(
        eq(ucoFrameworkMappingsTable.ucoControlId, ucoControlId),
        inArray(ucoFrameworkMappingsTable.frameworkKey, ["NIST800-53", "FedRAMP", "NIST800-171"])
      ),
    });
    if (mappings.length === 0) return;

    const queue = queueFor(orgId);
    for (const mapping of mappings) {
      const update: EMassUpdate = {
        id: `emass-${orgId}-${ucoControlId}-${Date.now()}`,
        orgId,
        ucoControlId,
        nistControlId: mapping.frameworkControlId ?? ucoControlId,
        nistControlName: mapping.frameworkControlName ?? ucoControlId,
        status: status as EMassUpdate["status"],
        result,
        createdAt: new Date().toISOString(),
        requiresEdipi: true,
      };
      // Check for associated POAM items
      const poamItems = await db.query.orgPoamItemsTable.findMany({
        where: eq(orgPoamItemsTable.orgId, orgId),
      });
      const relatedPoam = poamItems.find(p => p.ucoControlId === ucoControlId && p.status !== "closed");
      if (relatedPoam) {
        update.poamId = relatedPoam.id;
        update.poamWeakness = String(relatedPoam.weakness ?? relatedPoam.description ?? "");
        update.scheduledCompletionDate = relatedPoam.scheduledCompletionDate
          ? new Date(relatedPoam.scheduledCompletionDate).toISOString()
          : undefined;
      }
      queue.push(update);
    }
  }

  // Bulk queue all non-compliant NIST controls for an org (called on-demand or on schedule)
  async queueAllFailingControls(orgId: number): Promise<{ queued: number }> {
    const failingControls = await db.query.orgControlResultsTable.findMany({
      where: and(eq(orgControlResultsTable.orgId, orgId), eq(orgControlResultsTable.status, "non_compliant")),
    });
    let queued = 0;
    for (const ctrl of failingControls) {
      await this.queueUpdate(orgId, ctrl.ucoControlId, ctrl.status, ctrl.result ?? "Non-compliant per UCO engine");
      queued++;
    }
    return { queued };
  }

  // The Enclave-Native Agent pulls updates from this endpoint
  // Agent authenticates with: Authorization: Bearer <agent-token>
  // In production: mutual TLS with DoD PKI cert negotiated at TLS layer
  async pullForAgent(orgId: number, agentId: string, edipi?: string): Promise<EnclaveAgentPullResponse> {
    const queue = queueFor(orgId);
    // Attach EDIPI to all updates if provided (required by eMASS)
    const updates = queue.splice(0, 50).map(u => ({
      ...u,
      edipi: edipi ?? null,
      userUidHeader: edipi ? `edipi:${edipi}` : null,
    }));
    // Schedule next poll based on queue depth
    const remainingDepth = queue.length;
    const nextPollSeconds = remainingDepth > 0 ? 30 : 300;
    const nextPollAt = new Date(Date.now() + nextPollSeconds * 1000).toISOString();
    return { updates, count: updates.length, nextPollAt } as EnclaveAgentPullResponse;
  }

  // Get queue depth (monitoring)
  async getQueueStatus(orgId: number): Promise<{ depth: number; oldestItem: string | null; newestItem: string | null }> {
    const queue = queueFor(orgId);
    return {
      depth: queue.length,
      oldestItem: queue[0]?.createdAt ?? null,
      newestItem: queue[queue.length - 1]?.createdAt ?? null,
    };
  }

  // Acknowledge delivery (agent calls this after successful eMASS POST)
  async acknowledge(orgId: number, updateIds: string[]): Promise<{ acknowledged: number }> {
    const queue = queueFor(orgId);
    const before = queue.length;
    const filtered = queue.filter(u => !updateIds.includes(u.id));
    eMassQueue.set(orgId, filtered);
    return { acknowledged: before - filtered.length };
  }

  // List pending updates (for admin visibility)
  async listPending(orgId: number): Promise<{ updates: EMassUpdate[]; depth: number }> {
    const queue = queueFor(orgId);
    return { updates: [...queue], depth: queue.length };
  }

  // Generate eMASS-formatted POA&M export (XLSX-ready JSON)
  async exportPoamForeMass(orgId: number): Promise<{ items: Record<string, unknown>[] }> {
    const poamItems = await db.query.orgPoamItemsTable.findMany({
      where: eq(orgPoamItemsTable.orgId, orgId),
    });
    const items = poamItems.map(item => ({
      "POA&M Item ID": item.id,
      "Control Vulnerability Description": item.weakness ?? item.description,
      "Security Control Number": item.controlId ?? item.ucoControlId,
      "Office/Org": "Information Security Office",
      "Security Checks": item.ucoControlId,
      "Resources Required": item.resourcesRequired ?? "TBD",
      "Scheduled Completion Date": item.scheduledCompletionDate ?? "",
      "Milestone with Completion Dates": item.milestones ?? "",
      "Milestone Changes": "",
      "Status": item.status,
      "Comments": item.remediationNotes ?? "",
      "Raw Severity": item.severity ?? "Moderate",
      "Devices Affected": item.devicesAffected ?? "",
      "Mitigations": item.mitigationStatement ?? "",
      "Severity": item.severity ?? "Moderate",
      "Relevance of Threat": item.threatRelevance ?? "Applicable",
      "Threat Description": item.threatDescription ?? "",
      "Likelihood": item.likelihood ?? "Moderate",
      "Impact": item.impact ?? "Moderate",
      "Impact Description": item.impactDescription ?? "",
      "Residual Risk Level": item.residualRisk ?? "Low",
      "Recommendations": item.recommendations ?? "",
    }));
    return { items };
  }
}
