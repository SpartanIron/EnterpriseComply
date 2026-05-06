import { pgTable, text, serial, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telemetrySourcesTable = pgTable("telemetry_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("active"),
  eventsPerMinute: real("events_per_minute").notNull().default(0),
  lastEvent: timestamp("last_event", { withTimezone: true }).notNull().defaultNow(),
  latencyMs: real("latency_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTelemetrySourceSchema = createInsertSchema(telemetrySourcesTable).omit({ id: true, createdAt: true });
export type InsertTelemetrySource = z.infer<typeof insertTelemetrySourceSchema>;
export type TelemetrySource = typeof telemetrySourcesTable.$inferSelect;

export const telemetryEventsTable = pgTable("telemetry_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull(),
  asset: text("asset"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTelemetryEventSchema = createInsertSchema(telemetryEventsTable).omit({ id: true, createdAt: true });
export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEvent = typeof telemetryEventsTable.$inferSelect;
