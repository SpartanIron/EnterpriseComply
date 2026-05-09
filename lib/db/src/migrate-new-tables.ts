(async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
CREATE TABLE IF NOT EXISTS org_risks (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL DEFAULT 'operational', asset TEXT, threat TEXT, likelihood INTEGER NOT NULL DEFAULT 3, impact INTEGER NOT NULL DEFAULT 3, inherent_score REAL NOT NULL DEFAULT 9, treatment TEXT NOT NULL DEFAULT 'mitigate', treatment_plan TEXT, residual_likelihood INTEGER NOT NULL DEFAULT 2, residual_impact INTEGER NOT NULL DEFAULT 2, residual_score REAL NOT NULL DEFAULT 4, status TEXT NOT NULL DEFAULT 'open', owner_name TEXT, owner_email TEXT, due_date TIMESTAMPTZ, review_date TIMESTAMPTZ, related_control_id TEXT, related_framework_key TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_audit_engagements (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, framework_key TEXT NOT NULL, auditor_firm TEXT, auditor_name TEXT, auditor_email TEXT NOT NULL, access_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, notes TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_audit_evidence_requests (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, engagement_id INTEGER NOT NULL, uco_control_id TEXT, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending', due_date TIMESTAMPTZ, resolved_at TIMESTAMPTZ, auditor_comment TEXT, response_notes TEXT, linked_evidence_ids INTEGER[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_audit_log (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, actor_id TEXT, actor_email TEXT, action TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT, details JSONB, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_questionnaires (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, title TEXT NOT NULL, requester_name TEXT, requester_company TEXT, requester_email TEXT, type TEXT NOT NULL DEFAULT 'custom', status TEXT NOT NULL DEFAULT 'in_progress', total_items INTEGER NOT NULL DEFAULT 0, answered_items INTEGER NOT NULL DEFAULT 0, due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_questionnaire_items (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, questionnaire_id INTEGER NOT NULL, question TEXT NOT NULL, category TEXT, answer TEXT, confidence REAL, matched_control_id TEXT, matched_evidence_id INTEGER, status TEXT NOT NULL DEFAULT 'unanswered', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_vendor_assessments (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, vendor_id INTEGER NOT NULL, template_type TEXT NOT NULL DEFAULT 'sig-lite', status TEXT NOT NULL DEFAULT 'sent', sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), responded_at TIMESTAMPTZ, due_date TIMESTAMPTZ, score REAL, total_items INTEGER NOT NULL DEFAULT 0, answered_items INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_access_reviews (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'in_progress', total_people INTEGER NOT NULL DEFAULT 0, approved_count INTEGER NOT NULL DEFAULT 0, revoked_count INTEGER NOT NULL DEFAULT 0, pending_count INTEGER NOT NULL DEFAULT 0, due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_access_review_items (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, review_id INTEGER NOT NULL, person_id INTEGER NOT NULL, person_email TEXT NOT NULL, person_name TEXT, person_title TEXT, person_department TEXT, systems TEXT[] NOT NULL DEFAULT '{}', decision TEXT, reviewer_name TEXT, reviewer_email TEXT, notes TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_notifications (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, message TEXT NOT NULL, resource TEXT, resource_id TEXT, read BOOLEAN NOT NULL DEFAULT FALSE, read_at TIMESTAMPTZ, metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_monitoring_jobs (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, integration_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', last_run_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ, interval_hours INTEGER NOT NULL DEFAULT 24, last_result TEXT, drift_detected BOOLEAN NOT NULL DEFAULT FALSE, drift_details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_notification_settings (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, slack_webhook_url TEXT, email_enabled BOOLEAN NOT NULL DEFAULT TRUE, slack_enabled BOOLEAN NOT NULL DEFAULT FALSE, notify_on_drift BOOLEAN NOT NULL DEFAULT TRUE, notify_on_evidence_expiry BOOLEAN NOT NULL DEFAULT TRUE, notify_on_poam_overdue BOOLEAN NOT NULL DEFAULT TRUE, notify_on_new_findings BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_custom_frameworks (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, description TEXT, category TEXT NOT NULL DEFAULT 'custom', active BOOLEAN NOT NULL DEFAULT TRUE, compliance_score REAL NOT NULL DEFAULT 0, total_controls INTEGER NOT NULL DEFAULT 0, passing_controls INTEGER NOT NULL DEFAULT 0, failing_controls INTEGER NOT NULL DEFAULT 0, not_tested_controls INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS org_custom_controls (id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL, framework_id INTEGER NOT NULL, control_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, domain TEXT NOT NULL DEFAULT 'General', guidance TEXT, status TEXT NOT NULL DEFAULT 'not_tested', owner_name TEXT, notes TEXT, mapped_uco_control_id TEXT, last_tested_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  
    CREATE TABLE IF NOT EXISTS org_assessments (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_company TEXT,
      client_industry TEXT,
      client_size TEXT,
      framework_target TEXT NOT NULL,
      delivery_model TEXT NOT NULL DEFAULT 'guided',
      status TEXT NOT NULL DEFAULT 'in_progress',
      questionnaire_id INTEGER,
      report_url TEXT,
      report_generated_at TIMESTAMPTZ,
      domain_scores JSONB,
      overall_score REAL,
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
`);
  const r = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("Tables in DB:", r.rows.map((x: any) => x.table_name).join(", "));

  -- Item 4: Remediation Tasks table
  CREATE TABLE IF NOT EXISTS org_remediation_tasks (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    uco_control_id TEXT NOT NULL,
    control_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    assignee_name TEXT,
    assignee_email TEXT,
    effort_days INTEGER,
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    frameworks_benefited TEXT[],
    action_steps TEXT[],
    quick_win BOOLEAN NOT NULL DEFAULT FALSE,
    blocker_reason TEXT,
    notes TEXT,
    re_test_requested BOOLEAN NOT NULL DEFAULT FALSE,
    re_test_at TIMESTAMPTZ,
    re_test_result TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Item 5: Audit Shares table
  CREATE TABLE IF NOT EXISTS org_audit_shares (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    auditor_name TEXT,
    auditor_email TEXT,
    auditor_firm TEXT,
    framework_keys TEXT[],
    include_evidence BOOLEAN NOT NULL DEFAULT TRUE,
    include_test_results BOOLEAN NOT NULL DEFAULT TRUE,
    include_policies BOOLEAN NOT NULL DEFAULT TRUE,
    include_poam BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    access_count INTEGER NOT NULL DEFAULT 0,
    max_accesses INTEGER,
    last_accessed_at TIMESTAMPTZ,
    last_accessed_ip TEXT,
    created_by TEXT NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

