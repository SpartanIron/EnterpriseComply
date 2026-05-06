import { pgTable, text, serial, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  riskLevel: text("risk_level").notNull().default("low"),
  riskScore: real("risk_score").notNull().default(0),
  exposureScore: real("exposure_score").notNull().default(0),
  crownJewel: boolean("crown_jewel").notNull().default(false),
  internetExposed: boolean("internet_exposed").notNull().default(false),
  owner: text("owner").notNull(),
  environment: text("environment").notNull().default("production"),
  vulnerabilityCount: integer("vulnerability_count").notNull().default(0),
  controlCoverage: real("control_coverage").notNull().default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
