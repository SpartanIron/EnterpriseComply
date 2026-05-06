import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const risksTable = pgTable("risks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  score: real("score").notNull().default(0),
  exploitability: real("exploitability").notNull().default(0),
  blastRadius: integer("blast_radius").notNull().default(1),
  attackVectors: text("attack_vectors").array().notNull().default([]),
  affectedAssets: text("affected_assets").array().notNull().default([]),
  threatIntelligence: text("threat_intelligence"),
  status: text("status").notNull().default("open"),
  identifiedAt: timestamp("identified_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiskSchema = createInsertSchema(risksTable).omit({ id: true, createdAt: true });
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risksTable.$inferSelect;

export const attackPathsTable = pgTable("attack_paths", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  severity: text("severity").notNull(),
  steps: text("steps").array().notNull().default([]),
  entryPoint: text("entry_point").notNull(),
  targetAsset: text("target_asset").notNull(),
  likelihood: real("likelihood").notNull().default(0),
  impact: real("impact").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttackPathSchema = createInsertSchema(attackPathsTable).omit({ id: true, createdAt: true });
export type InsertAttackPath = z.infer<typeof insertAttackPathSchema>;
export type AttackPath = typeof attackPathsTable.$inferSelect;
