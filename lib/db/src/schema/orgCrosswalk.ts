import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const controlCrosswalkTable = pgTable("control_crosswalk", {
  id: serial("id").primaryKey(),
  ucoControlId: text("uco_control_id").notNull().unique(),
  title: text("title").notNull(),
  domain: text("domain"),
  nist80053: text("nist_800_53"),
  cmmc: text("cmmc"),
  nist800171: text("nist_800_171"),
  soc2: text("soc2"),
  iso27001: text("iso_27001"),
  fedramp: text("fedramp"),
  hipaa: text("hipaa"),
  remediationSteps: text("remediation_steps"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
