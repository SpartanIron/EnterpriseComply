import { pgTable, text, serial, timestamp, real, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgPoamItemsTable = pgTable("org_poam_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  frameworkKey: text("framework_key").notNull(),
  ucoControlId: text("uco_control_id"),
  frameworkControlId: text("framework_control_id"),
  title: text("title").notNull(),
  weakness: text("weakness").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("high"),
  status: text("status").notNull().default("open"),
  ownerName: text("owner_name").notNull(),
  ownerTeam: text("owner_team").notNull(),
  scheduledCompletionDate: timestamp("scheduled_completion_date", { withTimezone: true }),
  milestones: text("milestones").array().notNull().default([]),
  originalRisk: text("original_risk").notNull().default("high"),
  residualRisk: text("residual_risk").notNull().default("medium"),
  resources: text("resources"),
  estimatedCost: real("estimated_cost"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const insertOrgPoamItemSchema = createInsertSchema(orgPoamItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgPoamItem = z.infer<typeof insertOrgPoamItemSchema>;
export type OrgPoamItem = typeof orgPoamItemsTable.$inferSelect;
