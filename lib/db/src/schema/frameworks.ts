import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const frameworksTable = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  frameworkKey: text("framework_key").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  version: text("version").notNull(),
  type: text("type").notNull(),
  active: boolean("active").notNull().default(true),
  controlCount: integer("control_count").notNull().default(0),
  complianceScore: real("compliance_score").notNull().default(0),
  status: text("status").notNull().default("not_assessed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFrameworkSchema = createInsertSchema(frameworksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;
export type Framework = typeof frameworksTable.$inferSelect;
