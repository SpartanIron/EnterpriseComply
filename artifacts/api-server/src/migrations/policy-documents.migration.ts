import { sql } from "drizzle-orm";

/**
 * Customer-uploaded policy documents.
 *
 * Until now a policy could only be a row of Markdown that the platform itself
 * generated from one of its templates. An organisation that had already written
 * its own policies - which is every organisation that has been through an audit
 * once - had nowhere to put them, so the Policies page reflected the templates
 * the platform offered rather than the policies the organisation actually runs on.
 *
 * This adds the missing store.
 *
 * Expand-only, and idempotent:
 *   1. CREATE TABLE IF NOT EXISTS org_policy_documents, plus three indexes
 *   2. ALTER TABLE org_policies ADD COLUMN IF NOT EXISTS source_type
 *   3. ALTER TABLE org_policies ADD COLUMN IF NOT EXISTS current_document_id
 *   4. one backfill of source_type for rows that predate the column
 *
 * No existing column is dropped, narrowed or retyped, and nothing that reads
 * org_policies today has to change: both new columns are nullable and the read
 * path treats a NULL source_type the same way it treated a policy before the
 * column existed. The contract half - making source_type NOT NULL once every
 * writer sets it - is deliberately not in this migration.
 *
 * The reverse is scripts/rollback-policy-documents.cjs, committed before this file.
 *
 * On storing bytes in Postgres rather than an object store: the platform has no
 * bucket, no lifecycle policy and no signed-URL story, and adding all three to
 * ship a policy upload would put customer documents somewhere with weaker access
 * control than the row that points at them. A capped 10 MB base64 payload in a
 * TOASTed TEXT column inherits the tenancy, backup, audit and (once Phase 2
 * enforcement is flipped) row-level-security guarantees the rest of the data
 * already has. base64 costs about a third in stored size before TOAST
 * compression; that is the price of not standing up a second security boundary.
 * If document volume ever makes that trade wrong, the sha256 column is what an
 * externalising migration would key on.
 */
export async function runPolicyDocumentsMigration(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_policy_documents (
      id                SERIAL PRIMARY KEY,
      org_id            INTEGER NOT NULL,
      policy_id         INTEGER,
      version           INTEGER NOT NULL DEFAULT 1,
      filename          TEXT NOT NULL,
      mime_type         TEXT NOT NULL,
      size_bytes        INTEGER NOT NULL,
      sha256            TEXT NOT NULL,
      content_base64    TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'current',
      uploaded_by       TEXT,
      uploaded_by_email TEXT,
      note              TEXT,
      superseded_at     TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS org_policy_documents_org_idx
        ON org_policy_documents (org_id, created_at DESC)`,
  );

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS org_policy_documents_policy_idx
        ON org_policy_documents (policy_id, version DESC)`,
  );

  // One current version per policy, enforced by the database rather than by the
  // service that happens to be writing. Two uploads racing on the same policy is
  // an ordinary thing for a compliance team to do, and the loser must fail loudly
  // instead of leaving two rows both claiming to be the live document.
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS org_policy_documents_one_current_idx
        ON org_policy_documents (policy_id)
        WHERE status = 'current' AND policy_id IS NOT NULL`,
  );

  await db.execute(
    sql`ALTER TABLE org_policies ADD COLUMN IF NOT EXISTS source_type TEXT`,
  );

  await db.execute(
    sql`ALTER TABLE org_policies ADD COLUMN IF NOT EXISTS current_document_id INTEGER`,
  );

  // Backfill, not a default. Rows written before this column existed are
  // classified from evidence already in the row - a template_key means the
  // platform generated it - rather than assumed to be one thing or the other.
  // WHERE source_type IS NULL makes re-running this a no-op, and means an
  // operator who later corrects a value by hand does not have it overwritten on
  // the next boot.
  await db.execute(sql`
    UPDATE org_policies
       SET source_type = CASE WHEN template_key IS NOT NULL THEN 'template' ELSE 'authored' END
     WHERE source_type IS NULL
  `);
}
