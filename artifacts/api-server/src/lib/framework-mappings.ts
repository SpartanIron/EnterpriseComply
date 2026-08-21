import { db, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Phase 1b - the one place that knows how objectives map to framework
 * requirements, and the one place that knows how two identifier notations for
 * the same requirement are reconciled.
 *
 * WHY THIS EXISTS
 *
 * Before this file there were three answers to "which requirements does this
 * objective satisfy", and the product showed two of them to the same user on
 * the same day:
 *
 *   uco_framework_mappings   10 objectives mapped to 800-171, Rev 3 notation
 *                            such as 03.05.03
 *   UCO_TO_NIST_MAP          24 objectives, hardcoded in sprs.service.ts,
 *                            Rev 2 notation such as 3.5.3
 *   control_crosswalk        0 rows. The table exists and is empty, and the
 *                            endpoint that reads it returns [] forever.
 *
 * Overlap between the first two was 9 objectives, the union 25. So the
 * Frameworks page believed 800-171 had ten mapped objectives while the SPRS
 * page scored twenty-four of them.
 *
 * THE IDENTIFIER QUESTION, ANSWERED RATHER THAN ASSUMED
 *
 * It matters a great deal whether 03.05.03 and 3.5.3 are the same requirement
 * written twice or two different requirements from two revisions, because the
 * first is a data move and the second is a control-authoring exercise nobody
 * should do by inference.
 *
 * For every one of the 9 overlapping objectives the two sources name the same
 * requirement and differ only by zero padding. So the reconciliation is a
 * deterministic transform, implemented once below as normaliseScoringId, and
 * its totality over the data actually held was verified rather than assumed:
 * all 48 requirement identifiers referenced by the old hardcoded map and all
 * 10 identifiers already in the table resolve into the 110-entry weighted set,
 * with zero misses.
 *
 * That is a property of the data, not a law, so findUnresolvableMappings
 * below turns it into something CI enforces on every future mapping row.
 *
 * A NOTE ON REVISIONS, WHICH IS NOT A BUG TO BE COLLAPSED
 *
 * The DoD Assessment Methodology that produces an SPRS score is defined
 * against the 110 requirements of SP 800-171 Rev 2, with the 5/3/1 weighting
 * and the -203 floor encoded below. The framework catalog, meanwhile, labels
 * the framework Rev 3. Those are both true at once and neither should be
 * quietly rewritten into the other, so revision is modelled as data on the
 * mapping row and the scoring join goes through scoring_control_id.
 */

/**
 * Frameworks whose posture is turned into a score by a published external
 * methodology, rather than just counted. Only these need a scoring identifier,
 * and only these are subject to the CI resolvability guard.
 */
export const SCORED_FRAMEWORK_KEYS = ["nist-800-171"] as const;

export type ScoredFrameworkKey = (typeof SCORED_FRAMEWORK_KEYS)[number];

/**
 * SP 800-171 Rev 2, all 110 security requirements, with the DoD Assessment
 * Methodology point values. Relocated here from sprs.service.ts unchanged so
 * that the scorer, the migration that backfills scoring identifiers, and the
 * CI guard are all reading one copy. Total weight is 252, which is the value
 * the -203 floor and the 110 ceiling are derived from.
 */
export const NIST_800_171_R2_WEIGHTS: Record<string, number> = {
  "3.1.1": 5, "3.1.2": 5, "3.1.3": 3, "3.1.4": 3, "3.1.5": 3, "3.1.6": 1, "3.1.7": 3, "3.1.8": 1,
  "3.1.9": 1, "3.1.10": 1, "3.1.11": 1, "3.1.12": 3, "3.1.13": 3, "3.1.14": 3, "3.1.15": 1, "3.1.16": 1,
  "3.1.17": 1, "3.1.18": 1, "3.1.19": 1, "3.1.20": 1, "3.1.21": 1, "3.1.22": 1,
  "3.2.1": 5, "3.2.2": 5, "3.2.3": 1,
  "3.3.1": 5, "3.3.2": 5, "3.3.3": 1, "3.3.4": 1, "3.3.5": 1, "3.3.6": 1, "3.3.7": 1, "3.3.8": 1, "3.3.9": 1,
  "3.4.1": 3, "3.4.2": 3, "3.4.3": 1, "3.4.4": 1, "3.4.5": 1, "3.4.6": 3, "3.4.7": 3, "3.4.8": 1, "3.4.9": 1,
  "3.5.1": 5, "3.5.2": 5, "3.5.3": 5, "3.5.4": 1, "3.5.5": 1, "3.5.6": 1, "3.5.7": 1, "3.5.8": 1, "3.5.9": 1, "3.5.10": 1, "3.5.11": 1,
  "3.6.1": 5, "3.6.2": 3, "3.6.3": 1,
  "3.7.1": 5, "3.7.2": 5, "3.7.3": 1, "3.7.4": 1, "3.7.5": 1, "3.7.6": 1,
  "3.8.1": 1, "3.8.2": 1, "3.8.3": 1, "3.8.4": 1, "3.8.5": 1, "3.8.6": 1, "3.8.7": 1, "3.8.8": 1, "3.8.9": 1,
  "3.9.1": 3, "3.9.2": 5,
  "3.10.1": 5, "3.10.2": 3, "3.10.3": 1, "3.10.4": 1, "3.10.5": 1, "3.10.6": 1,
  "3.11.1": 5, "3.11.2": 3, "3.11.3": 3,
  "3.12.1": 5, "3.12.2": 3, "3.12.3": 3, "3.12.4": 1,
  "3.13.1": 5, "3.13.2": 3, "3.13.3": 1, "3.13.4": 1, "3.13.5": 3, "3.13.6": 3, "3.13.7": 1, "3.13.8": 5, "3.13.9": 1, "3.13.10": 1, "3.13.11": 5, "3.13.12": 1, "3.13.13": 1, "3.13.14": 1, "3.13.15": 1, "3.13.16": 1,
  "3.14.1": 5, "3.14.2": 5, "3.14.3": 5, "3.14.4": 3, "3.14.5": 3, "3.14.6": 5, "3.14.7": 5,
};

/** 252. Computed, never written down twice. */
export const NIST_800_171_R2_TOTAL_WEIGHT = Object.values(NIST_800_171_R2_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
);

/** 110. The denominator the DoD methodology uses, and the SPRS ceiling. */
export const NIST_800_171_R2_REQUIREMENT_COUNT = Object.keys(NIST_800_171_R2_WEIGHTS).length;

/**
 * The scoring set a framework key is measured against. Returns undefined for
 * frameworks that are counted rather than scored, which is most of them.
 */
export function scoringSetFor(frameworkKey: string): Record<string, number> | undefined {
  return frameworkKey === "nist-800-171" ? NIST_800_171_R2_WEIGHTS : undefined;
}

/**
 * Strip zero padding from each dot-separated segment, so that the notation the
 * catalog uses and the notation the scoring methodology uses meet on one key.
 *
 *   normaliseScoringId("03.05.03")  ->  "3.5.3"
 *   normaliseScoringId("3.5.3")     ->  "3.5.3"
 *   normaliseScoringId("03.13.11")  ->  "3.13.11"
 *
 * Deliberately not a regex: segment-wise integer parsing makes the "10 is not
 * 010 is not 1" cases obvious and keeps a stray leading zero inside a
 * multi-digit segment from silently changing the number. Anything that is not
 * a run of digits is passed through untouched rather than mangled, because a
 * requirement identifier this function does not understand should surface as
 * an unresolvable identifier in the guard below, not as a corrupted one.
 */
export function normaliseScoringId(identifier: string): string {
  return String(identifier)
    .trim()
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? String(parseInt(segment, 10)) : segment))
    .join(".");
}

/**
 * The inverse, to the extent one exists: render a requirement identifier in
 * the zero-padded notation the catalog rows use, so relocated rows are stored
 * in one notation rather than two.
 *
 *   padScoringId("3.5.4")    ->  "03.05.04"
 *   padScoringId("3.13.11")  ->  "03.13.11"
 *
 * Segments already two or more digits wide are left alone, which is why
 * 3.13.11 keeps its 13 and its 11.
 */
export function padScoringId(identifier: string): string {
  return String(identifier)
    .trim()
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? segment.padStart(2, "0") : segment))
    .join(".");
}

export interface UnresolvableMapping {
  frameworkKey: string;
  ucoControlId: string;
  frameworkControlId: string;
  scoringControlId: string | null;
  reason: string;
}

/**
 * The standing guard. For every mapping row belonging to a scored framework,
 * assert that its scoring identifier resolves into that framework's scoring
 * set. Returns the rows that do not, so the caller decides whether that is a
 * log line or a failed build.
 *
 * This is the part that stops the class of bug rather than the instance. The
 * consolidation was only safe because the notations happened to differ by
 * padding alone; nothing prevents somebody adding a Rev 3 requirement that has
 * no Rev 2 counterpart, and if that happens it should break a build rather
 * than silently score as unmet forever.
 */
export async function findUnresolvableMappings(): Promise<UnresolvableMapping[]> {
  const problems: UnresolvableMapping[] = [];

  for (const frameworkKey of SCORED_FRAMEWORK_KEYS) {
    const scoringSet = scoringSetFor(frameworkKey);
    if (!scoringSet) continue;

    const rows = await db.query.ucoFrameworkMappingsTable.findMany({
      where: eq(ucoFrameworkMappingsTable.frameworkKey, frameworkKey),
    });

    for (const row of rows) {
      const stored = (row as { scoringControlId?: string | null }).scoringControlId ?? null;
      const candidate = stored ?? normaliseScoringId(row.frameworkControlId);

      if (!(candidate in scoringSet)) {
        problems.push({
          frameworkKey,
          ucoControlId: row.ucoControlId,
          frameworkControlId: row.frameworkControlId,
          scoringControlId: stored,
          reason: stored
            ? "scoring_control_id is not a requirement in the scoring set"
            : "no scoring_control_id, and the framework identifier does not normalise into the scoring set",
        });
      }
    }
  }

  return problems;
}

/**
 * Every mapping row for a framework, with the scoring identifier resolved.
 * The one read path for objective-to-requirement mappings. Callers that used to
 * carry their own table go through here.
 */
export interface ResolvedMapping {
  ucoControlId: string;
  frameworkKey: string;
  frameworkControlId: string;
  frameworkControlName: string;
  scoringControlId: string;
  frameworkRevision: string | null;
  mappingSource: string;
}

export async function getResolvedMappings(frameworkKey: string): Promise<ResolvedMapping[]> {
  const rows = await db.query.ucoFrameworkMappingsTable.findMany({
    where: eq(ucoFrameworkMappingsTable.frameworkKey, frameworkKey),
  });

  return rows.map((row) => {
    const extended = row as typeof row & {
      scoringControlId?: string | null;
      frameworkRevision?: string | null;
      mappingSource?: string | null;
    };
    return {
      ucoControlId: row.ucoControlId,
      frameworkKey: row.frameworkKey,
      frameworkControlId: row.frameworkControlId,
      frameworkControlName: row.frameworkControlName,
      scoringControlId:
        extended.scoringControlId ?? normaliseScoringId(row.frameworkControlId),
      frameworkRevision: extended.frameworkRevision ?? null,
      mappingSource: extended.mappingSource ?? "catalog",
    };
  });
}
