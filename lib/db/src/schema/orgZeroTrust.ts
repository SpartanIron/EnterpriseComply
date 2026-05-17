import { pgTable, text, serial, timestamp, integer, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Assessment — CISA ZTMM v2.0 pillar-level maturity assessments
// Separate from the generic assessment engagements table.
// One row = one continuous ZTA assessment for an org (can have multiple snapshots).
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaAssessmentsTable = pgTable("org_zta_assessments", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    name: text("name").notNull().default("Zero Trust Assessment"),
    // Overall maturity level: "traditional" | "initial" | "advanced" | "optimal"
    overallMaturityLevel: text("overall_maturity_level"),
    overallScore: real("overall_score"),
    ragStatus: text("rag_status"), // "red" | "amber" | "green"
    // Per-pillar scores as jsonb: { identity: 55, devices: 30, ... }
    pillarScores: jsonb("pillar_scores"),
    // Snapshot of dependency violations
    dependencyViolations: jsonb("dependency_violations"),
    // Agency-level weight overrides: { identity: 1.5, devices: 1.0, ... }
    pillarWeights: jsonb("pillar_weights"),
    // Rule set version for reproducibility
    ruleSetVersion: text("rule_set_version").notNull().default("ztmm-v2.0-2023"),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Pillar Scores — one row per pillar per assessment
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaPillarScoresTable = pgTable("org_zta_pillar_scores", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(), // FK → org_zta_assessments.id
    pillar: text("pillar").notNull(), // "identity" | "devices" | "networks" | "applications" | "data"
    // Raw calculated score before dependency caps (0–100)
    rawScore: real("raw_score").notNull().default(0),
    // Score after cross-pillar dependency caps applied
    cappedScore: real("capped_score").notNull().default(0),
    // Maturity stage: "traditional" | "initial" | "advanced" | "optimal"
    maturityStage: text("maturity_stage").notNull().default("traditional"),
    // Weight for this org/agency (default 1.0)
    weight: real("weight").notNull().default(1.0),
    // Count of automated vs self-attested evidence items
    automatedEvidenceCount: integer("automated_evidence_count").notNull().default(0),
    selfAttestedCount: integer("self_attested_count").notNull().default(0),
    // Per-function breakdown: { "user_authentication": 80, "device_compliance": 40, ... }
    functionScores: jsonb("function_scores"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Function Scores — one row per ZTMM function per pillar per assessment
// Functions are the sub-areas within each pillar (e.g. Identity > "Visibility & Analytics")
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaFunctionScoresTable = pgTable("org_zta_function_scores", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(),
    pillar: text("pillar").notNull(),
    functionKey: text("function_key").notNull(), // e.g. "identity_governance", "device_compliance"
    functionLabel: text("function_label").notNull(),
    // Current maturity stage for this function
    maturityStage: text("maturity_stage").notNull().default("traditional"),
    score: real("score").notNull().default(0),
    // NIST 800-53 Rev 5 control IDs mapped to this function
    nistControls: jsonb("nist_controls"), // string[]
    // UCO control IDs that provide evidence for this function
    ucoControls: jsonb("uco_controls"), // string[]
    // Evidence artifacts collected: [{ integration, artifactType, status, lastSeen }]
    evidenceArtifacts: jsonb("evidence_artifacts"),
    // Whether this function has been manually attested (no auto evidence)
    isAttested: boolean("is_attested").notNull().default(false),
    attestationNote: text("attestation_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Evidence Artifacts — tracks each evidence item tied to a ZTA function
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaEvidenceArtifactsTable = pgTable("org_zta_evidence_artifacts", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(),
    pillar: text("pillar").notNull(),
    functionKey: text("function_key").notNull(),
    // Integration that produced this artifact
    integrationName: text("integration_name").notNull(), // e.g. "Entra ID", "CrowdStrike Falcon"
    // Specific artifact type (not generic)
    artifactType: text("artifact_type").notNull(), // e.g. "mfa_enrollment_per_user_with_factor_classification"
    // pass | fail | partial | not_applicable
    status: text("status").notNull().default("fail"),
    // Automated (from integration) or self-attested
    evidenceSource: text("evidence_source").notNull().default("automated"), // "automated" | "attested"
    // Confidence score 0–1 (lower for attested)
    confidence: real("confidence").notNull().default(1.0),
    // Raw data blob from the integration
    rawData: jsonb("raw_data"),
    // UCO control ID this maps to
    ucoControlId: text("uco_control_id"),
    // NIST 800-53 controls satisfied
    nistControls: jsonb("nist_controls"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Gap Findings — generated when criteria are not met
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaGapFindingsTable = pgTable("org_zta_gap_findings", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(),
    pillar: text("pillar").notNull(),
    functionKey: text("function_key").notNull(),
    // Current vs target maturity stage
    currentStage: text("current_stage").notNull().default("traditional"),
    targetStage: text("target_stage").notNull().default("initial"),
    // Gap description
    gapTitle: text("gap_title").notNull(),
    gapDescription: text("gap_description"),
    // Severity: "critical" | "high" | "medium" | "low"
    severity: text("severity").notNull().default("high"),
    // NIST 800-53 Rev 5 controls not met
    failingNistControls: jsonb("failing_nist_controls"), // string[]
    // UCO control IDs not passing
    failingUcoControls: jsonb("failing_uco_controls"), // string[]
    // Whether this gap also causes a dependency violation
    causesDependencyViolation: boolean("causes_dependency_violation").notNull().default(false),
    // Status: "open" | "in_remediation" | "accepted_risk" | "resolved"
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Remediation Items — actionable steps to close gaps
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaRemediationItemsTable = pgTable("org_zta_remediation_items", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(),
    gapFindingId: integer("gap_finding_id"), // FK → org_zta_gap_findings.id
    pillar: text("pillar").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // Integrations recommended to address this gap
    recommendedIntegrations: jsonb("recommended_integrations"), // string[]
    // Effort: "low" | "medium" | "high"
    effort: text("effort").notNull().default("medium"),
    // Impact on score if resolved (estimated points gain)
    estimatedScoreImpact: real("estimated_score_impact").notNull().default(0),
    // Priority: 1 (highest) – 5 (lowest)
    priority: integer("priority").notNull().default(2),
    // Status: "open" | "in_progress" | "completed" | "deferred"
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    assignedTo: text("assigned_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────────────────
// ZTA Score History — point-in-time snapshots for trend analysis
// ─────────────────────────────────────────────────────────────────────────────
export const orgZtaScoreHistoryTable = pgTable("org_zta_score_history", {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull(),
    ztaAssessmentId: integer("zta_assessment_id").notNull(),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true }).notNull().defaultNow(),
    overallScore: real("overall_score").notNull(),
    pillarScores: jsonb("pillar_scores").notNull(), // { identity: 55, devices: 30, ... }
    maturityLevel: text("maturity_level").notNull().default("traditional"),
    // What triggered this snapshot: "manual" | "integration_sync" | "scheduled"
    triggerType: text("trigger_type").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Zod schemas and types ────────────────────────────────────────────────────
export const insertOrgZtaAssessmentSchema = createInsertSchema(orgZtaAssessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgZtaPillarScoreSchema = createInsertSchema(orgZtaPillarScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgZtaGapFindingSchema = createInsertSchema(orgZtaGapFindingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgZtaRemediationItemSchema = createInsertSchema(orgZtaRemediationItemsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type OrgZtaAssessment = typeof orgZtaAssessmentsTable.$inferSelect;
export type OrgZtaPillarScore = typeof orgZtaPillarScoresTable.$inferSelect;
export type OrgZtaFunctionScore = typeof orgZtaFunctionScoresTable.$inferSelect;
export type OrgZtaGapFinding = typeof orgZtaGapFindingsTable.$inferSelect;
export type OrgZtaRemediationItem = typeof orgZtaRemediationItemsTable.$inferSelect;
export type OrgZtaScoreHistory = typeof orgZtaScoreHistoryTable.$inferSelect;
