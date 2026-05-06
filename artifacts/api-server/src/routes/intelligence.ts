import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  controlsTable, findingsTable, risksTable, assetsTable,
  attackPathsTable, frameworksTable, evidenceTable,
  controlFrameworkMappingsTable, poamItemsTable,
  complianceJourneysTable, remediationTasksTable,
  executiveBriefingsTable,
} from "@workspace/db";
import { eq, sql, and, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

// ── Executive Briefing ────────────────────────────────────────────────────────
router.get("/intelligence/briefing", async (req, res): Promise<void> => {
  const latest = await db
    .select()
    .from(executiveBriefingsTable)
    .orderBy(desc(executiveBriefingsTable.generatedAt))
    .limit(1);

  const STALE_MS = 5 * 60 * 1000; // 5 min
  if (latest[0] && Date.now() - latest[0].generatedAt.getTime() < STALE_MS) {
    res.json(formatBriefing(latest[0]));
    return;
  }

  // Generate new briefing from live data
  const briefing = await generateBriefing();
  const [saved] = await db.insert(executiveBriefingsTable).values(briefing).returning();
  res.json(formatBriefing(saved));
});

router.post("/intelligence/briefing/refresh", async (req, res): Promise<void> => {
  const briefing = await generateBriefing();
  const [saved] = await db.insert(executiveBriefingsTable).values(briefing).returning();
  res.json(formatBriefing(saved));
});

router.get("/intelligence/financial-exposure", async (req, res): Promise<void> => {
  const assets = await db.select().from(assetsTable);
  const risks  = await db.select().from(risksTable).where(eq(risksTable.status, "open"));

  let low = 0, high = 0;
  for (const r of risks) {
    const assetMultiplier = r.affectedAssets.length;
    const base = baseLoss(r.severity) * r.exploitability * assetMultiplier;
    low  += base * 0.3;
    high += base * 1.8;
  }

  res.json({ exposureLow: Math.round(low), exposureHigh: Math.round(high), methodology: "FAIR-lite", computedAt: new Date().toISOString() });
});

// ── Gap Analysis ──────────────────────────────────────────────────────────────
router.get("/frameworks/:frameworkKey/gap-analysis", async (req, res): Promise<void> => {
  const { frameworkKey } = req.params;

  const mappings = await db
    .select()
    .from(controlFrameworkMappingsTable)
    .where(eq(controlFrameworkMappingsTable.frameworkKey, frameworkKey));

  const controls = await db.select().from(controlsTable);
  const ctrlMap = new Map(controls.map(c => [c.controlId, c]));

  const items = mappings.map(m => {
    const ctrl = ctrlMap.get(m.controlId);
    let gapStatus: "covered" | "partial" | "gap" | "inherited" = "gap";
    if (m.inherited) gapStatus = "inherited";
    else if (!ctrl) gapStatus = "gap";
    else if (ctrl.status === "effective" && ctrl.evidenceFresh) gapStatus = "covered";
    else if (ctrl.status === "degraded" || !ctrl.evidenceFresh) gapStatus = "partial";
    else if (ctrl.status === "failed" || ctrl.status === "unknown") gapStatus = "gap";
    else gapStatus = "covered";

    return {
      frameworkControlId: m.frameworkControlId,
      frameworkControlName: m.frameworkControlName,
      canonicalControlId: m.controlId,
      canonicalControlName: ctrl?.name ?? "Unmapped",
      gapStatus,
      controlStatus: ctrl?.status ?? "unknown",
      evidenceFresh: ctrl?.evidenceFresh ?? false,
      effectiveness: ctrl?.effectiveness ?? 0,
      inherited: m.inherited,
      inheritedFrom: m.inheritedFrom ?? null,
      customerResponsibility: m.customerResponsibility,
      mappingRationale: m.mappingRationale ?? null,
    };
  });

  const covered  = items.filter(i => i.gapStatus === "covered").length;
  const partial  = items.filter(i => i.gapStatus === "partial").length;
  const gap      = items.filter(i => i.gapStatus === "gap").length;
  const inherited = items.filter(i => i.gapStatus === "inherited").length;
  const total    = items.length;
  const readinessScore = total > 0 ? Math.round(((covered + inherited + partial * 0.5) / total) * 100) : 0;

  res.json({ frameworkKey, total, covered, partial, gap, inherited, readinessScore, items });
});

router.get("/frameworks/:frameworkKey/audit-readiness", async (req, res): Promise<void> => {
  const { frameworkKey } = req.params;

  const [framework] = await db.select().from(frameworksTable).where(eq(frameworksTable.frameworkKey, frameworkKey));
  const mappings = await db.select().from(controlFrameworkMappingsTable).where(eq(controlFrameworkMappingsTable.frameworkKey, frameworkKey));
  const controls = await db.select().from(controlsTable);
  const ctrlMap  = new Map(controls.map(c => [c.controlId, c]));

  const blockers = mappings
    .filter(m => {
      if (m.inherited) return false;
      const c = ctrlMap.get(m.controlId);
      return !c || c.status === "failed" || c.status === "unknown";
    })
    .slice(0, 5)
    .map(m => ({
      frameworkControlId: m.frameworkControlId,
      frameworkControlName: m.frameworkControlName,
      canonicalControlId: m.controlId,
      reason: "Control failed or unmapped — authorization blocked",
    }));

  const covered = mappings.filter(m => {
    if (m.inherited) return true;
    const c = ctrlMap.get(m.controlId);
    return c && c.status === "effective" && c.evidenceFresh;
  }).length;

  const readinessScore = mappings.length > 0 ? Math.round((covered / mappings.length) * 100) : 0;
  const daysToAto = Math.max(30, blockers.length * 21);

  res.json({
    frameworkKey,
    frameworkName: framework?.name ?? frameworkKey,
    readinessScore,
    blockerCount: blockers.length,
    blockers,
    projectedAtoDays: daysToAto,
    totalControls: mappings.length,
    coveredControls: covered,
  });
});

// ── POA&M ─────────────────────────────────────────────────────────────────────
router.get("/poam", async (req, res): Promise<void> => {
  const { frameworkKey, status } = req.query;
  const conditions: ReturnType<typeof eq>[] = [];
  if (frameworkKey) conditions.push(eq(poamItemsTable.frameworkKey, String(frameworkKey)));
  if (status) conditions.push(eq(poamItemsTable.status, String(status)));

  const rows = await db
    .select()
    .from(poamItemsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(poamItemsTable.scheduledCompletionDate));

  res.json(rows.map(r => formatPoam(r)));
});

router.post("/poam", async (req, res): Promise<void> => {
  const { frameworkKey, controlId, title, weakness, description, severity, ownerName, ownerTeam, scheduledCompletionDate, milestones, originalRisk, residualRisk, resources, estimatedCost } = req.body;
  const [row] = await db.insert(poamItemsTable).values({
    frameworkKey, controlId, title, weakness, description,
    severity: severity ?? "high",
    ownerName, ownerTeam,
    scheduledCompletionDate: scheduledCompletionDate ? new Date(scheduledCompletionDate) : undefined,
    milestones: milestones ?? [],
    originalRisk: originalRisk ?? "high",
    residualRisk: residualRisk ?? "medium",
    resources, estimatedCost,
  }).returning();
  res.status(201).json(formatPoam(row));
});

router.patch("/poam/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const allowed = ["status", "milestones", "scheduledCompletionDate", "ownerName", "ownerTeam", "residualRisk", "resources", "estimatedCost"];
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (req.body.status === "closed") updates.closedAt = new Date();
  const [row] = await db.update(poamItemsTable).set(updates).where(eq(poamItemsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPoam(row));
});

// ── Compliance Journeys ───────────────────────────────────────────────────────
router.get("/journeys", async (req, res): Promise<void> => {
  const rows = await db.select().from(complianceJourneysTable).orderBy(desc(complianceJourneysTable.createdAt));
  res.json(rows.map(r => formatJourney(r)));
});

router.post("/journeys", async (req, res): Promise<void> => {
  const { frameworkKey, targetLevel, systemName, systemDescription, systemType, dataClassification, boundaryDescription, leveragedAto, targetAtoDate } = req.body;
  const [row] = await db.insert(complianceJourneysTable).values({
    frameworkKey, targetLevel: targetLevel ?? "moderate",
    systemName, systemDescription, systemType: systemType ?? "saas",
    dataClassification: dataClassification ?? "cui",
    boundaryDescription, leveragedAto,
    targetAtoDate: targetAtoDate ? new Date(targetAtoDate) : undefined,
  }).returning();
  res.status(201).json(formatJourney(row));
});

router.get("/journeys/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(complianceJourneysTable).where(eq(complianceJourneysTable.id, parseInt(req.params.id, 10)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatJourney(row));
});

router.get("/journeys/:id/roadmap", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const tasks = await db.select().from(remediationTasksTable).where(eq(remediationTasksTable.journeyId, id)).orderBy(asc(remediationTasksTable.priority));
  res.json(tasks.map(t => formatTask(t)));
});

router.get("/journeys/:id/readiness", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [journey] = await db.select().from(complianceJourneysTable).where(eq(complianceJourneysTable.id, id));
  if (!journey) { res.status(404).json({ error: "Not found" }); return; }

  const tasks = await db.select().from(remediationTasksTable).where(eq(remediationTasksTable.journeyId, id));
  const done = tasks.filter(t => t.status === "complete").length;
  const total = tasks.length;
  const readiness = total > 0 ? Math.round((done / total) * 100) : 0;
  const blockers = tasks.filter(t => t.status === "not_started" && t.priority <= 20).slice(0, 5);

  res.json({ journeyId: id, frameworkKey: journey.frameworkKey, readinessScore: readiness, totalTasks: total, completedTasks: done, blockers: blockers.map(t => formatTask(t)) });
});

router.patch("/journeys/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const allowed = ["phase", "targetAtoDate", "systemName", "systemDescription", "boundaryDescription"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
  const [row] = await db.update(complianceJourneysTable).set(updates).where(eq(complianceJourneysTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatJourney(row));
});

router.post("/journeys/:id/tasks", async (req, res): Promise<void> => {
  const journeyId = parseInt(req.params.id, 10);
  const { controlId, frameworkKey, title, description, effort, priority, estimatedDays, assignee, team, dueDate } = req.body;
  const [row] = await db.insert(remediationTasksTable).values({
    journeyId, controlId, frameworkKey, title, description,
    effort: effort ?? "medium", priority: priority ?? 50,
    estimatedDays: estimatedDays ?? 14, assignee, team,
    dueDate: dueDate ? new Date(dueDate) : undefined,
  }).returning();
  res.status(201).json(formatTask(row));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const allowed = ["status", "assignee", "team", "dueDate", "priority"];
  for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
  if (req.body.status === "complete") updates.completedAt = new Date();
  const [row] = await db.update(remediationTasksTable).set(updates).where(eq(remediationTasksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatTask(row));
});

// ── Control framework cross-map ───────────────────────────────────────────────
router.get("/controls/:controlId/framework-mappings", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(controlFrameworkMappingsTable)
    .where(eq(controlFrameworkMappingsTable.controlId, req.params.controlId));
  res.json(rows.map(r => ({
    id: String(r.id),
    frameworkKey: r.frameworkKey,
    frameworkControlId: r.frameworkControlId,
    frameworkControlName: r.frameworkControlName,
    inherited: r.inherited,
    inheritedFrom: r.inheritedFrom,
    customerResponsibility: r.customerResponsibility,
    mappingConfidence: r.mappingConfidence,
    mappingRationale: r.mappingRationale,
  })));
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function baseLoss(severity: string): number {
  return { critical: 2_000_000, high: 800_000, medium: 250_000, low: 50_000 }[severity] ?? 100_000;
}

async function generateBriefing() {
  const [posStats] = await db.select({
    effective: sql<number>`count(*) filter (where ${controlsTable.status} = 'effective')`,
    failed:    sql<number>`count(*) filter (where ${controlsTable.status} = 'failed')`,
    total:     sql<number>`count(*)`,
  }).from(controlsTable);

  const [findStats] = await db.select({
    critical: sql<number>`count(*) filter (where ${findingsTable.severity} = 'critical' and ${findingsTable.status} = 'open')`,
    slaBreach: sql<number>`count(*) filter (where ${findingsTable.daysOpen} > coalesce(${findingsTable.remediationSla}, 999) and ${findingsTable.status} != 'resolved')`,
  }).from(findingsTable);

  const risks = await db.select().from(risksTable).where(eq(risksTable.status, "open")).limit(3);
  const frameworks = await db.select().from(frameworksTable).where(eq(frameworksTable.active, true));

  const eff = Number(posStats.effective);
  const tot = Number(posStats.total);
  const score = tot > 0 ? Math.round(((eff) / tot) * 100) : 0;
  const critFinding = Number(findStats.critical);
  const slaBreach   = Number(findStats.slaBreach);

  const frameworksAtRisk = frameworks.filter(f => f.complianceScore < 75).map(f => f.shortName);

  let exposureLow = 0, exposureHigh = 0;
  for (const r of risks) {
    const base = baseLoss(r.severity) * r.exploitability;
    exposureLow  += base * 0.3;
    exposureHigh += base * 1.8;
  }

  const topThreats = risks.slice(0, 3).map(r => ({
    title: r.title,
    severity: r.severity,
    context: `Exploitability ${(r.exploitability * 100).toFixed(0)}% — ${r.attackVectors.slice(0, 2).join(", ")}`,
  }));

  const recommendedActions = [
    critFinding > 0 ? `Resolve ${critFinding} critical open finding${critFinding > 1 ? "s" : ""} before next board review` : null,
    slaBreach > 0   ? `${slaBreach} finding${slaBreach > 1 ? "s" : ""} breached SLA — escalate to engineering leadership` : null,
    frameworksAtRisk.length > 0 ? `${frameworksAtRisk.join(", ")} compliance below 75% threshold — review control gaps` : null,
    Number(posStats.failed) > 0 ? `${posStats.failed} failed control${Number(posStats.failed) > 1 ? "s" : ""} require immediate remediation` : null,
  ].filter(Boolean).slice(0, 4) as string[];

  const scoreLabel = score < 60 ? "critical" : score < 75 ? "at-risk" : "nominal";
  const headline = `Cyber posture is ${scoreLabel} at ${score}/100 — ${critFinding} critical finding${critFinding !== 1 ? "s" : ""} open, estimated exposure $${formatM(exposureLow)}–$${formatM(exposureHigh)}`;
  const postureDelta = Number(posStats.failed) > 0
    ? `${posStats.failed} control${Number(posStats.failed) > 1 ? "s" : ""} failed validation this cycle, dragging posture below target. Largest contributor: ${risks[0]?.title ?? "unknown risk"}.`
    : `Control posture holding at ${score}/100. Evidence freshness and drift detection are the primary maintenance risk.`;

  const situationSummary = `${topThreats.length} active threat vectors identified across the infrastructure. ${frameworksAtRisk.length > 0 ? `${frameworksAtRisk.join(" and ")} compliance requires attention before next audit window. ` : ""}${slaBreach > 0 ? `${slaBreach} finding${slaBreach > 1 ? "s" : ""} exceeded remediation SLA — direct executive intervention required.` : "All SLA commitments currently met."}`;

  return {
    headline,
    postureDelta,
    situationSummary,
    financialExposureLow: Math.round(exposureLow),
    financialExposureHigh: Math.round(exposureHigh),
    topThreatsJson: JSON.stringify(topThreats),
    recommendedActionsJson: JSON.stringify(recommendedActions),
    frameworksAtRiskJson: JSON.stringify(frameworksAtRisk),
    confidenceScore: 0.88,
    dataFreshnessScore: 0.92,
    generatedAt: new Date(),
  };
}

function formatM(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function formatBriefing(r: typeof executiveBriefingsTable.$inferSelect) {
  return {
    id: String(r.id),
    headline: r.headline,
    postureDelta: r.postureDelta,
    situationSummary: r.situationSummary,
    financialExposureLow: r.financialExposureLow,
    financialExposureHigh: r.financialExposureHigh,
    topThreats: JSON.parse(r.topThreatsJson),
    recommendedActions: JSON.parse(r.recommendedActionsJson),
    frameworksAtRisk: JSON.parse(r.frameworksAtRiskJson),
    confidenceScore: r.confidenceScore,
    dataFreshnessScore: r.dataFreshnessScore,
    generatedAt: r.generatedAt.toISOString(),
  };
}

function formatPoam(r: typeof poamItemsTable.$inferSelect) {
  return {
    id: String(r.id), frameworkKey: r.frameworkKey, controlId: r.controlId,
    findingId: r.findingId ? String(r.findingId) : null,
    title: r.title, weakness: r.weakness, description: r.description,
    severity: r.severity, status: r.status, ownerName: r.ownerName, ownerTeam: r.ownerTeam,
    scheduledCompletionDate: r.scheduledCompletionDate?.toISOString() ?? null,
    milestones: r.milestones, originalRisk: r.originalRisk, residualRisk: r.residualRisk,
    resources: r.resources, estimatedCost: r.estimatedCost,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
  };
}

function formatJourney(r: typeof complianceJourneysTable.$inferSelect) {
  return {
    id: String(r.id), frameworkKey: r.frameworkKey, targetLevel: r.targetLevel,
    phase: r.phase, systemName: r.systemName, systemDescription: r.systemDescription,
    systemType: r.systemType, dataClassification: r.dataClassification,
    boundaryDescription: r.boundaryDescription, leveragedAto: r.leveragedAto,
    targetAtoDate: r.targetAtoDate?.toISOString() ?? null,
    authorizedAt: r.authorizedAt?.toISOString() ?? null,
    startedAt: r.startedAt.toISOString(),
  };
}

function formatTask(r: typeof remediationTasksTable.$inferSelect) {
  return {
    id: String(r.id), journeyId: String(r.journeyId), controlId: r.controlId,
    frameworkKey: r.frameworkKey, title: r.title, description: r.description,
    effort: r.effort, priority: r.priority, estimatedDays: r.estimatedDays,
    assignee: r.assignee, team: r.team, status: r.status,
    dependsOn: r.dependsOn,
    dueDate: r.dueDate?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}

export default router;
