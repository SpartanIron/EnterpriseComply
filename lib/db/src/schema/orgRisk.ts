import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgRisksTable = pgTable("org_risks", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operational"),
  asset: text("asset"),
  threat: text("threat"),
  likelihood: integer("likelihood").notNull().default(3),
  impact: integer("impact").notNull().default(3),
  inherentScore: real("inherent_score").notNull().default(9),
  treatment: text("treatment").notNull().default("mitigate"),
  treatmentPlan: text("treatment_plan"),
  residualLikelihood: integer("residual_likelihood").notNull().default(2),
  residualImpact: integer("residual_impact").notNull().default(2),
  residualScore: real("residual_score").notNull().default(4),
  status: text("status").notNull().default("open"),
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  reviewDate: timestamp("review_date", { withTimezone: true }),
  relatedControlId: text("related_control_id"),
  relatedFrameworkKey: text("related_framework_key"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgRiskSchema = createInsertSchema(orgRisksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgRisk = z.infer<typeof insertOrgRiskSchema>;
export type OrgRisk = typeof orgRisksTable.$inferSelect;
