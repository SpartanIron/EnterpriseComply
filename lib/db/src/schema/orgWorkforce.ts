import { pgTable, text, serial, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgPeopleTable = pgTable("org_people", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  externalId: text("external_id"),
  integrationKey: text("integration_key"),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  department: text("department"),
  employmentType: text("employment_type").notNull().default("employee"),
  startDate: timestamp("start_date", { withTimezone: true }),
  mfaEnabled: boolean("mfa_enabled"),
  mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
  backgroundCheckStatus: text("background_check_status").notNull().default("not_started"),
  backgroundCheckDate: timestamp("background_check_date", { withTimezone: true }),
  trainingStatus: text("training_status").notNull().default("not_started"),
  trainingCompletedAt: timestamp("training_completed_at", { withTimezone: true }),
  accessReviewStatus: text("access_review_status").notNull().default("pending"),
  lastAccessReviewAt: timestamp("last_access_review_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgPersonSchema = createInsertSchema(orgPeopleTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgPerson = z.infer<typeof insertOrgPersonSchema>;
export type OrgPerson = typeof orgPeopleTable.$inferSelect;

export const orgVendorsTable = pgTable("org_vendors", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  website: text("website"),
  category: text("category").notNull().default("saas"),
  riskLevel: text("risk_level").notNull().default("medium"),
  riskScore: real("risk_score").notNull().default(50),
  status: text("status").notNull().default("active"),
  dataAccess: text("data_access").array().notNull().default([]),
  hasDataProcessingAgreement: boolean("has_data_processing_agreement").notNull().default(false),
  lastAssessedAt: timestamp("last_assessed_at", { withTimezone: true }),
  nextAssessmentDue: timestamp("next_assessment_due", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgVendorSchema = createInsertSchema(orgVendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgVendor = z.infer<typeof insertOrgVendorSchema>;
export type OrgVendor = typeof orgVendorsTable.$inferSelect;

export const orgPoliciesTable = pgTable("org_policies", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  templateKey: text("template_key"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("draft"),
  version: text("version").notNull().default("1.0"),
  content: text("content"),
  // How this policy came to exist. "template" was generated from the platform
  // catalogue, "authored" was written in the app, "uploaded" is a document the
  // organisation already had. Nullable because rows predate the column; the
  // migration backfills them and the read path treats null the same way it
  // behaved before the column existed.
  sourceType: text("source_type"),
  // Points at the live row in org_policy_documents. Null for policies that are
  // Markdown in the content column rather than a file.
  currentDocumentId: integer("current_document_id"),
  requiresAcknowledgment: boolean("requires_acknowledgment").notNull().default(true),
  reviewCycleDays: integer("review_cycle_days").notNull().default(365),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  nextReviewDue: timestamp("next_review_due", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgPolicySchema = createInsertSchema(orgPoliciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgPolicy = z.infer<typeof insertOrgPolicySchema>;
export type OrgPolicy = typeof orgPoliciesTable.$inferSelect;

export const orgPolicyAcknowledgmentsTable = pgTable("org_policy_acknowledgments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  policyId: integer("policy_id").notNull(),
  personId: integer("person_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
});

export const insertOrgPolicyAckSchema = createInsertSchema(orgPolicyAcknowledgmentsTable).omit({ id: true });
export type InsertOrgPolicyAck = z.infer<typeof insertOrgPolicyAckSchema>;
export type OrgPolicyAck = typeof orgPolicyAcknowledgmentsTable.$inferSelect;

/**
 * A customer-uploaded policy file.
 *
 * org_policies holds what the platform knows about a policy - its category,
 * its review cycle, who has acknowledged it. This table holds the artefact an
 * auditor actually asks for, for organisations whose policies were written
 * long before they bought a GRC tool.
 *
 * Versions are rows, not overwrites. status "current" is the live one and
 * "superseded" is history, kept because an audit asks what the policy said on
 * the date of an incident, not what it says today. A partial unique index in
 * policy-documents.migration.ts enforces one current row per policy.
 *
 * contentBase64 is the bytes. sha256 is over the decoded bytes, not the base64,
 * so it can be compared against a hash taken anywhere else.
 */
export const orgPolicyDocumentsTable = pgTable("org_policy_documents", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  policyId: integer("policy_id"),
  version: integer("version").notNull().default(1),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  contentBase64: text("content_base64").notNull(),
  status: text("status").notNull().default("current"),
  uploadedBy: text("uploaded_by"),
  uploadedByEmail: text("uploaded_by_email"),
  note: text("note"),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrgPolicyDocumentSchema = createInsertSchema(orgPolicyDocumentsTable).omit({ id: true });
export type InsertOrgPolicyDocument = z.infer<typeof insertOrgPolicyDocumentSchema>;
export type OrgPolicyDocument = typeof orgPolicyDocumentsTable.$inferSelect;
