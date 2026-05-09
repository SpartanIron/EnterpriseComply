import { pgTable, serial, integer, text, boolean, real, timestamp } from "drizzle-orm/pg-core";

// ── Remediation Tasks (Item 4: Remediation Task Engine) ─────────────────────
export const orgRemediationTasksTable = pgTable("org_remediation_tasks", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  // Linked control that this task remediates
  ucoControlId: text("uco_control_id").notNull(),
  controlName: text("control_name"),
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),       // critical | high | medium | low
  status: text("status").notNull().default("open"),             // open | in_progress | blocked | done | verified
  // Assignment
  assigneeName: text("assignee_name"),
  assigneeEmail: text("assignee_email"),
  // Effort and scheduling
  effortDays: integer("effort_days"),
  dueDate: timestamp("due_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  // Context
  frameworksBenefited: text("frameworks_benefited").array(),
  actionSteps: text("action_steps").array(),
  quickWin: boolean("quick_win").notNull().default(false),
  blockerReason: text("blocker_reason"),
  notes: text("notes"),
  // Re-test tracking
  reTestRequested: boolean("re_test_requested").notNull().default(false),
  reTestAt: timestamp("re_test_at"),
  reTestResult: text("re_test_result"),                         // passed | failed | pending
  // Source (manual | gap-analysis-auto)
  source: text("source").notNull().default("manual"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Audit Shares (Item 5: Auditor Collaboration Workspace) ─────────────────
export const orgAuditSharesTable = pgTable("org_audit_shares", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  // JWT-compatible token for the share link
  shareToken: text("share_token").notNull().unique(),
  // Auditor details
  auditorName: text("auditor_name"),
  auditorEmail: text("auditor_email"),
  auditorFirm: text("auditor_firm"),
  // Scope of what the auditor can see
  frameworkKeys: text("framework_keys").array(),               // which frameworks are in scope
  includeEvidence: boolean("include_evidence").notNull().default(true),
  includeTestResults: boolean("include_test_results").notNull().default(true),
  includePolicies: boolean("include_policies").notNull().default(true),
  includePoam: boolean("include_poam").notNull().default(false),  // sensitive — off by default
  // Access control
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  accessCount: integer("access_count").notNull().default(0),
  maxAccesses: integer("max_accesses"),                          // null = unlimited
  lastAccessedAt: timestamp("last_accessed_at"),
  lastAccessedIp: text("last_accessed_ip"),
  // Audit trail
  createdBy: text("created_by").notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: text("revoked_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
