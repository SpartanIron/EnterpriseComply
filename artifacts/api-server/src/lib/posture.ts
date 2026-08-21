import {
  db,
  ucoControlsTable,
  orgControlResultsTable,
  orgFrameworksTable,
  ucoFrameworkMappingsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Phase 1 - the single source of truth for compliance posture.
 *
 * WHY THIS EXISTS
 *
 * Five surfaces answered "how compliant is this org?" five different ways,
 * because each one did its own arithmetic over a different set of rows:
 *
 *   GET /orgs/1/controls        71 objectives: 2 passing, 5 warning, 3 failing,
 *                               61 not tested
 *   GET /orgs/1/dashboard       total 10, passing 2, failing 3, notTested 5,
 *                               overallScore 20
 *   GET /orgs/1/frameworks      800-171 total 110, score 0, passing 0
 *   GET /orgs/1/sprs            met 4, notMet 6, notReviewed 100 of 110
 *   Frameworks page             21 catalog entries, 9 rendered
 *
 * None of those numbers is a bug on its own; the bug is that there are five of
 * them. Three concrete causes, all measured before this file was written:
 *
 *   1. getDashboard() counts rows in org_control_results, not control
 *      objectives. Sixty-one objectives that have never been tested have no row
 *      at all, so they are not merely reported as untested - they are invisible,
 *      and the score's denominator shrinks to the 10 that happen to have a row.
 *      That is why 2 of 71 reads as 20 percent.
 *
 *   2. Every consumer derives notTested by subtraction. "warning" is a real
 *      status in org_control_results and is in none of the subtrahends, so all
 *      five warnings are silently relabelled as untested. That is the whole of
 *      the dashboard's notTested figure.
 *
 *   3. org_frameworks.total_controls is the framework's published control count
 *      from the catalog (110 for 800-171), while the mapping table only maps 10
 *      UCO objectives to it. Scoring one against the other, in either
 *      direction, produces a number that means nothing.
 *
 * WHAT THIS MODULE GUARANTEES
 *
 *   - One status vocabulary, with "warning" first class. Nothing is derived by
 *     subtraction anywhere in this file; every objective is classified once and
 *     counted once, so the four buckets always sum to the total by construction.
 *
 *   - Coverage is stated, never hidden. A framework reports how many of its
 *     published controls are actually mapped. Claiming 800-171 readiness off ten
 *     mapped objectives is a compliance misstatement, so the ratio that would
 *     let a reader notice is part of the object rather than something a page has
 *     to remember to compute.
 *
 *   - Every ratio is named after its own denominator. scorePercent is over the
 *     framework's published control count, mappedScorePercent over what is
 *     mapped, assessedScorePercent over what has actually been tested. No
 *     caller has to guess which one it is looking at, which is how the five-way
 *     discrepancy started.
 *
 *   - The legacy figures are computed here too, from the same read, so drift
 *     between old and new is measurable rather than argued about. See
 *     diffLegacyDashboard() and posture-drift.ts.
 *
 * This module is read-only. It writes nothing and caches nothing, so it can be
 * called from a shadow path without changing behaviour.
 */

export const POSTURE_SCHEMA_VERSION = "posture-ssot@1";

/**
 * The complete status vocabulary. org_control_results.status is a free-text
 * column, so this list is the contract and normaliseStatus() is the border.
 */
export const POSTURE_STATUSES = ["passing", "warning", "failing", "not_tested"] as const;

export type PostureStatus = (typeof POSTURE_STATUSES)[number];

export interface PostureCounts {
  passing: number;
  warning: number;
  failing: number;
  notTested: number;
  /** passing + warning + failing. What somebody has actually looked at. */
  assessed: number;
  /** Always equals passing + warning + failing + notTested. */
  total: number;
}

export interface FrameworkPosture {
  frameworkKey: string;
  name: string;
  active: boolean;
  /** The framework's published control count, from the catalog. */
  declaredControlCount: number;
  /** Distinct UCO objectives mapped to this framework that actually exist. */
  mappedControlCount: number;
  /** mappedControlCount / declaredControlCount. Below 100 means partial. */
  coveragePercent: number;
  partialCoverage: boolean;
  counts: PostureCounts;
  /** passing / declaredControlCount - the honest answer to "how compliant". */
  scorePercent: number;
  /** passing / mappedControlCount - what the old rollup computed. */
  mappedScorePercent: number;
  /** passing / assessed - useful, and the easiest number to misread. */
  assessedScorePercent: number;
  /** What org_frameworks currently has stored, for drift comparison. */
  stored: {
    complianceScore: number;
    passingControls: number;
    failingControls: number;
    notTestedControls: number;
  };
}

export interface LegacyDashboardPosture {
  passing: number;
  failing: number;
  notTested: number;
  total: number;
  overallScore: number;
}

export interface Posture {
  schema: string;
  orgId: number;
  computedAt: string;
  counts: PostureCounts;
  /** assessed / total. How much of the control set has been looked at. */
  coveragePercent: number;
  /** passing / total. The headline figure. */
  scorePercent: number;
  /** passing / assessed. Flattering, and labelled as such. */
  assessedScorePercent: number;
  frameworks: FrameworkPosture[];
  /**
   * Status strings found in the database that are not in POSTURE_STATUSES,
   * with counts. Should always be empty; if it is not, something is writing a
   * status this module does not know how to score and the drift report says so
   * instead of quietly folding it into notTested.
   */
  unrecognisedStatuses: Record<string, number>;
  /** Results referencing a UCO control id that no longer exists. */
  orphanedResults: number;
  /** Exactly what getDashboard() reports today, from the same read. */
  legacyDashboard: LegacyDashboardPosture;
}

function percent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function emptyCounts(): PostureCounts {
  return { passing: 0, warning: 0, failing: 0, notTested: 0, assessed: 0, total: 0 };
}

/**
 * Classify a raw status column value. An absent row is untested, which is a
 * fact. A present row carrying a string this module does not recognise is a
 * different thing entirely, so the caller is told about it rather than having it
 * scored as untested in silence.
 */
export function normaliseStatus(raw: unknown): { status: PostureStatus; recognised: boolean } {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value.length === 0) return { status: "not_tested", recognised: true };
  if ((POSTURE_STATUSES as readonly string[]).includes(value)) {
    return { status: value as PostureStatus, recognised: true };
  }
  return { status: "not_tested", recognised: false };
}

export async function computePosture(orgId: number): Promise<Posture> {
  const [ucoControls, results, orgFrameworks, mappings] = await Promise.all([
    db.query.ucoControlsTable.findMany(),
    db.query.orgControlResultsTable.findMany({
      where: eq(orgControlResultsTable.orgId, orgId),
    }),
    db.query.orgFrameworksTable.findMany({
      where: eq(orgFrameworksTable.orgId, orgId),
    }),
    db.query.ucoFrameworkMappingsTable.findMany(),
  ]);

  const knownControlIds = new Set(ucoControls.map((control) => control.controlId));

  const statusByControl = new Map<string, PostureStatus>();
  const unrecognisedStatuses: Record<string, number> = {};
  let orphanedResults = 0;

  for (const result of results) {
    const { status, recognised } = normaliseStatus((result as { status?: unknown }).status);
    if (!recognised) {
      const key = String((result as { status?: unknown }).status);
      unrecognisedStatuses[key] = (unrecognisedStatuses[key] ?? 0) + 1;
    }
    if (!knownControlIds.has(result.ucoControlId)) {
      orphanedResults += 1;
      continue;
    }
    statusByControl.set(result.ucoControlId, status);
  }

  // The one place a control's status is decided. Absent means untested.
  const statusOf = (controlId: string): PostureStatus =>
    statusByControl.get(controlId) ?? "not_tested";

  // Classified once, counted once. Nothing here is a subtraction, which is what
  // guarantees the buckets sum to the total and that "warning" cannot vanish.
  const tally = (controlIds: string[]): PostureCounts => {
    const counts = emptyCounts();
    for (const controlId of controlIds) {
      const status = statusOf(controlId);
      if (status === "passing") counts.passing += 1;
      else if (status === "warning") counts.warning += 1;
      else if (status === "failing") counts.failing += 1;
      else counts.notTested += 1;
    }
    counts.assessed = counts.passing + counts.warning + counts.failing;
    counts.total = controlIds.length;
    return counts;
  };

  const allControlIds = ucoControls.map((control) => control.controlId);
  const counts = tally(allControlIds);

  const mappedByFramework = new Map<string, Set<string>>();
  for (const mapping of mappings) {
    let set = mappedByFramework.get(mapping.frameworkKey);
    if (!set) {
      set = new Set<string>();
      mappedByFramework.set(mapping.frameworkKey, set);
    }
    set.add(mapping.ucoControlId);
  }

  const frameworks: FrameworkPosture[] = orgFrameworks
    .map((framework) => {
      // A mapping to an objective that no longer exists must not inflate
      // coverage, so the mapped set is intersected with the live control set.
      const mapped = [...(mappedByFramework.get(framework.frameworkKey) ?? new Set<string>())]
        .filter((controlId) => knownControlIds.has(controlId));

      const frameworkCounts = tally(mapped);
      const declared = Number(framework.totalControls ?? 0);

      return {
        frameworkKey: framework.frameworkKey,
        name: framework.name,
        active: framework.active === true,
        declaredControlCount: declared,
        mappedControlCount: mapped.length,
        coveragePercent: percent(mapped.length, declared),
        partialCoverage: declared > 0 && mapped.length < declared,
        counts: frameworkCounts,
        scorePercent: percent(frameworkCounts.passing, declared > 0 ? declared : mapped.length),
        mappedScorePercent: percent(frameworkCounts.passing, mapped.length),
        assessedScorePercent: percent(frameworkCounts.passing, frameworkCounts.assessed),
        stored: {
          complianceScore: Number(framework.complianceScore ?? 0),
          passingControls: Number(framework.passingControls ?? 0),
          failingControls: Number(framework.failingControls ?? 0),
          notTestedControls: Number(framework.notTestedControls ?? 0),
        },
      };
    })
    .sort((a, b) => a.frameworkKey.localeCompare(b.frameworkKey));

  // Reproduced verbatim from OrgsService.getDashboard() so the drift report
  // compares like with like off a single read rather than two HTTP calls that
  // could straddle a write.
  const legacyPassing = results.filter((r) => r.status === "passing").length;
  const legacyFailing = results.filter((r) => r.status === "failing").length;
  const legacyTotal = results.length;

  return {
    schema: POSTURE_SCHEMA_VERSION,
    orgId,
    computedAt: new Date().toISOString(),
    counts,
    coveragePercent: percent(counts.assessed, counts.total),
    scorePercent: percent(counts.passing, counts.total),
    assessedScorePercent: percent(counts.passing, counts.assessed),
    frameworks,
    unrecognisedStatuses,
    orphanedResults,
    legacyDashboard: {
      passing: legacyPassing,
      failing: legacyFailing,
      notTested: legacyTotal - legacyPassing - legacyFailing,
      total: legacyTotal,
      overallScore: percent(legacyPassing, legacyTotal),
    },
  };
}

export interface PostureDivergence {
  surface: string;
  field: string;
  legacy: number;
  ssot: number;
  delta: number;
  cause: string;
}

/**
 * Compare the legacy dashboard arithmetic against the SSOT. The causes are
 * written out rather than inferred at runtime because they were established by
 * reading the code, and a drift report that only says "these differ" makes the
 * on-call engineer redo that work at the worst possible moment.
 */
export function diffLegacyDashboard(posture: Posture): PostureDivergence[] {
  const divergences: PostureDivergence[] = [];
  const legacy = posture.legacyDashboard;

  const add = (field: string, legacyValue: number, ssotValue: number, cause: string) => {
    if (legacyValue !== ssotValue) {
      divergences.push({
        surface: "dashboard.controlSummary",
        field,
        legacy: legacyValue,
        ssot: ssotValue,
        delta: ssotValue - legacyValue,
        cause,
      });
    }
  };

  add(
    "total",
    legacy.total,
    posture.counts.total,
    "legacy counts rows in org_control_results; an objective never tested has no row, so it is absent rather than untested",
  );
  add(
    "passing",
    legacy.passing,
    posture.counts.passing,
    "same row set, so this should only differ if a result points at a control id that no longer exists",
  );
  add(
    "failing",
    legacy.failing,
    posture.counts.failing,
    "same row set, so this should only differ if a result points at a control id that no longer exists",
  );
  add(
    "notTested",
    legacy.notTested,
    posture.counts.notTested,
    "legacy derives notTested by subtraction, which absorbs every warning and omits objectives with no result row",
  );
  add(
    "overallScore",
    legacy.overallScore,
    posture.scorePercent,
    "legacy divides passing by the number of rows that exist rather than the number of objectives, inflating the score",
  );

  if (posture.counts.warning > 0) {
    divergences.push({
      surface: "dashboard.controlSummary",
      field: "warning",
      legacy: 0,
      ssot: posture.counts.warning,
      delta: posture.counts.warning,
      cause: "the legacy summary has no warning bucket at all, so warnings are reported as untested",
    });
  }

  return divergences;
}

/**
 * Compare the scores stored on org_frameworks against the SSOT. These columns
 * are only ever written by ControlsService.updateFrameworkScores(), which is
 * called from one place - a manual control-result patch - inside a
 * catch that discards its error. An org where nobody has hand-edited a control
 * therefore has stored zeros regardless of its real posture.
 */
export function diffStoredFrameworkScores(posture: Posture): PostureDivergence[] {
  const divergences: PostureDivergence[] = [];

  for (const framework of posture.frameworks) {
    const surface = `org_frameworks[${framework.frameworkKey}]`;

    if (framework.stored.passingControls !== framework.counts.passing) {
      divergences.push({
        surface,
        field: "passingControls",
        legacy: framework.stored.passingControls,
        ssot: framework.counts.passing,
        delta: framework.counts.passing - framework.stored.passingControls,
        cause: "stored value is only refreshed on a manual control-result patch, inside a swallowed catch",
      });
    }

    if (framework.stored.failingControls !== framework.counts.failing) {
      divergences.push({
        surface,
        field: "failingControls",
        legacy: framework.stored.failingControls,
        ssot: framework.counts.failing,
        delta: framework.counts.failing - framework.stored.failingControls,
        cause: "stored value is only refreshed on a manual control-result patch, inside a swallowed catch",
      });
    }

    if (framework.stored.notTestedControls !== framework.counts.notTested) {
      divergences.push({
        surface,
        field: "notTestedControls",
        legacy: framework.stored.notTestedControls,
        ssot: framework.counts.notTested,
        delta: framework.counts.notTested - framework.stored.notTestedControls,
        cause: "stored value is mapped-minus-passing-minus-failing, which counts every warning as untested",
      });
    }

    if (framework.stored.complianceScore !== framework.scorePercent) {
      divergences.push({
        surface,
        field: "complianceScore",
        legacy: framework.stored.complianceScore,
        ssot: framework.scorePercent,
        delta: framework.scorePercent - framework.stored.complianceScore,
        cause: "stored score divides by the mapped objective count; the SSOT divides by the framework's published control count",
      });
    }

  }

  return divergences;
}

/** Every divergence the SSOT can currently see, in one call. */
/**
 * Phase 1b changed what this number means, and that is worth stating plainly
 * rather than burying, because the effect is to make the headline count smaller.
 *
 * In shadow mode it returned everything that differed: the legacy dashboard
 * arithmetic, the stale stored framework columns, and every framework whose
 * mappings do not cover its published control count. Thirteen items on the
 * measured org. Useful for deciding what to fix, useless as a health signal,
 * because two of those three groups can never reach zero:
 *
 *   - the legacy dashboard arithmetic is computed inside computePosture for
 *     comparison purposes. Nothing serves it any more after the cutover, so a
 *     permanent difference there is a historical fact, not a fault.
 *
 *   - partial framework coverage means 25 of 110 published requirements are
 *     mapped. That is true, it matters, and it is not drift. Treating it as
 *     drift would mean the alert is red forever and therefore ignored.
 *
 * So this function now returns only what a healthy system must have at zero:
 * disagreement between the SSOT and the denormalised columns other code reads.
 * The other two groups are still reported, by legacyArithmeticNotes and
 * coverageWarnings, and the drift endpoint surfaces all three separately. The
 * point of the split is that one of the three is a bug and the other two are
 * facts, and an alert that cannot tell them apart is not an alert.
 */
export function diffPosture(posture: Posture): PostureDivergence[] {
  return diffStoredFrameworkScores(posture);
}

/**
 * Retained for visibility, not for alerting. This is what the dashboard would
 * have said if it were still doing its own arithmetic, so it stays a tripwire:
 * if somebody reintroduces per-page counting, the numbers here start moving
 * again and there is a place to see it.
 */
export function legacyArithmeticNotes(posture: Posture): PostureDivergence[] {
  return diffLegacyDashboard(posture);
}

export interface CoverageWarning {
  frameworkKey: string;
  name: string;
  mappedControlCount: number;
  declaredControlCount: number;
  coveragePercent: number;
  note: string;
}

/**
 * Frameworks the product cannot honestly present as fully scored, because the
 * mappings reach only part of the published control set. Surfaced so a page can
 * say so next to the number instead of letting a reader assume a small score
 * means poor compliance when it partly means thin mappings.
 */
export function coverageWarnings(posture: Posture): CoverageWarning[] {
  return posture.frameworks
    .filter((framework) => framework.partialCoverage)
    .map((framework) => ({
      frameworkKey: framework.frameworkKey,
      name: framework.name,
      mappedControlCount: framework.mappedControlCount,
      declaredControlCount: framework.declaredControlCount,
      coveragePercent: framework.coveragePercent,
      note:
        "Only " + framework.mappedControlCount + " of " +
        framework.declaredControlCount +
        " published controls are mapped, so this framework is partially assessed " +
        "and should not be presented as fully scored.",
    }));
}

/**
 * Write the SSOT's per-framework numbers into the denormalised columns on
 * org_frameworks.
 *
 * Those columns exist because several pages read them instead of computing, and
 * they were only ever written by updateFrameworkScores() on a control-result
 * patch, inside a catch that swallowed its own failure. On the measured org they
 * were therefore all zero: nobody had patched a control since the rows were
 * created, so every page reading them was told this organisation has no passing
 * controls, no failing controls and a compliance score of zero.
 *
 * Calling this at boot and after every patch is what makes those columns a cache
 * of the SSOT rather than an independent and permanently stale opinion. It is
 * also what lets the drift count reach zero, which is the Phase 1b exit
 * criterion - before this, the stored columns could only converge by somebody
 * happening to edit a control.
 *
 * Idempotent by construction: it writes computed values, so running it twice
 * writes the same values twice. Never throws; a failure to refresh a cache must
 * not take a request or a boot down, and the SSOT remains correct regardless
 * because it does not read these columns.
 */
export async function syncStoredFrameworkPosture(
  orgId: number,
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  try {
    const posture = await computePosture(orgId);

    for (const framework of posture.frameworks) {
      try {
        await db
          .update(orgFrameworksTable)
          .set({
            complianceScore: framework.scorePercent,
            passingControls: framework.counts.passing,
            failingControls: framework.counts.failing,
            notTestedControls: framework.counts.notTested,
          })
          .where(
            and(
              eq(orgFrameworksTable.orgId, orgId),
              eq(orgFrameworksTable.frameworkKey, framework.frameworkKey),
            ),
          );
        updated += 1;
      } catch {
        failed += 1;
      }
    }
  } catch {
    failed += 1;
  }

  return { updated, failed };
}
