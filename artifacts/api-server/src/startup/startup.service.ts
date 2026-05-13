import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { db, ucoControlsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { seedColorComply } from "@workspace/db/seed";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS uco_controls (
  id SERIAL PRIMARY KEY,
  control_id TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  objective TEXT NOT NULL,
  testable BOOLEAN NOT NULL DEFAULT TRUE,
  automation_level TEXT NOT NULL DEFAULT 'partial',
  remediation_guidance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uco_framework_mappings (
  id SERIAL PRIMARY KEY,
  uco_control_id TEXT NOT NULL,
  framework_key TEXT NOT NULL,
  framework_control_id TEXT NOT NULL,
  framework_control_name TEXT NOT NULL,
  customer_responsibility TEXT NOT NULL DEFAULT 'full',
  inherited BOOLEAN NOT NULL DEFAULT FALSE,
  inherited_from TEXT,
  mapping_confidence REAL NOT NULL DEFAULT 1.0,
  mapping_rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uco_automated_tests (
  id SERIAL PRIMARY KEY,
  uco_control_id TEXT NOT NULL,
  test_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  required_integration TEXT NOT NULL,
  test_logic TEXT NOT NULL,
  pass_criteria TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  clerk_org_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT 'technology',
  size TEXT NOT NULL DEFAULT '11-50',
  website TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  clerk_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_frameworks (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  framework_key TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'commercial',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_score REAL NOT NULL DEFAULT 0,
  total_controls INTEGER NOT NULL DEFAULT 0,
  passing_controls INTEGER NOT NULL DEFAULT 0,
  failing_controls INTEGER NOT NULL DEFAULT 0,
  not_tested_controls INTEGER NOT NULL DEFAULT 0,
  target_date TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_control_results (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  uco_control_id TEXT NOT NULL,
  test_key TEXT,
  status TEXT NOT NULL DEFAULT 'not_tested',
  result TEXT,
  evidence TEXT,
  evidence_url TEXT,
  integration_key TEXT,
  failure_reason TEXT,
  remediation_notes TEXT,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  manual_override_by TEXT,
  owner_name TEXT,
  owner_user_id TEXT,
  due_date TIMESTAMPTZ,
  last_tested_at TIMESTAMPTZ,
  next_test_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_evidence (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  uco_control_id TEXT,
  integration_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'document',
  source TEXT NOT NULL DEFAULT 'manual',
  url TEXT,
  filename TEXT,
  mime_type TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  uploaded_by TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_integrations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  integration_key TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  installation_id TEXT,
  account_login TEXT,
  account_name TEXT,
  account_avatar_url TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  evidence_collected INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_people (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  external_id TEXT,
  integration_key TEXT,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  department TEXT,
  employment_type TEXT NOT NULL DEFAULT 'employee',
  start_date TIMESTAMPTZ,
  mfa_enabled BOOLEAN,
  mfa_enrolled_at TIMESTAMPTZ,
  background_check_status TEXT NOT NULL DEFAULT 'not_started',
  background_check_date TIMESTAMPTZ,
  training_status TEXT NOT NULL DEFAULT 'not_started',
  training_completed_at TIMESTAMPTZ,
  access_review_status TEXT NOT NULL DEFAULT 'pending',
  last_access_review_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_policies (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  template_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL DEFAULT '1.0',
  content TEXT,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT TRUE,
  review_cycle_days INTEGER NOT NULL DEFAULT 365,
  last_reviewed_at TIMESTAMPTZ,
  next_review_due TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_policy_acknowledgments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  policy_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE TABLE IF NOT EXISTS org_vendors (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  category TEXT NOT NULL DEFAULT 'saas',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  risk_score REAL NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  data_access TEXT[] NOT NULL DEFAULT '{}',
  has_data_processing_agreement BOOLEAN NOT NULL DEFAULT FALSE,
  last_assessed_at TIMESTAMPTZ,
  next_assessment_due TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_vendor_assessments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'sig-lite',
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  score REAL,
  total_items INTEGER NOT NULL DEFAULT 0,
  answered_items INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_risks (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'operational',
  asset TEXT,
  threat TEXT,
  likelihood INTEGER NOT NULL DEFAULT 3,
  impact INTEGER NOT NULL DEFAULT 3,
  inherent_score REAL NOT NULL DEFAULT 9,
  treatment TEXT NOT NULL DEFAULT 'mitigate',
  treatment_plan TEXT,
  residual_likelihood INTEGER NOT NULL DEFAULT 2,
  residual_impact INTEGER NOT NULL DEFAULT 2,
  residual_score REAL NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'open',
  owner_name TEXT,
  owner_email TEXT,
  due_date TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  related_control_id TEXT,
  related_framework_key TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_poam_items (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  framework_key TEXT NOT NULL,
  uco_control_id TEXT,
  framework_control_id TEXT,
  title TEXT NOT NULL,
  weakness TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high',
  status TEXT NOT NULL DEFAULT 'open',
  owner_name TEXT NOT NULL,
  owner_team TEXT NOT NULL,
  scheduled_completion_date TIMESTAMPTZ,
  milestones TEXT[] NOT NULL DEFAULT '{}',
  original_risk TEXT NOT NULL DEFAULT 'high',
  residual_risk TEXT NOT NULL DEFAULT 'medium',
  resources TEXT,
  estimated_cost REAL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_audit_engagements (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  framework_key TEXT NOT NULL,
  auditor_firm TEXT,
  auditor_name TEXT,
  auditor_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_audit_evidence_requests (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  engagement_id INTEGER NOT NULL,
  uco_control_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  auditor_comment TEXT,
  response_notes TEXT,
  linked_evidence_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_audit_log (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_questionnaires (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  requester_name TEXT,
  requester_company TEXT,
  requester_email TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'in_progress',
  total_items INTEGER NOT NULL DEFAULT 0,
  answered_items INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_questionnaire_items (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  questionnaire_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  category TEXT,
  answer TEXT,
  confidence REAL,
  matched_control_id TEXT,
  matched_evidence_id INTEGER,
  status TEXT NOT NULL DEFAULT 'unanswered',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_access_reviews (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  total_people INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  revoked_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_access_review_items (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  review_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  person_email TEXT NOT NULL,
  person_name TEXT,
  person_title TEXT,
  person_department TEXT,
  systems TEXT[] NOT NULL DEFAULT '{}',
  decision TEXT,
  reviewer_name TEXT,
  reviewer_email TEXT,
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_monitoring_jobs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  integration_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  interval_hours INTEGER NOT NULL DEFAULT 24,
  last_result TEXT,
  drift_detected BOOLEAN NOT NULL DEFAULT FALSE,
  drift_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_notifications (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_notification_settings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  slack_webhook_url TEXT,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notify_on_drift BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_evidence_expiry BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_poam_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_new_findings BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_custom_frameworks (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_score REAL NOT NULL DEFAULT 0,
  total_controls INTEGER NOT NULL DEFAULT 0,
  passing_controls INTEGER NOT NULL DEFAULT 0,
  failing_controls INTEGER NOT NULL DEFAULT 0,
  not_tested_controls INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_custom_controls (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  framework_id INTEGER NOT NULL,
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL DEFAULT 'General',
  guidance TEXT,
  status TEXT NOT NULL DEFAULT 'not_tested',
  owner_name TEXT,
  notes TEXT,
  mapped_uco_control_id TEXT,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_score_history (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  overall_score REAL NOT NULL,
  framework_key TEXT,
  framework_score REAL,
  passing_controls INTEGER NOT NULL DEFAULT 0,
  failing_controls INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_runs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  test_id INTEGER,
  test_name TEXT NOT NULL,
  control_id TEXT,
  status TEXT NOT NULL DEFAULT 'pass',
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  details TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS integration_sync_log (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  integration_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  controls_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  next_sync_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS org_stig_checklists (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  benchmark_id TEXT,
  version TEXT,
  release TEXT,
  hostname TEXT,
  target_comment TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_stig_findings (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  checklist_id INTEGER NOT NULL,
  vuln_id TEXT NOT NULL,
  rule_id TEXT,
  rule_ver TEXT,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'not_reviewed',
  description TEXT,
  fix_text TEXT,
  check_content TEXT,
  finding_details TEXT,
  comments TEXT,
  uco_control_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_assessments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_company TEXT,
  client_industry TEXT,
  client_size TEXT,
  framework_target TEXT NOT NULL DEFAULT 'zero-trust',
  delivery_model TEXT NOT NULL DEFAULT 'guided',
  status TEXT NOT NULL DEFAULT 'in_progress',
  questionnaire_id INTEGER,
  report_url TEXT,
  report_generated_at TIMESTAMPTZ,
  domain_scores JSONB,
  overall_score INTEGER,
  rag_status TEXT,
  executive_summary TEXT,
  consultant_name TEXT,
  consultant_email TEXT,
  notes TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE org_assessments ADD COLUMN IF NOT EXISTS consultant_email TEXT;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'technology';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT '11-50';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';


-- ── Feature Flags Table ──────────────────────────────────────────────────
-- Enables/disables integrations and features without code deploys.
-- Used by the integration catalog admin UI.
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, flag_key)
);
CREATE INDEX IF NOT EXISTS ff_org_flag_idx ON feature_flags(org_id, flag_key);

-- ── Integration Catalog Table ─────────────────────────────────────────────
-- DB-driven integration catalog — eliminates hardcoded TypeScript arrays.
-- Enables admin UI toggling without redeploys.
CREATE TABLE IF NOT EXISTS integration_catalog (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  available_globally BOOLEAN NOT NULL DEFAULT true,
  demo_mode BOOLEAN NOT NULL DEFAULT false,
  requires_oauth BOOLEAN NOT NULL DEFAULT false,
  oauth_client_id TEXT,
  evidence_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Answer Confidence Scores ──────────────────────────────────────────────
-- Tracks confidence and review status for AI-generated questionnaire answers.
-- Enables the "Needs Review" workflow for auto-filled answers.
ALTER TABLE questionnaire_items ADD COLUMN IF NOT EXISTS answer_confidence NUMERIC(4,2);
ALTER TABLE questionnaire_items ADD COLUMN IF NOT EXISTS answer_source TEXT DEFAULT 'manual';
ALTER TABLE questionnaire_items ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
ALTER TABLE questionnaire_items ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
ALTER TABLE questionnaire_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ── Assessment Answer Confidence ──────────────────────────────────────────
ALTER TABLE assessment_responses ADD COLUMN IF NOT EXISTS answer_confidence NUMERIC(4,2);
ALTER TABLE assessment_responses ADD COLUMN IF NOT EXISTS answer_source TEXT DEFAULT 'manual';
ALTER TABLE assessment_responses ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- ── Row Level Security (Tenant Isolation) ────────────────────────────────
-- Ensures application-level bugs cannot leak cross-tenant data.
-- Postgres RLS provides a hard security boundary even if WHERE clauses are wrong.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow access only when current_setting matches org_id
-- These policies are enforced at the DB level; app sets the setting per request.
DO $$ BEGIN
  -- org_assessments RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_assessments' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON org_assessments
      USING (org_id::text = current_setting('app.current_org_id', true));
  END IF;
  -- org_questionnaires RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_questionnaires' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON org_questionnaires
      USING (org_id::text = current_setting('app.current_org_id', true));
  END IF;
  -- org_integrations RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_integrations' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON org_integrations
      USING (org_id::text = current_setting('app.current_org_id', true));
  END IF;
  -- feature_flags RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feature_flags' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON feature_flags
      USING (org_id IS NULL OR org_id::text = current_setting('app.current_org_id', true));
  END IF;
END $$;`;

@Injectable()
export class StartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupService.name);

  async onApplicationBootstrap() {
    await this.runMigrations();
    await this.seedIfEmpty();
  }

  private async runMigrations() {
    try {
      await db.execute(sql.raw(MIGRATION_SQL));
      this.logger.log("Database migrations complete");
    } catch (err) {
      this.logger.error("Migration failed - continuing startup", err);
    }
  }

  private async seedIfEmpty() {
    try {
      const rows = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(ucoControlsTable);
      const count = parseInt(rows[0]?.count ?? "0", 10);
      if (count === 0) {
        this.logger.log("UCO controls table is empty - running seed...");
        await seedColorComply();
        this.logger.log("UCO seed complete");
      } else {
        this.logger.log(`UCO controls already present (${count} controls)`);
      }
    } catch (err) {
      this.logger.error("Seed check failed - continuing startup", err);
    }
  }
}
