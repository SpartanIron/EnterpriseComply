import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  clerkOrgId: text("clerk_org_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry").notNull().default("technology"),
  size: text("size").notNull().default("11-50"),
  website: text("website"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  plan: text("plan").notNull().default("starter"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const orgMembersTable = pgTable("org_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrgMemberSchema = createInsertSchema(orgMembersTable).omit({ id: true, createdAt: true });
export type InsertOrgMember = z.infer<typeof insertOrgMemberSchema>;
export type OrgMember = typeof orgMembersTable.$inferSelect;
