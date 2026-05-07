import { pool } from "./index";

async function migrateFresh() {
  const client = await pool.connect();
  console.log("Dropping old tables...");
  await client.query(`
    DROP TABLE IF EXISTS executive_briefings CASCADE;
    DROP TABLE IF EXISTS remediation_tasks CASCADE;
    DROP TABLE IF EXISTS compliance_journeys CASCADE;
    DROP TABLE IF EXISTS poam_items CASCADE;
    DROP TABLE IF EXISTS control_framework_mappings CASCADE;
    DROP TABLE IF EXISTS graph_edges CASCADE;
    DROP TABLE IF EXISTS graph_nodes CASCADE;
    DROP TABLE IF EXISTS evidence CASCADE;
    DROP TABLE IF EXISTS telemetry_events CASCADE;
    DROP TABLE IF EXISTS telemetry_sources CASCADE;
    DROP TABLE IF EXISTS findings CASCADE;
    DROP TABLE IF EXISTS risks CASCADE;
    DROP TABLE IF EXISTS attack_paths CASCADE;
    DROP TABLE IF EXISTS assets CASCADE;
    DROP TABLE IF EXISTS frameworks CASCADE;
    DROP TABLE IF EXISTS controls CASCADE;
  `);
  console.log("Old tables dropped. Now creating new tables...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      clerk_org_id TEXT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      industry TEXT NOT NULL DEFAULT 'technology',
      size TEXT NOT NULL DEFAULT '11-50',
      website TEXT,
      onboarding_complete BOOLEAN NOT NULL DEFAULT false,
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

    CREATE TABLE IF NOT EXISTS uco_controls (
      id SERIAL PRIMARY KEY,
      control_id TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      objective TEXT NOT NULL,
      testable BOOLEAN NOT NULL DEFAULT true,
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
      inherited BOOLEAN NOT NULL DEFAULT false,
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

    CREATE TABLE IF NOT EXISTS org_frameworks (
      id SERIAL PRIMARY KEY,
      org_id INTEGER NOT NULL,
      framework_key TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'commercial',
      active BOOLEAN NOT NULL DEFAULT true,
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
      manual_override BOOLEAN NOT NULL DEFAULT false,
      manual_override_by TEXT,
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
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      has_data_processing_agreement BOOLEAN NOT NULL DEFAULT false,
      last_assessed_at TIMESTAMPTZ,
      next_assessment_due TIMESTAMPTZ,
      notes TEXT,
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
      requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
  `);

  client.release();
  console.log("Migration complete!");
  await pool.end();
}

migrateFresh().catch(err => { console.error(err); process.exit(1); });
