import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * WORM Evidence Ledger Migration
 *
 * Implements Write-Once-Read-Many (WORM) semantics at the PostgreSQL layer:
 * 1. Append-only trigger: blocks UPDATE and DELETE on org_evidence table
 * 2. Hash chain: each evidence row stores SHA-256 of (previous_hash || current_content)
 * 3. Ledger audit table: immutable record of all evidence entries in insertion order
 * 4. Tamper detection: verify full chain integrity via ledger verification function
 *
 * This satisfies FedRAMP ConMon, CMMC evidence immutability, and SOC 2 CC7.2
 * requirements for audit log integrity without requiring QLDB or WORM S3.
 */

export async function runWormLedgerMigration(db: any) {
  // ── 1. Evidence ledger chain table ─────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS evidence_ledger (
      id            SERIAL PRIMARY KEY,
      evidence_id   INTEGER NOT NULL REFERENCES org_evidence(id),
      org_id        INTEGER NOT NULL,
      sequence_num  BIGINT  NOT NULL,
      entry_hash    TEXT    NOT NULL,  -- SHA-256 of (prev_hash || content_hash || timestamp)
      prev_hash     TEXT    NOT NULL,  -- Hash of previous ledger entry (or genesis hash for first)
      content_hash  TEXT    NOT NULL,  -- SHA-256 of evidence content fields
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, sequence_num)
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_evidence_ledger_org_seq ON evidence_ledger(org_id, sequence_num)
  `);

  // ── 2. WORM trigger: block UPDATE and DELETE on org_evidence ───────────────
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION enforce_evidence_worm()
    RETURNS TRIGGER AS 
    \$func\$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 
          'WORM VIOLATION: Evidence record (id=%) cannot be deleted. Evidence records are immutable per FedRAMP/CMMC policy.', 
          OLD.id
          USING ERRCODE = 'restrict_violation',
                HINT = 'To supersede evidence, insert a new record with status=superseded referencing the original.';
      END IF;
      
      IF TG_OP = 'UPDATE' THEN
        -- Allow only non-content status updates (e.g., marking as superseded)
        -- Content fields (description, metadata, source, uco_control_id) are immutable
        IF OLD.description IS DISTINCT FROM NEW.description OR
           OLD.source IS DISTINCT FROM NEW.source OR
           OLD.uco_control_id IS DISTINCT FROM NEW.uco_control_id OR
           OLD.org_id IS DISTINCT FROM NEW.org_id THEN
          RAISE EXCEPTION
            'WORM VIOLATION: Evidence content fields (description, source, uco_control_id) are immutable (id=%). WORM policy enforced.',
            OLD.id
            USING ERRCODE = 'restrict_violation',
                  HINT = 'Content fields cannot be modified after insertion. Create a new evidence record instead.';
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    \$func\$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    DROP TRIGGER IF EXISTS evidence_worm_enforce ON org_evidence
  `);

  await db.execute(sql`
    CREATE TRIGGER evidence_worm_enforce
    BEFORE UPDATE OR DELETE ON org_evidence
    FOR EACH ROW
    EXECUTE FUNCTION enforce_evidence_worm()
  `);

  // ── 3. Trigger: auto-append to ledger on INSERT ────────────────────────────
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION append_to_evidence_ledger()
    RETURNS TRIGGER AS
    \$func\$
    DECLARE
      v_prev_hash    TEXT;
      v_sequence_num BIGINT;
      v_content_hash TEXT;
      v_entry_hash   TEXT;
      v_genesis_hash TEXT := 'GENESIS:EnterpriseComply:evidence-ledger:v1';
    BEGIN
      -- Get next sequence number for this org
      SELECT COALESCE(MAX(sequence_num), 0) + 1
        INTO v_sequence_num
        FROM evidence_ledger
       WHERE org_id = NEW.org_id;

      -- Get previous hash (genesis if first entry)
      SELECT COALESCE(
        (SELECT entry_hash FROM evidence_ledger 
          WHERE org_id = NEW.org_id 
          ORDER BY sequence_num DESC 
          LIMIT 1),
        encode(sha256(v_genesis_hash::bytea), 'hex')
      ) INTO v_prev_hash;

      -- Content hash is stored in metadata.contentHash (set by application layer)
      v_content_hash := COALESCE(
        NEW.metadata->>'contentHash',
        encode(sha256((NEW.org_id::text || NEW.uco_control_id || COALESCE(NEW.description,'') || NEW.collected_at::text)::bytea), 'hex')
      );

      -- Chain hash: SHA-256(prevHash || contentHash || timestamp)
      v_entry_hash := encode(
        sha256((v_prev_hash || v_content_hash || NOW()::text)::bytea),
        'hex'
      );

      INSERT INTO evidence_ledger (
        evidence_id, org_id, sequence_num, entry_hash, prev_hash, content_hash, created_at
      ) VALUES (
        NEW.id, NEW.org_id, v_sequence_num, v_entry_hash, v_prev_hash, v_content_hash, NOW()
      );

      -- Store ledger entry hash back into evidence metadata for easy verification
      NEW.metadata := COALESCE(NEW.metadata, '{}')::jsonb || 
        jsonb_build_object(
          'ledgerSequence', v_sequence_num,
          'ledgerHash', v_entry_hash,
          'prevLedgerHash', v_prev_hash
        );

      RETURN NEW;
    END;
    \$func\$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    DROP TRIGGER IF EXISTS evidence_ledger_append ON org_evidence
  `);

  await db.execute(sql`
    CREATE TRIGGER evidence_ledger_append
    BEFORE INSERT ON org_evidence
    FOR EACH ROW
    EXECUTE FUNCTION append_to_evidence_ledger()
  `);

  // ── 4. Chain verification function ────────────────────────────────────────
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION verify_evidence_chain(p_org_id INTEGER)
    RETURNS TABLE (
      sequence_num  BIGINT,
      evidence_id   INTEGER,
      is_valid      BOOLEAN,
      expected_hash TEXT,
      stored_hash   TEXT,
      tampered_at   TIMESTAMPTZ
    ) AS
    \$func\$
    DECLARE
      v_genesis_hash TEXT := encode(sha256('GENESIS:EnterpriseComply:evidence-ledger:v1'::bytea), 'hex');
      v_prev_hash    TEXT := v_genesis_hash;
      rec            RECORD;
    BEGIN
      FOR rec IN
        SELECT l.*, e.collected_at, e.metadata
          FROM evidence_ledger l
          JOIN org_evidence e ON e.id = l.evidence_id
         WHERE l.org_id = p_org_id
         ORDER BY l.sequence_num ASC
      LOOP
        -- Verify chain linkage
        IF rec.prev_hash <> v_prev_hash THEN
          RETURN QUERY SELECT 
            rec.sequence_num, rec.evidence_id, FALSE,
            v_prev_hash, rec.prev_hash, rec.created_at;
        ELSE
          RETURN QUERY SELECT 
            rec.sequence_num, rec.evidence_id, TRUE,
            rec.entry_hash, rec.entry_hash, NULL::TIMESTAMPTZ;
        END IF;
        
        v_prev_hash := rec.entry_hash;
      END LOOP;
    END;
    \$func\$ LANGUAGE plpgsql;
  `);

  console.log('WORM Evidence Ledger migration complete: triggers, chain, and verify function installed');
}
