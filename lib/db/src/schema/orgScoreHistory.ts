import { pgTable, serial, integer, real, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const complianceScoreHistoryTable = pgTable("compliance_score_history", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  overallScore: real("overall_score").notNull(),
  frameworkKey: text("framework_key"),
  frameworkScore: real("framework_score"),
  passingControls: integer("passing_controls").notNull().default(0),
  failingControls: integer("failing_controls").notNull().default(0),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertComplianceScoreHistorySchema = createInsertSchema(complianceScoreHistoryTable).omit({ id: true });
export type InsertComplianceScoreHistory = z.infer<typeof insertComplianceScoreHistorySchema>;
export type ComplianceScoreHistory = typeof complianceScoreHistoryTable.$inferSelect;
