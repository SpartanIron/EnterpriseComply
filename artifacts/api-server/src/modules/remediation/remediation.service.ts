import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db,
  orgRemediationTasksTable,
  orgControlResultsTable,
  ucoControlsTable,
  orgFrameworksTable,
  ucoFrameworkMappingsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

@Injectable()
export class RemediationService {
  // ── List all tasks for an org ──────────────────────────────────────────────
  async list(orgId: number, filter?: { status?: string; priority?: string; controlId?: string }) {
    const tasks = await db.query.orgRemediationTasksTable.findMany({
      where: eq(orgRemediationTasksTable.orgId, orgId),
      orderBy: [desc(orgRemediationTasksTable.createdAt)],
    });
    let filtered = tasks;
    if (filter?.status) filtered = filtered.filter((t) => t.status === filter.status);
    if (filter?.priority) filtered = filtered.filter((t) => t.priority === filter.priority);
    if (filter?.controlId) filtered = filtered.filter((t) => t.ucoControlId === filter.controlId);
    const summary = {
      total: filtered.length,
      open: filtered.filter((t) => t.status === "open").length,
      inProgress: filtered.filter((t) => t.status === "in_progress").length,
      blocked: filtered.filter((t) => t.status === "blocked").length,
      done: filtered.filter((t) => t.status === "done").length,
      verified: filtered.filter((t) => t.status === "verified").length,
      overdue: filtered.filter((t) => t.dueDate && t.dueDate < new Date() && !["done", "verified"].includes(t.status)).length,
      quickWins: filtered.filter((t) => t.quickWin && t.status === "open").length,
    };
    return { tasks: filtered, summary };
  }

  // ── Get single task ────────────────────────────────────────────────────────
  async getById(orgId: number, id: number) {
    const task = await db.query.orgRemediationTasksTable.findFirst({
      where: and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)),
    });
    if (!task) throw new NotFoundException("Remediation task not found");
    return { task };
  }

  // ── Create a manual task ───────────────────────────────────────────────────
  async create(orgId: number, clerkUserId: string, body: {
    ucoControlId: string;
    title: string;
    description?: string;
    priority?: string;
    assigneeName?: string;
    assigneeEmail?: string;
    effortDays?: number;
    dueDate?: string;
    actionSteps?: string[];
    notes?: string;
    quickWin?: boolean;
  }) {
    // Resolve control name and frameworks benefited
    const control = await db.query.ucoControlsTable.findFirst({
      where: eq(ucoControlsTable.controlId, body.ucoControlId),
    });
    const mappings = await db.query.ucoFrameworkMappingsTable.findMany({
      where: eq(ucoFrameworkMappingsTable.ucoControlId, body.ucoControlId),
    });
    const activeFrameworks = await db.query.orgFrameworksTable.findMany({
      where: and(eq(orgFrameworksTable.orgId, orgId), eq(orgFrameworksTable.active, true)),
    });
    const activeKeys = new Set(activeFrameworks.map((f) => f.frameworkKey));
    const frameworksBenefited = [...new Set(mappings
      .filter((m) => activeKeys.has(m.frameworkKey))
      .map((m) => activeFrameworks.find((f) => f.frameworkKey === m.frameworkKey)?.shortName ?? m.frameworkKey)
    )];

    const [task] = await db.insert(orgRemediationTasksTable).values({
      orgId,
      ucoControlId: body.ucoControlId,
      controlName: control?.name ?? body.ucoControlId,
      title: body.title,
      description: body.description,
      priority: body.priority ?? "medium",
      assigneeName: body.assigneeName,
      assigneeEmail: body.assigneeEmail,
      effortDays: body.effortDays,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      actionSteps: body.actionSteps ?? [],
      notes: body.notes,
      quickWin: body.quickWin ?? false,
      frameworksBenefited,
      source: "manual",
      createdBy: clerkUserId,
    } as any).returning();
    return { task };
  }

  // ── Bulk create tasks from gap analysis results ────────────────────────────
  async bulkCreateFromGapAnalysis(orgId: number, clerkUserId: string, items: Array<{
    controlId: string;
    controlName?: string;
    priority: string;
    effort?: string;
    effortDays?: number;
    impact?: string;
    actionSteps?: string[];
    frameworksBenefited?: string[];
    quickWin?: boolean;
  }>) {
    const created = [];
    for (const item of items) {
      const existing = await db.query.orgRemediationTasksTable.findFirst({
        where: and(
          eq(orgRemediationTasksTable.orgId, orgId),
          eq(orgRemediationTasksTable.ucoControlId, item.controlId),
          eq(orgRemediationTasksTable.status, "open"),
        ),
      });
      if (existing) continue; // Skip duplicate open tasks for the same control
      const [task] = await db.insert(orgRemediationTasksTable).values({
        orgId,
        ucoControlId: item.controlId,
        controlName: item.controlName ?? item.controlId,
        title: `Remediate ${item.controlName ?? item.controlId}`,
        description: item.impact ?? `This control is failing and must be remediated to improve compliance posture.`,
        priority: item.priority,
        effortDays: item.effortDays,
        actionSteps: item.actionSteps ?? [],
        frameworksBenefited: item.frameworksBenefited ?? [],
        quickWin: item.quickWin ?? false,
        source: "gap-analysis-auto",
        createdBy: clerkUserId,
      } as any).returning();
      created.push(task);
    }
    return { created: created.length, tasks: created };
  }
  // ── Update task status / fields ────────────────────────────────────────────
  async update(orgId: number, id: number, body: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assigneeName: string;
    assigneeEmail: string;
    effortDays: number;
    dueDate: string;
    notes: string;
    blockerReason: string;
    actionSteps: string[];
    quickWin: boolean;
  }>) {
    const existing = await db.query.orgRemediationTasksTable.findFirst({
      where: and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)),
    });
    if (!existing) throw new NotFoundException("Remediation task not found");
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "in_progress" && !existing.startedAt) updates.startedAt = new Date();
      if (body.status === "done" && !existing.completedAt) {
        updates.completedAt = new Date();
        updates.reTestRequested = true;
        updates.reTestAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Re-test in 24h
      }
    }
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.assigneeName !== undefined) updates.assigneeName = body.assigneeName;
    if (body.assigneeEmail !== undefined) updates.assigneeEmail = body.assigneeEmail;
    if (body.effortDays !== undefined) updates.effortDays = body.effortDays;
    if (body.dueDate !== undefined) updates.dueDate = new Date(body.dueDate);
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.blockerReason !== undefined) updates.blockerReason = body.blockerReason;
    if (body.actionSteps !== undefined) updates.actionSteps = body.actionSteps;
    if (body.quickWin !== undefined) updates.quickWin = body.quickWin;
    const [task] = await db.update(orgRemediationTasksTable)
      .set(updates as any)
      .where(and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)))
      .returning();
    return { task };
  }

  // ── Delete a task ──────────────────────────────────────────────────────────
  async delete(orgId: number, id: number) {
    await db.delete(orgRemediationTasksTable)
      .where(and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)));
    return { success: true };
  }

  // ── Re-test: check if a completed task's control is now passing ───────────
  async reTest(orgId: number, id: number) {
    const task = await db.query.orgRemediationTasksTable.findFirst({
      where: and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)),
    });
    if (!task) throw new NotFoundException("Remediation task not found");
    const controlResult = await db.query.orgControlResultsTable.findFirst({
      where: and(
        eq(orgControlResultsTable.orgId, orgId),
        eq(orgControlResultsTable.ucoControlId, task.ucoControlId),
      ),
    });
    const isPassing = controlResult?.status === "passing";
    const reTestResult = isPassing ? "passed" : "failed";
    const newStatus = isPassing ? "verified" : "open";
    const [updated] = await db.update(orgRemediationTasksTable)
      .set({
        reTestResult,
        reTestRequested: false,
        status: newStatus,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(orgRemediationTasksTable.orgId, orgId), eq(orgRemediationTasksTable.id, id)))
      .returning();
    return { task: updated, reTestResult, controlStatus: controlResult?.status ?? "not_tested" };
  }
             }
