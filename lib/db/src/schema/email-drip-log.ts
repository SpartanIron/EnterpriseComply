import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

// EC email drip deduplication log — DB-backed to survive container restarts
// Unique constraint on (clerk_user_id, email_type) prevents duplicate drip sends
export const emailDripLogTable = pgTable(
  "email_drip_log",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    orgId: integer("org_id"),
    emailType: text("email_type").notNull(), // e.g. "welcome", "drip_day3", "trial_expiry_7d"
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    meta: text("meta"), // optional JSON blob for debugging
  },
  (t) => [unique().on(t.clerkUserId, t.emailType)]
);

export type EmailDripLog = typeof emailDripLogTable.$inferSelect;
