import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testRunsTable = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  testId: integer("test_id"),
  testName: text("test_name").notNull(),
  controlId: text("control_id"),
  status: text("status").notNull().default("pass"),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  durationMs: integer("duration_ms"),
  details: text("details"),
  errorMessage: text("error_message"),
});

export const insertTestRunSchema = createInsertSchema(testRunsTable).omit({ id: true });
export type InsertTestRun = z.infer<typeof insertTestRunSchema>;
export type TestRun = typeof testRunsTable.$inferSelect;

export const integrationSyncLogTable = pgTable("integration_sync_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  integrationKey: text("integration_key").notNull(),
  status: text("status").notNull().default("success"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  evidenceCount: integer("evidence_count").notNull().default(0),
  controlsUpdated: integer("controls_updated").notNull().default(0),
  errorMessage: text("error_message"),
  nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
});

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogTable).omit({ id: true });
export type InsertIntegrationSyncLog = z.infer<typeof insertIntegrationSyncLogSchema>;
export type IntegrationSyncLog = typeof integrationSyncLogTable.$inferSelect;
