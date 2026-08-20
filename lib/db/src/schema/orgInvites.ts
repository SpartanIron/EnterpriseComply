import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// EC org_invites — pending team invitations for the tenant org model.
//
// Deliberately separate from better-auth's `invitation` table. That one is keyed
// on organization.id (TEXT) from the auth plugin, while every tenant table in
// this product — org_members included — is keyed on organizations.id (integer).
// Mixing the two silently crosses tenants, so invites live here instead.
//
// Only a SHA-256 hash of the invite token is stored. The plaintext token exists
// exactly once, in the invite email, so a database disclosure does not hand an
// attacker a set of working invite links.
//
// Controls: NIST AC-2 (account management), NIST IA-5 (authenticator mgmt),
// SOC 2 CC6.1 / CC6.2 (logical access provisioning).
export const orgInvitesTable = pgTable("org_invites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("analyst"),
  tokenHash: text("token_hash").notNull().unique(),
  /** pending | accepted | revoked | expired */
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** clerk_user_id of the member who sent the invite */
  invitedBy: text("invited_by").notNull(),
  invitedByEmail: text("invited_by_email"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
  resendCount: integer("resend_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrgInviteSchema = createInsertSchema(orgInvitesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOrgInvite = z.infer<typeof insertOrgInviteSchema>;
export type OrgInvite = typeof orgInvitesTable.$inferSelect;
