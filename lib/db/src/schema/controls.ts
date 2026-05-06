import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const controlsTable = pgTable("controls", {
  id: serial("id").primaryKey(),
  controlId: text("control_id").notNull().unique(),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("unknown"),
  severity: text("severity").notNull(),
  effectiveness: real("effectiveness").notNull().default(0),
  frameworks: text("frameworks").array().notNull().default([]),
  telemetrySources: text("telemetry_sources").array().notNull().default([]),
  lastValidated: timestamp("last_validated", { withTimezone: true }).notNull().defaultNow(),
  automationCapability: text("automation_capability").notNull().default("manual"),
  maturityLevel: integer("maturity_level").notNull().default(1),
  driftDetected: boolean("drift_detected").notNull().default(false),
  evidenceFresh: boolean("evidence_fresh").notNull().default(true),
  remediationGuidance: text("remediation_guidance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertControlSchema = createInsertSchema(controlsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertControl = z.infer<typeof insertControlSchema>;
export type Control = typeof controlsTable.$inferSelect;
