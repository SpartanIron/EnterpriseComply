import { pgTable, text, serial, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgIntegrationsTable = pgTable("org_integrations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  integrationKey: text("integration_key").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("disconnected"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  installationId: text("installation_id"),
  accountLogin: text("account_login"),
  accountName: text("account_name"),
  accountAvatarUrl: text("account_avatar_url"),
  scopes: text("scopes").array().notNull().default([]),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  evidenceCollected: integer("evidence_collected").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgIntegrationSchema = createInsertSchema(orgIntegrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgIntegration = z.infer<typeof insertOrgIntegrationSchema>;
export type OrgIntegration = typeof orgIntegrationsTable.$inferSelect;
