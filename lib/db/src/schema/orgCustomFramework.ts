import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgCustomFrameworksTable = pgTable("org_custom_frameworks", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"),
  active: boolean("active").notNull().default(true),
  complianceScore: real("compliance_score").notNull().default(0),
  totalControls: integer("total_controls").notNull().default(0),
  passingControls: integer("passing_controls").notNull().default(0),
  failingControls: integer("failing_controls").notNull().default(0),
  notTestedControls: integer("not_tested_controls").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgCustomControlsTable = pgTable("org_custom_controls", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  frameworkId: integer("framework_id").notNull(),
  controlId: text("control_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  domain: text("domain").notNull().default("General"),
  guidance: text("guidance"),
  status: text("status").notNull().default("not_tested"),
  ownerName: text("owner_name"),
  notes: text("notes"),
  mappedUcoControlId: text("mapped_uco_control_id"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgCustomFrameworkSchema = createInsertSchema(orgCustomFrameworksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgCustomFramework = z.infer<typeof insertOrgCustomFrameworkSchema>;
export type OrgCustomFramework = typeof orgCustomFrameworksTable.$inferSelect;

export const insertOrgCustomControlSchema = createInsertSchema(orgCustomControlsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgCustomControl = z.infer<typeof insertOrgCustomControlSchema>;
export type OrgCustomControl = typeof orgCustomControlsTable.$inferSelect;
