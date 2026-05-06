import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const findingsTable = pgTable("findings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  source: text("source").notNull(),
  affectedAsset: text("affected_asset").notNull(),
  controlId: text("control_id"),
  cveId: text("cve_id"),
  remediationSla: integer("remediation_sla"),
  daysOpen: integer("days_open").notNull().default(0),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFindingSchema = createInsertSchema(findingsTable).omit({ id: true, createdAt: true });
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findingsTable.$inferSelect;
