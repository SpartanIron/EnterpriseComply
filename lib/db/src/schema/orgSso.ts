import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const orgSsoConfigTable = pgTable("org_sso_config", {
  id:             serial("id").primaryKey(),
  orgId:          integer("org_id").notNull().unique(),
  provider:       text("provider").notNull().default("saml"), // okta | azure_ad | google | saml
  idpEntityId:    text("idp_entity_id").notNull(),
  idpSsoUrl:      text("idp_sso_url").notNull(),
  idpCertificate: text("idp_certificate").notNull(), // PEM
  domain:         text("domain"),                    // e.g. company.com
  enabled:        boolean("enabled").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgSsoConfig = typeof orgSsoConfigTable.$inferSelect;
