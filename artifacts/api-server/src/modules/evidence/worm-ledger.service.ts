import { Injectable, OnModuleInit } from '@nestjs/common';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { runWormLedgerMigration } from '../../migrations/worm-evidence-ledger.migration';

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
  async onModuleInit() {
    // Install WORM triggers and ledger chain on startup
    await runWormLedgerMigration(db);
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
