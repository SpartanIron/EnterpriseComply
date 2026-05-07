import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgAccessReviewsTable = pgTable("org_access_reviews", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("in_progress"),
  totalPeople: integer("total_people").notNull().default(0),
  approvedCount: integer("approved_count").notNull().default(0),
  revokedCount: integer("revoked_count").notNull().default(0),
  pendingCount: integer("pending_count").notNull().default(0),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const orgAccessReviewItemsTable = pgTable("org_access_review_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  reviewId: integer("review_id").notNull(),
  personId: integer("person_id").notNull(),
  personEmail: text("person_email").notNull(),
  personName: text("person_name"),
  personTitle: text("person_title"),
  personDepartment: text("person_department"),
  systems: text("systems").array().notNull().default([]),
  decision: text("decision"),
  reviewerName: text("reviewer_name"),
  reviewerEmail: text("reviewer_email"),
  notes: text("notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrgAccessReviewSchema = createInsertSchema(orgAccessReviewsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgAccessReview = z.infer<typeof insertOrgAccessReviewSchema>;
export type OrgAccessReview = typeof orgAccessReviewsTable.$inferSelect;

export const insertOrgAccessReviewItemSchema = createInsertSchema(orgAccessReviewItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrgAccessReviewItem = z.infer<typeof insertOrgAccessReviewItemSchema>;
export type OrgAccessReviewItem = typeof orgAccessReviewItemsTable.$inferSelect;
