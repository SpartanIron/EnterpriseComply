import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgNotificationsTable = pgTable("org_notifications", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  resource: text("resource"),
  resourceId: text("resource_id"),
  read: boolean("read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMonitoringJobsTable = pgTable("org_monitoring_jobs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  integrationKey: text("integration_key").notNull(),
  status: text("status").notNull().default("pending"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  intervalHours: integer("interval_hours").notNull().default(24),
  lastResult: text("last_result"),
  driftDetected: boolean("drift_detected").notNull().default(false),
  driftDetails: jsonb("drift_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgNotificationSettingsTable = pgTable("org_notification_settings", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  slackWebhookUrl: text("slack_webhook_url"),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  slackEnabled: boolean("slack_enabled").notNull().default(false),
  notifyOnDrift: boolean("notify_on_drift").notNull().default(true),
  notifyOnEvidenceExpiry: boolean("notify_on_evidence_expiry").notNull().default(true),
  notifyOnPoamOverdue: boolean("notify_on_poam_overdue").notNull().default(true),
  notifyOnNewFindings: boolean("notify_on_new_findings").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgNotificationSchema = createInsertSchema(orgNotificationsTable).omit({ id: true, createdAt: true });
export type InsertOrgNotification = z.infer<typeof insertOrgNotificationSchema>;
export type OrgNotification = typeof orgNotificationsTable.$inferSelect;

export const insertOrgMonitoringJobSchema = createInsertSchema(orgMonitoringJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgMonitoringJob = z.infer<typeof insertOrgMonitoringJobSchema>;
export type OrgMonitoringJob = typeof orgMonitoringJobsTable.$inferSelect;

export const insertOrgNotificationSettingsSchema = createInsertSchema(orgNotificationSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgNotificationSettings = z.infer<typeof insertOrgNotificationSettingsSchema>;
export type OrgNotificationSettings = typeof orgNotificationSettingsTable.$inferSelect;
