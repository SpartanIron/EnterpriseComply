import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const statusSubscribersTable = pgTable("status_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  orgId: integer("org_id"),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmToken: text("confirm_token"),
  unsubToken: text("unsub_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
