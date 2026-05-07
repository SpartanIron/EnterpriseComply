import { pgTable, text, serial, timestamp, real, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ucoControlsTable = pgTable("uco_controls", {
  id: serial("id").primaryKey(),
  controlId: text("control_id").notNull().unique(),
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  objective: text("objective").notNull(),
  testable: boolean("testable").notNull().default(true),
  automationLevel: text("automation_level").notNull().default("partial"),
  remediationGuidance: text("remediation_guidance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUcoControlSchema = createInsertSchema(ucoControlsTable).omit({ id: true, createdAt: true });
export type InsertUcoControl = z.infer<typeof insertUcoControlSchema>;
export type UcoControl = typeof ucoControlsTable.$inferSelect;

export const ucoFrameworkMappingsTable = pgTable("uco_framework_mappings", {
  id: serial("id").primaryKey(),
  ucoControlId: text("uco_control_id").notNull(),
  frameworkKey: text("framework_key").notNull(),
  frameworkControlId: text("framework_control_id").notNull(),
  frameworkControlName: text("framework_control_name").notNull(),
  customerResponsibility: text("customer_responsibility").notNull().default("full"),
  inherited: boolean("inherited").notNull().default(false),
  inheritedFrom: text("inherited_from"),
  mappingConfidence: real("mapping_confidence").notNull().default(1.0),
  mappingRationale: text("mapping_rationale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUcoFrameworkMappingSchema = createInsertSchema(ucoFrameworkMappingsTable).omit({ id: true, createdAt: true });
export type InsertUcoFrameworkMapping = z.infer<typeof insertUcoFrameworkMappingSchema>;
export type UcoFrameworkMapping = typeof ucoFrameworkMappingsTable.$inferSelect;

export const ucoAutomatedTestsTable = pgTable("uco_automated_tests", {
  id: serial("id").primaryKey(),
  ucoControlId: text("uco_control_id").notNull(),
  testKey: text("test_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  requiredIntegration: text("required_integration").notNull(),
  testLogic: text("test_logic").notNull(),
  passCriteria: text("pass_criteria").notNull(),
  severity: text("severity").notNull().default("high"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUcoAutomatedTestSchema = createInsertSchema(ucoAutomatedTestsTable).omit({ id: true, createdAt: true });
export type InsertUcoAutomatedTest = z.infer<typeof insertUcoAutomatedTestSchema>;
export type UcoAutomatedTest = typeof ucoAutomatedTestsTable.$inferSelect;
