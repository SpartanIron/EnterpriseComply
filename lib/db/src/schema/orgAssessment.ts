import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// org_assessments — client-facing Zero Trust / Compliance assessment engagements
// Each row represents a single assessment engagement for a client org.
// The consulting org (orgId) owns the engagement; client details are stored here.
// ─────────────────────────────────────────────────────────────────────────────
export const orgAssessmentsTable = pgTable("org_assessments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),                          // Consulting org (owner)
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientCompany: text("client_company"),
  clientIndustry: text("client_industry"),
  clientSize: text("client_size"),                             // e.g. "1-50", "51-200", "201-1000", "1000+"
  frameworkTarget: text("framework_target").notNull(),         // "zero-trust", "nist-800-171", "cmmc-l2", "soc2", "fedramp-moderate"
  deliveryModel: text("delivery_model").notNull().default("guided"), // "self-service" | "guided" | "managed"
  status: text("status").notNull().default("in_progress"),    // "in_progress" | "complete" | "draft" | "archived"
  questionnaireId: integer("questionnaire_id"),                // FK → org_questionnaires.id
  reportUrl: text("report_url"),                               // Cloudflare R2 signed URL or path
  reportGeneratedAt: timestamp("report_generated_at", { withTimezone: true }),
  domainScores: jsonb("domain_scores"),                        // { identity: 70, devices: 30, network: 60, ... }
  overallScore: real("overall_score"),
  ragStatus: text("rag_status"),                               // "red" | "amber" | "green"
  executiveSummary: text("executive_summary"),
  consultantName: text("consultant_name"),
  consultantEmail: text("consultant_email"),
  notes: text("notes"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgAssessmentSchema = createInsertSchema(orgAssessmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrgAssessment = z.infer<typeof insertOrgAssessmentSchema>;
export type OrgAssessment = typeof orgAssessmentsTable.$inferSelect;
