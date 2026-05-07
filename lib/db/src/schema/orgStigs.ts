import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const orgStigChecklistsTable = pgTable("org_stig_checklists", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  benchmarkId: text("benchmark_id"),
  version: text("version"),
  release: text("release"),
  hostname: text("hostname"),
  targetComment: text("target_comment"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgStigFindingsTable = pgTable("org_stig_findings", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  checklistId: integer("checklist_id").notNull(),
  vulnId: text("vuln_id").notNull(),
  ruleId: text("rule_id"),
  ruleVer: text("rule_ver"),
  title: text("title").notNull(),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("not_reviewed"),
  description: text("description"),
  fixText: text("fix_text"),
  checkContent: text("check_content"),
  findingDetails: text("finding_details"),
  comments: text("comments"),
  ucoControlId: text("uco_control_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgStigChecklist = typeof orgStigChecklistsTable.$inferSelect;
export type OrgStigFinding = typeof orgStigFindingsTable.$inferSelect;
