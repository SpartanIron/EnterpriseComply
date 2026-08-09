import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const systemHealthLogTable = pgTable("system_health_log", {
  id:          serial("id").primaryKey(),
  component:   text("component").notNull(),      // 'api' | 'database' | 'auth' | 'scheduler' | 'evidence_vault'
  status:      text("status").notNull().default("healthy"), // 'healthy' | 'degraded' | 'down'
  latencyMs:   integer("latency_ms"),
  error:       text("error"),
  checkedAt:   timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SystemHealthLog = typeof systemHealthLogTable.$inferSelect;

export const incidentsTable = pgTable("incidents", {
  id:          serial("id").primaryKey(),
  component:   text("component").notNull(),
  severity:    text("severity").notNull().default("minor"), // 'minor' | 'major' | 'critical'
  description: text("description").notNull(),
  startedAt:   timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:  timestamp("resolved_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Incident = typeof incidentsTable.$inferSelect;
