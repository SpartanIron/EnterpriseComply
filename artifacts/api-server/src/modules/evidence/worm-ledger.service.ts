import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { runWormLedgerMigration } from '../../migrations/worm-evidence-ledger.migration';
import { runTenantRlsMigration, runEvidenceRetentionMigration, runOrgSecuritySettingsMigration, readDbSecurityPosture, type DbSecurityPosture } from '../../migrations/tenant-rls.migration';

export interface LedgerVerificationResult {
  orgId: number;
  totalEntries: number;
  validEntries: number;
  tamperedEntries: number;
  chainIntact: boolean;
  tamperReport: Array<{
    sequenceNum: number;
    evidenceId: number;
    isValid: boolean;
    tamperedAt: string | null;
  }>;
  verifiedAt: string;
}

/**
 * WORM Evidence Ledger Service
 *
 * Manages the cryptographic hash chain and WORM policy for evidence records.
 * Provides chain integrity verification for auditors and automated monitoring.
 */
@Injectable()
export class WormLedgerService implements OnModuleInit {
  private readonly logger = new Logger(WormLedgerService.name);
  private lastPosture: DbSecurityPosture | null = null;

  async onModuleInit() {
    // Database integrity controls are installed on every boot and are
    // idempotent, so a restart can never silently leave the platform without
    // its WORM triggers or its tenant RLS policies.
    try {
      // Retention columns must exist before the WORM trigger starts rejecting
      // DELETEs, otherwise evidence removal has nowhere to go.
      await runEvidenceRetentionMigration(db);
      await runOrgSecuritySettingsMigration(db);
    } catch (err) {
      this.logger.error(
        'Evidence retention migration failed: ' + ((err as any)?.message ?? String(err)),
      );
    }
    try {
      await runWormLedgerMigration(db);
    } catch (err) {
      this.logger.error(
        'WORM ledger migration failed: ' + ((err as any)?.message ?? String(err)),
      );
    }
    try {
      const rls = await runTenantRlsMigration(db);
      this.logger.log(
        'Tenant RLS: ' + rls.policiesCreated + '/' + rls.discovered + ' policies installed' +
          (rls.errors.length ? ' (' + rls.errors.length + ' errors)' : ''),
      );
      if (rls.errors.length) this.logger.warn('Tenant RLS errors: ' + rls.errors.join('; '));
    } catch (err) {
      this.logger.error(
        'Tenant RLS migration failed: ' + ((err as any)?.message ?? String(err)),
      );
    }
    try {
      this.lastPosture = await readDbSecurityPosture(db);
      if (this.lastPosture.bypassesRls) {
        this.logger.warn(
          'DB role "' + this.lastPosture.role + '" bypasses RLS. Tenant isolation is ' +
            'currently enforced at the application layer only. Run ' +
            'scripts/provision-app-role.cjs and cut DATABASE_URL over to the ' +
            'least-privilege role to activate database-layer enforcement.',
        );
      }
    } catch { /* posture is advisory only */ }
  }

  /** Live database security posture (roles, RLS coverage, WORM triggers). */
  async getSecurityPosture(): Promise<DbSecurityPosture> {
    this.lastPosture = await readDbSecurityPosture(db);
    return this.lastPosture;
  }

  /** Confirms the WORM triggers survived the last restart. */
  async getWormStatus() {
    const rows = await db.execute(sql`
      SELECT trigger_name, event_object_table, event_manipulation
        FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND trigger_name IN ('evidence_worm_enforce', 'evidence_ledger_append', 'audit_log_worm')
    `);
    const names = new Set(
      (rows.rows as Array<{ trigger_name: string }>).map((r) => r.trigger_name),
    );
    const required = ['evidence_worm_enforce', 'audit_log_worm'];
    const missing = required.filter((n) => !names.has(n));
    return {
      installed: Array.from(names).sort(),
      required,
      missing,
      healthy: missing.length === 0,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify the full hash chain integrity for an organization's evidence ledger.
   * Detects any tampering, deletion, or reordering of evidence records.
   */
  async verifyChain(orgId: number): Promise<LedgerVerificationResult> {
    const rows = await db.execute(
      sql`SELECT * FROM verify_evidence_chain(${orgId})`
    );

    const entries = rows.rows as Array<{
      sequence_num: string;
      evidence_id: string;
      is_valid: boolean;
      expected_hash: string;
      stored_hash: string;
      tampered_at: string | null;
    }>;

    const totalEntries = entries.length;
    const validEntries = entries.filter(e => e.is_valid).length;
    const tamperedEntries = totalEntries - validEntries;
    const chainIntact = tamperedEntries === 0;

    return {
      orgId,
      totalEntries,
      validEntries,
      tamperedEntries,
      chainIntact,
      tamperReport: entries.map(e => ({
        sequenceNum: parseInt(e.sequence_num),
        evidenceId: parseInt(e.evidence_id),
        isValid: e.is_valid,
        tamperedAt: e.tampered_at,
      })),
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Get ledger statistics for an organization
   */
  async getLedgerStats(orgId: number) {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_entries,
        MIN(created_at) as first_entry,
        MAX(created_at) as last_entry,
        MAX(sequence_num) as last_sequence
      FROM evidence_ledger
      WHERE org_id = ${orgId}
    `);
    return result.rows[0];
  }

  /**
   * Get individual ledger entry for a specific evidence record
   */
  async getLedgerEntry(orgId: number, evidenceId: number) {
    const result = await db.execute(sql`
      SELECT *
      FROM evidence_ledger
      WHERE org_id = ${orgId} AND evidence_id = ${evidenceId}
    `);
    return result.rows[0] || null;
  }

  /**
   * Export full ledger for external audit
   */
  async exportLedger(orgId: number) {
    const result = await db.execute(sql`
      SELECT 
        l.id, l.evidence_id, l.sequence_num, l.entry_hash, l.prev_hash, 
        l.content_hash, l.created_at,
        e.uco_control_id, e.source, e.collected_at
      FROM evidence_ledger l
      JOIN org_evidence e ON e.id = l.evidence_id
      WHERE l.org_id = ${orgId}
      ORDER BY l.sequence_num ASC
    `);
    return {
      orgId,
      exportedAt: new Date().toISOString(),
      format: 'EC-WORM-LEDGER-v1',
      entries: result.rows,
    };
  }
}
