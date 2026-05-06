import { pgTable, text, serial, timestamp, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const controlFrameworkMappingsTable = pgTable("control_framework_mappings", {
  id: serial("id").primaryKey(),
  controlId: text("control_id").notNull(),
  frameworkKey: text("framework_key").notNull(),
  frameworkControlId: text("framework_control_id").notNull(),
  frameworkControlName: text("framework_control_name").notNull(),
  inherited: boolean("inherited").notNull().default(false),
  inheritedFrom: text("inherited_from"),
  customerResponsibility: text("customer_responsibility").notNull().default("full"),
  mappingConfidence: real("mapping_confidence").notNull().default(1.0),
  mappingRationale: text("mapping_rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertControlFrameworkMappingSchema = createInsertSchema(controlFrameworkMappingsTable).omit({ id: true, createdAt: true });
export type InsertControlFrameworkMapping = z.infer<typeof insertControlFrameworkMappingSchema>;
export type ControlFrameworkMapping = typeof controlFrameworkMappingsTable.$inferSelect;

export const poamItemsTable = pgTable("poam_items", {
  id: serial("id").primaryKey(),
  frameworkKey: text("framework_key").notNull(),
  controlId: text("control_id").notNull(),
  findingId: integer("finding_id"),
  title: text("title").notNull(),
  weakness: text("weakness").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("high"),
  status: text("status").notNull().default("open"),
  ownerName: text("owner_name").notNull(),
  ownerTeam: text("owner_team").notNull(),
  scheduledCompletionDate: timestamp("scheduled_completion_date", { withTimezone: true }),
  milestones: text("milestones").array().notNull().default([]),
  originalRisk: text("original_risk").notNull().default("high"),
  residualRisk: text("residual_risk").notNull().default("medium"),
  resources: text("resources"),
  estimatedCost: real("estimated_cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertPoamItemSchema = createInsertSchema(poamItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPoamItem = z.infer<typeof insertPoamItemSchema>;
export type PoamItem = typeof poamItemsTable.$inferSelect;

export const complianceJourneysTable = pgTable("compliance_journeys", {
  id: serial("id").primaryKey(),
  frameworkKey: text("framework_key").notNull(),
  targetLevel: text("target_level").notNull().default("moderate"),
  phase: text("phase").notNull().default("gap"),
  systemName: text("system_name").notNull(),
  systemDescription: text("system_description").notNull(),
  systemType: text("system_type").notNull().default("saas"),
  dataClassification: text("data_classification").notNull().default("cui"),
  boundaryDescription: text("boundary_description"),
  leveragedAto: text("leveraged_ato"),
  targetAtoDate: timestamp("target_ato_date", { withTimezone: true }),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertComplianceJourneySchema = createInsertSchema(complianceJourneysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplianceJourney = z.infer<typeof insertComplianceJourneySchema>;
export type ComplianceJourney = typeof complianceJourneysTable.$inferSelect;

export const remediationTasksTable = pgTable("remediation_tasks", {
  id: serial("id").primaryKey(),
  journeyId: integer("journey_id").notNull(),
  controlId: text("control_id").notNull(),
  frameworkKey: text("framework_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  effort: text("effort").notNull().default("medium"),
  priority: integer("priority").notNull().default(50),
  estimatedDays: integer("estimated_days").notNull().default(14),
  assignee: text("assignee"),
  team: text("team"),
  status: text("status").notNull().default("not_started"),
  dependsOn: text("depends_on").array().notNull().default([]),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRemediationTaskSchema = createInsertSchema(remediationTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRemediationTask = z.infer<typeof insertRemediationTaskSchema>;
export type RemediationTask = typeof remediationTasksTable.$inferSelect;

export const executiveBriefingsTable = pgTable("executive_briefings", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  postureDelta: text("posture_delta").notNull(),
  situationSummary: text("situation_summary").notNull(),
  financialExposureLow: real("financial_exposure_low").notNull().default(0),
  financialExposureHigh: real("financial_exposure_high").notNull().default(0),
  topThreatsJson: text("top_threats_json").notNull().default("[]"),
  recommendedActionsJson: text("recommended_actions_json").notNull().default("[]"),
  frameworksAtRiskJson: text("frameworks_at_risk_json").notNull().default("[]"),
  confidenceScore: real("confidence_score").notNull().default(0.85),
  dataFreshnessScore: real("data_freshness_score").notNull().default(0.9),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExecutiveBriefingSchema = createInsertSchema(executiveBriefingsTable).omit({ id: true, createdAt: true });
export type InsertExecutiveBriefing = z.infer<typeof insertExecutiveBriefingSchema>;
export type ExecutiveBriefing = typeof executiveBriefingsTable.$inferSelect;
