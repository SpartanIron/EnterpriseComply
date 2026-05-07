import { pgTable, text, serial, timestamp, boolean, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgFrameworksTable = pgTable("org_frameworks", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  frameworkKey: text("framework_key").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  category: text("category").notNull().default("commercial"),
  active: boolean("active").notNull().default(true),
  complianceScore: real("compliance_score").notNull().default(0),
  totalControls: integer("total_controls").notNull().default(0),
  passingControls: integer("passing_controls").notNull().default(0),
  failingControls: integer("failing_controls").notNull().default(0),
  notTestedControls: integer("not_tested_controls").notNull().default(0),
  targetDate: timestamp("target_date", { withTimezone: true }),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgFrameworkSchema = createInsertSchema(orgFrameworksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgFramework = z.infer<typeof insertOrgFrameworkSchema>;
export type OrgFramework = typeof orgFrameworksTable.$inferSelect;

export const orgControlResultsTable = pgTable("org_control_results", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  ucoControlId: text("uco_control_id").notNull(),
  testKey: text("test_key"),
  status: text("status").notNull().default("not_tested"),
  result: text("result"),
  evidence: text("evidence"),
  evidenceUrl: text("evidence_url"),
  integrationKey: text("integration_key"),
  failureReason: text("failure_reason"),
  remediationNotes: text("remediation_notes"),
  manualOverride: boolean("manual_override").notNull().default(false),
  manualOverrideBy: text("manual_override_by"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  nextTestAt: timestamp("next_test_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgControlResultSchema = createInsertSchema(orgControlResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgControlResult = z.infer<typeof insertOrgControlResultSchema>;
export type OrgControlResult = typeof orgControlResultsTable.$inferSelect;

export const orgEvidenceTable = pgTable("org_evidence", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  ucoControlId: text("uco_control_id"),
  integrationKey: text("integration_key"),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("document"),
  source: text("source").notNull().default("manual"),
  url: text("url"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  uploadedBy: text("uploaded_by"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrgEvidenceSchema = createInsertSchema(orgEvidenceTable).omit({ id: true, createdAt: true });
export type InsertOrgEvidence = z.infer<typeof insertOrgEvidenceSchema>;
export type OrgEvidence = typeof orgEvidenceTable.$inferSelect;
