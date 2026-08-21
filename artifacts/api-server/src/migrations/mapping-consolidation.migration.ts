import { sql } from "drizzle-orm";
import {
  normaliseScoringId,
  padScoringId,
  scoringSetFor,
} from "../lib/framework-mappings";

/**
 * Phase 1b - fold the hardcoded objective-to-requirement map into the table
 * that was always supposed to hold it.
 *
 * ADDITIVE ONLY. This migration adds three columns, backfills two of them on
 * rows that already existed, creates one unique index, and inserts rows. It
 * contains no DELETE, no DROP, no TRUNCATE and no UPDATE that overwrites a
 * value somebody else wrote. That is deliberate and it is what makes the
 * ordering safe: because the schema after this migration is a superset of the
 * schema before it, the previous application image runs correctly against the
 * migrated database, so a bad deploy is recoverable by redeploying the old
 * image with no database step at all.
 *
 * The rollback script for the parts that are not simply forward-compatible was
 * written and committed before this file, and runs in CI on every fresh-database
 * job. See scripts/rollback-mapping-consolidation.cjs.
 *
 * THE ONE INTERESTING DECISION
 *
 * Nine of the objective/requirement pairs in the hardcoded map are already in
 * the table, written in the other notation - the table says 03.05.03 where the
 * code says 3.5.3. Inserting those again because the strings differ would turn
 * a consolidation into a duplication, which is the exact bug this phase exists
 * to end.
 *
 * So presence is decided on the normalised scoring identifier, not on the
 * stored notation. A pair the catalog already holds is skipped; a pair only the
 * code knew about is inserted, stored in the catalog notation so the table ends
 * up speaking one language, with the unpadded form kept in scoring_control_id
 * for the DoD methodology to join on.
 *
 * Expected effect on the org measured on 2026-08-21: 48 pairs in the map, 9
 * already represented, so 39 rows inserted, taking nist-800-171 from 10 rows
 * over 10 objectives to 49 rows over 25 objectives. Those numbers are
 * returned rather than asserted, because the migration has to be correct on a
 * database that does not look like that one.
 */

const FRAMEWORK = "nist-800-171";
const UNIQUE_INDEX = "uco_framework_mappings_triple_uniq";
const RELOCATED_SOURCE = "dod-sprs-methodology";
const CATALOG_REVISION = "r3";
const RELOCATED_REVISION = "r2-scoring";

const RELOCATION_RATIONALE =
  "Relocated by the Phase 1b consolidation out of the hardcoded UCO_TO_NIST_MAP " +
  "in sprs.service.ts. Scored by the DoD Assessment Methodology, which is defined " +
  "on SP 800-171 Rev 2 identifiers.";

/**
 * Seed data, copied verbatim from the map this migration retires. It lives here
 * rather than in lib/ on purpose: after this migration runs, the table is the
 * source of truth and nothing should ever read this object again. A one-time
 * relocation payload belongs in the one-time relocation.
 */
const RELOCATED_SPRS_MAPPINGS: Record<string, string[]> = {
  "UCO-AI-001": ["3.5.3", "3.5.4"],
  "UCO-AI-002": ["3.5.1", "3.5.2"],
  "UCO-AI-003": ["3.5.7", "3.5.8", "3.5.9"],
  "UCO-AI-004": ["3.5.5", "3.5.6"],
  "UCO-AC-001": ["3.1.1", "3.1.2"],
  "UCO-AC-002": ["3.1.5", "3.1.6"],
  "UCO-AC-003": ["3.1.3", "3.1.4"],
  "UCO-AC-004": ["3.1.12", "3.1.13"],
  "UCO-AC-005": ["3.9.1", "3.9.2"],
  "UCO-CM-001": ["3.4.1", "3.4.2"],
  "UCO-CM-002": ["3.4.6", "3.4.7"],
  "UCO-CM-003": ["3.4.3", "3.4.4"],
  "UCO-DP-001": ["3.13.1", "3.13.2"],
  "UCO-DP-002": ["3.13.8", "3.13.11"],
  "UCO-DP-003": ["3.13.16"],
  "UCO-AL-001": ["3.3.1", "3.3.2"],
  "UCO-AL-002": ["3.3.3", "3.3.4"],
  "UCO-VM-001": ["3.14.1", "3.14.2"],
  "UCO-VM-002": ["3.14.3", "3.14.4", "3.14.5"],
  "UCO-IR-001": ["3.6.1", "3.6.2"],
  "UCO-IR-002": ["3.6.3"],
  "UCO-ST-001": ["3.2.1", "3.2.2"],
  "UCO-CP-001": ["3.7.1", "3.7.2"],
  "UCO-CP-002": ["3.7.4", "3.7.5"],
};

export interface MappingConsolidationResult {
  columnsPresent: boolean;
  scoringIdsBackfilled: number;
  revisionsBackfilled: number;
  duplicateTriples: number;
  uniqueIndexPresent: boolean;
  relocatedRowsInserted: number;
  rowsForFramework: number;
  objectivesForFramework: number;
  unresolvableScoringIds: string[];
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  const r = result as { rows?: Array<Record<string, unknown>> };
  if (Array.isArray(r?.rows)) return r.rows;
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  return [];
}

function rowCount(result: unknown): number {
  const r = result as { rowCount?: number | null; rows?: unknown[] };
  if (typeof r?.rowCount === "number") return r.rowCount;
  if (Array.isArray(r?.rows)) return r.rows.length;
  return 0;
}

function firstNumber(result: unknown, key: string): number {
  const rows = rowsOf(result);
  const value = rows.length > 0 ? rows[0][key] : 0;
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function runMappingConsolidationMigration(
  db: any,
): Promise<MappingConsolidationResult> {
  // 1. EXPAND. Three additive columns. IF NOT EXISTS on every one, so a second
  //    boot is a no-op rather than an error, which is the only reason this is
  //    safe to call unconditionally on every start.
  await db.execute(
    sql`ALTER TABLE uco_framework_mappings ADD COLUMN IF NOT EXISTS framework_revision TEXT`,
  );
  await db.execute(
    sql`ALTER TABLE uco_framework_mappings ADD COLUMN IF NOT EXISTS scoring_control_id TEXT`,
  );
  await db.execute(
    sql`ALTER TABLE uco_framework_mappings ADD COLUMN IF NOT EXISTS mapping_source TEXT NOT NULL DEFAULT 'catalog'`,
  );

  // 2. Backfill the two nullable columns on rows that predate them. Done row by
  //    row in application code rather than as one clever UPDATE, because the
  //    padding transform then has exactly one implementation shared with the
  //    request path. A SQL regex here would be a second implementation, free to
  //    disagree with the first, which is the failure mode this whole phase is
  //    about. COALESCE means a partial previous run resumes rather than
  //    overwrites.
  const existing = await db.execute(sql`
    SELECT id, framework_control_id, scoring_control_id, framework_revision
      FROM uco_framework_mappings
     WHERE framework_key = ${FRAMEWORK}
  `);

  let scoringIdsBackfilled = 0;
  let revisionsBackfilled = 0;

  for (const row of rowsOf(existing)) {
    const needsScoringId = !row.scoring_control_id;
    const needsRevision = !row.framework_revision;
    if (!needsScoringId && !needsRevision) continue;

    const normalised = normaliseScoringId(String(row.framework_control_id));

    await db.execute(sql`
      UPDATE uco_framework_mappings
         SET scoring_control_id = COALESCE(scoring_control_id, ${normalised}),
             framework_revision = COALESCE(framework_revision, ${CATALOG_REVISION})
       WHERE id = ${row.id}
    `);

    if (needsScoringId) scoringIdsBackfilled += 1;
    if (needsRevision) revisionsBackfilled += 1;
  }

  // 3. Look before creating the constraint. If the table already contains
  //    duplicate triples, CREATE UNIQUE INDEX would throw and take the boot
  //    down with it. Measured on production before writing this: zero duplicate
  //    triples across all 387 mapping rows. Checking anyway, because a
  //    migration that is only correct against one database is not a migration.
  const duplicates = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1
        FROM uco_framework_mappings
       GROUP BY uco_control_id, framework_key, framework_control_id
      HAVING COUNT(*) > 1
    ) AS duplicated_triples
  `);
  const duplicateTriples = firstNumber(duplicates, "n");

  if (duplicateTriples === 0) {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uco_framework_mappings_triple_uniq
        ON uco_framework_mappings (uco_control_id, framework_key, framework_control_id)
    `);
  }

  const indexRow = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM pg_indexes WHERE indexname = ${UNIQUE_INDEX}`,
  );
  const uniqueIndexPresent = firstNumber(indexRow, "n") > 0;

  // 4. Relocate. Presence is keyed on the normalised identifier so that a pair
  //    the catalog already holds in Rev 3 notation is not inserted again in Rev
  //    2 notation. This set is the difference between consolidating and
  //    duplicating, and it is also why this loop is idempotent: on a second run
  //    every pair is already present and nothing is inserted.
  const present = new Set<string>(
    rowsOf(
      await db.execute(sql`
        SELECT uco_control_id,
               COALESCE(scoring_control_id, framework_control_id) AS scoring_key
          FROM uco_framework_mappings
         WHERE framework_key = ${FRAMEWORK}
      `),
    ).map(
      (row) =>
        String(row.uco_control_id) + "|" + normaliseScoringId(String(row.scoring_key)),
    ),
  );

  let relocatedRowsInserted = 0;

  for (const [ucoControlId, requirementIds] of Object.entries(RELOCATED_SPRS_MAPPINGS)) {
    for (const requirementId of requirementIds) {
      const scoringId = normaliseScoringId(requirementId);
      const key = ucoControlId + "|" + scoringId;
      if (present.has(key)) continue;

      const inserted = await db.execute(sql`
        INSERT INTO uco_framework_mappings
          (uco_control_id, framework_key, framework_control_id, framework_control_name,
           customer_responsibility, inherited, mapping_confidence, mapping_rationale,
           framework_revision, scoring_control_id, mapping_source)
        VALUES
          (${ucoControlId}, ${FRAMEWORK}, ${padScoringId(scoringId)},
           ${"NIST SP 800-171 Rev 2 requirement " + scoringId},
           'full', FALSE, 1.0, ${RELOCATION_RATIONALE},
           ${RELOCATED_REVISION}, ${scoringId}, ${RELOCATED_SOURCE})
        ON CONFLICT DO NOTHING
      `);

      relocatedRowsInserted += rowCount(inserted);
      present.add(key);
    }
  }

  // 5. Verify, and report rather than assume. Any row whose scoring identifier
  //    does not land in the weighted set would score as permanently unmet and
  //    nobody would ever be told why, so the identifiers are named here and the
  //    CI guard fails the build on a non-empty list.
  const finalRows = rowsOf(
    await db.execute(sql`
      SELECT uco_control_id, framework_control_id, scoring_control_id
        FROM uco_framework_mappings
       WHERE framework_key = ${FRAMEWORK}
    `),
  );

  const scoringSet = scoringSetFor(FRAMEWORK) ?? {};
  const unresolvableScoringIds = finalRows
    .filter((row) => {
      const candidate = row.scoring_control_id
        ? String(row.scoring_control_id)
        : normaliseScoringId(String(row.framework_control_id));
      return !(candidate in scoringSet);
    })
    .map((row) => String(row.uco_control_id) + ":" + String(row.framework_control_id));

  return {
    columnsPresent: true,
    scoringIdsBackfilled,
    revisionsBackfilled,
    duplicateTriples,
    uniqueIndexPresent,
    relocatedRowsInserted,
    rowsForFramework: finalRows.length,
    objectivesForFramework: new Set(finalRows.map((row) => String(row.uco_control_id))).size,
    unresolvableScoringIds,
  };
}
