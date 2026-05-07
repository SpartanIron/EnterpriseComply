import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgAuditEngagementsTable = pgTable("org_audit_engagements", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  frameworkKey: text("framework_key").notNull(),
  auditorFirm: text("auditor_firm"),
  auditorName: text("auditor_name"),
  auditorEmail: text("auditor_email").notNull(),
  accessToken: text("access_token").notNull(),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgAuditEvidenceRequestsTable = pgTable("org_audit_evidence_requests", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  engagementId: integer("engagement_id").notNull(),
  ucoControlId: text("uco_control_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  auditorComment: text("auditor_comment"),
  responseNotes: text("response_notes"),
  linkedEvidenceIds: integer("linked_evidence_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgAuditLogTable = pgTable("org_audit_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrgAuditEngagementSchema = createInsertSchema(orgAuditEngagementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgAuditEngagement = z.infer<typeof insertOrgAuditEngagementSchema>;
export type OrgAuditEngagement = typeof orgAuditEngagementsTable.$inferSelect;

export const insertOrgAuditEvidenceRequestSchema = createInsertSchema(orgAuditEvidenceRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgAuditEvidenceRequest = z.infer<typeof insertOrgAuditEvidenceRequestSchema>;
export type OrgAuditEvidenceRequest = typeof orgAuditEvidenceRequestsTable.$inferSelect;

export const insertOrgAuditLogSchema = createInsertSchema(orgAuditLogTable).omit({ id: true, createdAt: true });
export type InsertOrgAuditLog = z.infer<typeof insertOrgAuditLogSchema>;
export type OrgAuditLog = typeof orgAuditLogTable.$inferSelect;
