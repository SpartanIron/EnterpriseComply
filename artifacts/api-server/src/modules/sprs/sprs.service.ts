import { Injectable } from "@nestjs/common";
import { db, orgControlResultsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  NIST_800_171_R2_REQUIREMENT_COUNT,
  NIST_800_171_R2_TOTAL_WEIGHT,
  NIST_800_171_R2_WEIGHTS,
  getResolvedMappings,
} from "../../lib/framework-mappings";
import { normaliseStatus } from "../../lib/posture";

/**
 * SPRS scoring for SP 800-171, under the DoD Assessment Methodology.
 *
 * WHAT CHANGED IN PHASE 1B
 *
 * This service used to carry its own 24-entry UCO_TO_NIST_MAP and its own copy
 * of the 110 requirement weights. That map was the second of three answers to
 * "which requirements does this objective satisfy" and it disagreed with the
 * uco_framework_mappings table, which knew about 10 objectives where this file
 * knew about 24. Both numbers were shown to the same user on the same day.
 *
 * Both are gone. Mappings now come from getResolvedMappings, which reads the
 * one table, and the weights live in lib/framework-mappings.ts so the scorer,
 * the migration and the CI guard share one copy.
 *
 * THREE BEHAVIOURAL CHANGES, EACH DELIBERATE
 *
 * 1. Coverage. The table now holds the union of what both sources knew, 25
 *    objectives rather than 24, because the catalog knew about UCO-RM-001 and
 *    the hardcoded map did not. Any requirement that objective maps to now
 *    participates in the score, so the score can move on deploy. That is the
 *    coverage gap closing, not a scoring change.
 *
 * 2. Warning is not met. The old code assigned "met" on passing and "not_met"
 *    on failing and left everything else at "not_reviewed", so a warning - a
 *    control somebody has assessed and found partially implemented - was
 *    reported as never reviewed. The DoD methodology has no partial credit: a
 *    requirement is met or it is not. Warning therefore counts as not met.
 *    This moves counts, not the score, because the score only ever adds for
 *    met.
 *
 * 3. Worst status wins. Several objectives can map to one requirement. The old
 *    loop let whichever mapping it happened to visit last decide, so the same
 *    data could score differently depending on row order. Now a single failing
 *    or warning objective is enough to leave the requirement not met, which is
 *    both deterministic and the conservative reading an assessor would take.
 *
 * A DEFECT THIS PHASE DOES NOT TOUCH, ON PURPOSE
 *
 * The score starts at the floor and adds the weight of every met requirement.
 * The weights in this product sum to 252, so a perfect assessment reaches
 * -203 + 252, which is 49, and then gets clamped at a ceiling of 110 it can
 * never reach. The published methodology works the other way round: begin at
 * 110 and subtract the weight of everything not met.
 *
 * Fixing that is a change to a compliance score's formula and it does not
 * belong inside a mapping consolidation, so it is surfaced rather than
 * silently corrected: see the scoringBasis block on the response, which
 * reports the reachable maximum next to the advertised one. Deciding what the
 * weights should be is a control-content decision, not an inference to make
 * from inside a refactor.
 */

const FRAMEWORK = "nist-800-171";
const SPRS_FLOOR = -203;
const SPRS_CEILING = 110;

type RequirementStatus = "met" | "not_met" | "not_reviewed";

@Injectable()
export class SprsService {
  async calculate(orgId: number) {
    const [controlResults, mappings] = await Promise.all([
      db.query.orgControlResultsTable.findMany({
        where: eq(orgControlResultsTable.orgId, orgId),
      }),
      getResolvedMappings(FRAMEWORK),
    ]);

    // One status per objective, through the same normaliser the posture SSOT
    // uses. Sharing the border means "warning" cannot mean one thing here and
    // another thing on the dashboard, which is how the five-way discrepancy
    // started.
    const statusByObjective = new Map<string, string>();
    for (const result of controlResults) {
      statusByObjective.set(
        result.ucoControlId,
        normaliseStatus((result as { status?: unknown }).status).status,
      );
    }

    const nistScores: Record<string, { weight: number; status: RequirementStatus }> = {};
    for (const [requirementId, weight] of Object.entries(NIST_800_171_R2_WEIGHTS)) {
      nistScores[requirementId] = { weight, status: "not_reviewed" };
    }

    const objectivesMapped = new Set<string>();
    const requirementsMapped = new Set<string>();
    const unresolvableMappings: string[] = [];

    for (const mapping of mappings) {
      const requirement = nistScores[mapping.scoringControlId];

      if (!requirement) {
        // A mapping row pointing at a requirement this methodology does not
        // score. Collected and reported rather than dropped, because silently
        // ignoring it is how a mapping becomes permanently unscoreable without
        // anybody noticing. CI fails the build on a non-empty list.
        unresolvableMappings.push(mapping.ucoControlId + ":" + mapping.frameworkControlId);
        continue;
      }

      objectivesMapped.add(mapping.ucoControlId);
      requirementsMapped.add(mapping.scoringControlId);

      const status = statusByObjective.get(mapping.ucoControlId);
      if (!status || status === "not_tested") continue;

      if (status === "failing" || status === "warning") {
        // Sticky. Once one mapped objective is short of the requirement, no
        // other objective can talk it back up to met.
        requirement.status = "not_met";
      } else if (status === "passing" && requirement.status !== "not_met") {
        requirement.status = "met";
      }
    }

    const requirements = Object.values(nistScores);

    let score = SPRS_FLOOR;
    for (const requirement of requirements) {
      if (requirement.status === "met") score += requirement.weight;
    }
    score = Math.min(SPRS_CEILING, score);

    const met = requirements.filter((r) => r.status === "met").length;
    const notMet = requirements.filter((r) => r.status === "not_met").length;
    const notReviewed = requirements.filter((r) => r.status === "not_reviewed").length;
    const totalControls = NIST_800_171_R2_REQUIREMENT_COUNT;

    return {
      score,
      maxScore: SPRS_CEILING,
      minScore: SPRS_FLOOR,
      met,
      notMet,
      notReviewed,
      totalControls,
      percentComplete: Math.round((met / totalControls) * 100),
      readinessLevel:
        score >= 80 ? "high" : score >= 0 ? "medium" : score >= -60 ? "low" : "critical",
      nistScores,
      industryAverage: -12,
      topGaps: Object.entries(nistScores)
        .filter(([, s]) => s.status === "not_met")
        .sort(([, a], [, b]) => b.weight - a.weight)
        .slice(0, 10)
        .map(([nist, s]) => ({ nistId: nist, weight: s.weight })),
      /**
       * Everything a reader needs to know what this number is and is not.
       * Added in Phase 1b because the page previously showed a score with no
       * statement of which revision it scored, how much of the framework was
       * mapped at all, or that its advertised maximum is unreachable.
       */
      scoringBasis: {
        methodology: "DoD Assessment Methodology",
        basedOn: "NIST SP 800-171 Rev 2",
        requirementCount: totalControls,
        mappingSource: "uco_framework_mappings",
        objectivesMapped: objectivesMapped.size,
        requirementsMapped: requirementsMapped.size,
        requirementsUnmapped: totalControls - requirementsMapped.size,
        advertisedMaximum: SPRS_CEILING,
        reachableMaximum: Math.min(SPRS_CEILING, SPRS_FLOOR + NIST_800_171_R2_TOTAL_WEIGHT),
        totalWeight: NIST_800_171_R2_TOTAL_WEIGHT,
        formulaNote:
          "Score accumulates upward from the floor. The configured weights sum " +
          "to less than the floor-to-ceiling span, so the advertised maximum of " +
          "110 is not reachable with the current weight set. Reported rather " +
          "than adjusted: changing it is a control-content decision.",
        warningTreatment:
          "A warning counts as not met. The methodology has no partial credit.",
        unresolvableMappings,
      },
    };
  }
}
