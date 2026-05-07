import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgQuestionnairesTable = pgTable("org_questionnaires", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  title: text("title").notNull(),
  requesterName: text("requester_name"),
  requesterCompany: text("requester_company"),
  requesterEmail: text("requester_email"),
  type: text("type").notNull().default("custom"),
  status: text("status").notNull().default("in_progress"),
  totalItems: integer("total_items").notNull().default(0),
  answeredItems: integer("answered_items").notNull().default(0),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgQuestionnaireItemsTable = pgTable("org_questionnaire_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  questionnaireId: integer("questionnaire_id").notNull(),
  question: text("question").notNull(),
  category: text("category"),
  answer: text("answer"),
  confidence: real("confidence"),
  matchedControlId: text("matched_control_id"),
  matchedEvidenceId: integer("matched_evidence_id"),
  status: text("status").notNull().default("unanswered"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgVendorAssessmentsTable = pgTable("org_vendor_assessments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  templateType: text("template_type").notNull().default("sig-lite"),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  score: real("score"),
  totalItems: integer("total_items").notNull().default(0),
  answeredItems: integer("answered_items").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgQuestionnaireSchema = createInsertSchema(orgQuestionnairesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgQuestionnaire = z.infer<typeof insertOrgQuestionnaireSchema>;
export type OrgQuestionnaire = typeof orgQuestionnairesTable.$inferSelect;

export const insertOrgQuestionnaireItemSchema = createInsertSchema(orgQuestionnaireItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgQuestionnaireItem = z.infer<typeof insertOrgQuestionnaireItemSchema>;
export type OrgQuestionnaireItem = typeof orgQuestionnaireItemsTable.$inferSelect;

export const insertOrgVendorAssessmentSchema = createInsertSchema(orgVendorAssessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgVendorAssessment = z.infer<typeof insertOrgVendorAssessmentSchema>;
export type OrgVendorAssessment = typeof orgVendorAssessmentsTable.$inferSelect;
