/**
 * Phase 1b regression guard.
 *
 * Re-runs the measurements that defined the defect rather than checking that
 * the code looks right. Every assertion below corresponds to a numbered
 * acceptance criterion in docs/phase1b/DOR-mapping-consolidation.md, and every
 * one of them failed before this phase.
 *
 * Run against the fresh database CI stands up, after the server has booted at
 * least once so the migration and the cache refresh have both happened.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, orgFrameworksTable, ucoFrameworkMappingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  NIST_800_171_R2_REQUIREMENT_COUNT,
  NIST_800_171_R2_TOTAL_WEIGHT,
  findUnresolvableMappings,
  getResolvedMappings,
  normaliseScoringId,
  padScoringId,
} from "../src/lib/framework-mappings";
import {
  catalogInconsistencies,
  computePosture,
  coverageWarnings,
  diffPosture,
  legacyArithmeticNotes,
  syncStoredFrameworkPosture,
} from "../src/lib/posture";

const FRAMEWORK = "nist-800-171";

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n        " + detail);
  }
}

async function main() {
  console.log("Phase 1b: mapping consolidation regression guard");

  // ── Criterion 3: no source-level mapping table survives ──────────────────
  //
  // A string search, because the failure mode is somebody helpfully
  // reintroducing a local lookup rather than changing behaviour at runtime.
  // The whole point of the phase is that there is one place, so this is the
  // assertion that keeps it one place.
  const sprsSource = readFileSync(
    join(process.cwd(), "src/modules/sprs/sprs.service.ts"),
    "utf-8",
  );

  check(
    "sprs.service.ts carries no hardcoded objective-to-requirement map",
    !/(const|let|var)\s+UCO_TO_NIST_MAP/.test(sprsSource),
    "A UCO_TO_NIST_MAP declaration is back in sprs.service.ts. Mappings belong in uco_framework_mappings. (Prose references to the retired name are fine; a declaration is not.)",
  );

  check(
    "sprs.service.ts does not redeclare the requirement weights",
    !/const NIST_800_171_WEIGHTS/.test(sprsSource),
    "The weight table has been copied back into the service. It lives in lib/framework-mappings.ts.",
  );

  // The weighted set is control content. If it changes, that is a deliberate
  // decision and this test should be updated in the same commit - which is
  // exactly why it is pinned here.
  check(
    "the Rev 2 weighted set is still 110 requirements totalling 252",
    NIST_800_171_R2_REQUIREMENT_COUNT === 110 && NIST_800_171_R2_TOTAL_WEIGHT === 252,
    "Expected 110 requirements and total weight 252, got " +
      NIST_800_171_R2_REQUIREMENT_COUNT + " and " + NIST_800_171_R2_TOTAL_WEIGHT + ".",
  );

  // ── The notation bridge, on the cases that motivated it ──────────────────
  const notationCases: Array<[string, string]> = [
    ["03.05.03", "3.5.3"],
    ["03.01.01", "3.1.1"],
    ["03.13.11", "3.13.11"],
    ["03.13.08", "3.13.8"],
    ["3.5.3", "3.5.3"],
  ];

  for (const [stored, expected] of notationCases) {
    check(
      "normaliseScoringId(" + stored + ") is " + expected,
      normaliseScoringId(stored) === expected,
      "Got " + normaliseScoringId(stored) + ".",
    );
  }

  check(
    "padScoringId round-trips through normaliseScoringId",
    ["3.5.4", "3.13.11", "3.1.22", "3.11.1"].every(
      (id) => normaliseScoringId(padScoringId(id)) === id,
    ),
    "Padding then de-padding did not return the original identifier.",
  );

  // ── Criterion 6: every scored mapping resolves ───────────────────────────
  //
  // The consolidation was only safe because the two notations differed by
  // padding alone. Nothing makes that true forever, so it is asserted rather
  // than assumed: a Rev 3 requirement with no Rev 2 counterpart would score as
  // permanently unmet and this is the only thing that would say so.
  const unresolvable = await findUnresolvableMappings();
  check(
    "every mapping row for a scored framework resolves into its scoring set",
    unresolvable.length === 0,
    unresolvable.length + " row(s) do not resolve: " +
      unresolvable.map((u) => u.ucoControlId + "/" + u.frameworkControlId).join(", "),
  );

  // ── The relocation actually happened, and did not duplicate ──────────────
  const mappings = await getResolvedMappings(FRAMEWORK);
  const objectives = new Set(mappings.map((m) => m.ucoControlId));

  check(
    "800-171 covers more than the ten objectives the table started with",
    objectives.size > 10,
    "Only " + objectives.size + " objectives are mapped, so the relocation did not run.",
  );

  const pairKeys = mappings.map((m) => m.ucoControlId + "|" + m.scoringControlId);
  check(
    "no objective/requirement pair appears twice in two notations",
    new Set(pairKeys).size === pairKeys.length,
    "Duplicate pairs present. Presence must be keyed on the normalised " +
      "identifier, not the stored notation, or consolidation becomes duplication.",
  );

  const rows = await db.query.ucoFrameworkMappingsTable.findMany({
    where: eq(ucoFrameworkMappingsTable.frameworkKey, FRAMEWORK),
  });
  const withScoringId = rows.filter(
    (row) => (row as { scoringControlId?: string | null }).scoringControlId,
  ).length;

  check(
    "every 800-171 mapping row has a scoring identifier",
    withScoringId === rows.length,
    (rows.length - withScoringId) + " row(s) have no scoring_control_id, so the backfill is incomplete.",
  );

  // ── Criteria 1 and 5: the SSOT and the stored columns agree ──────────────
  //
  // This is the exit criterion, re-measured rather than eyeballed. Thirteen
  // items diverged in shadow mode; nine of them were these columns.
  // ── The fixture the exit criterion needs ────────────────────────────────
  //
  // On a blank database org 1 has no org_frameworks rows at all, and with no
  // rows the stored-column assertion below has nothing to compare and passes
  // by being empty. A guard that passes because it measured nothing is the
  // exact failure mode this phase exists to retire, so the row is created here
  // and created wrong on purpose: zeroed stored columns, which is the state the
  // measured organisation was actually found in.
  //
  // Only on an otherwise empty set. A real database has these rows already, so
  // this writes nothing outside CI.
  const existingFrameworks = await db
    .select()
    .from(orgFrameworksTable)
    .where(eq(orgFrameworksTable.orgId, 1));

  if (existingFrameworks.length === 0) {
    // Mirrors the catalog entry, including the label and the count that
    // disagree with each other, so the inconsistency is exercised rather than
    // invented.
    await db.insert(orgFrameworksTable).values({
      orgId: 1,
      frameworkKey: FRAMEWORK,
      name: "NIST SP 800-171 Rev 3",
      shortName: "NIST 800-171",
      category: "federal",
      active: true,
      complianceScore: 0,
      totalControls: 110,
      passingControls: 0,
      failingControls: 0,
      notTestedControls: 0,
    });

    console.log("  setup created a zeroed org_frameworks row for org 1/" + FRAMEWORK);
  }

  const frameworkRows = await db
    .select()
    .from(orgFrameworksTable)
    .where(and(eq(orgFrameworksTable.orgId, 1), eq(orgFrameworksTable.frameworkKey, FRAMEWORK)));

  check(
    "org 1 has a framework to measure, so the assertions below are not empty",
    frameworkRows.length > 0,
    "No org_frameworks row for " + FRAMEWORK + ", so every stored-column and " +
      "coverage assertion in this file would pass without measuring anything.",
  );

  const orgIds = [1];

  for (const orgId of orgIds) {
    await syncStoredFrameworkPosture(orgId);
    const posture = await computePosture(orgId);
    const divergences = diffPosture(posture);

    check(
      "org " + orgId + ": SSOT and stored framework columns agree",
      divergences.length === 0,
      divergences.length + " divergence(s): " +
        divergences.map((d) => d.surface + "." + d.field + " " + d.legacy + " vs " + d.ssot).join("; "),
    );

    // Criterion 4, on the object every surface now reads: nothing derived by
    // subtraction, and warning is its own bucket rather than folded away.
    const counts = posture.counts;
    check(
      "org " + orgId + ": counts add up without subtraction",
      counts.passing + counts.warning + counts.failing + counts.notTested === counts.total,
      JSON.stringify(counts) + " does not sum to total.",
    );

    check(
      "org " + orgId + ": assessed excludes untested",
      counts.assessed === counts.passing + counts.warning + counts.failing,
      JSON.stringify(counts) + " has an assessed figure that is not the sum of the assessed buckets.",
    );
  }

  // ── The four separately reported items ──────────────────────────────────
  //
  // A divergence count of zero is only honest if the groups that can never be
  // zero stay visible. Both of these functions existed, were exported, and
  // nothing called them, which for a consumer is the same as absent. So this
  // asserts they are wired into a response rather than merely available.
  const controllerSource = readFileSync(
    join(process.cwd(), "src/modules/posture/posture.controller.ts"),
    "utf-8",
  );

  for (const group of [
    "legacyArithmeticNotes(posture)",
    "coverageWarnings(posture)",
    "catalogInconsistencies(posture)",
  ]) {
    check(
      "the drift response calls " + group,
      controllerSource.includes(group),
      group + " is exported but nothing serves it, so that group is invisible.",
    );
  }

  check(
    "the response says a zero divergence count is not thirteen defects fixed",
    controllerSource.includes("separatelyReported") &&
      /defectsRemediated:\s*9/.test(controllerSource) &&
      /nonDefectItems:\s*4/.test(controllerSource),
    "separatelyReported must state that nine of the thirteen headline items " +
      "were defects and four were not, in the payload and not only in a report.",
  );

  check(
    "the posture response carries the coverage limitation",
    /return \{\s*posture,/.test(controllerSource) &&
      controllerSource.includes("coverageWarnings: coverageWarnings(posture)"),
    "GET /orgs/:orgId/posture must report coverage, or a thin mapping reads as " +
      "poor compliance.",
  );

  const livePosture = await computePosture(1);

  check(
    "coverage is reported as partial rather than as a complete assessment",
    coverageWarnings(livePosture).length > 0 &&
      livePosture.frameworks.some((framework) => framework.partialCoverage),
    "No framework is reported as partially covered, which claims the mappings " +
      "reach every published control. They do not.",
  );

  check(
    "the retired legacy arithmetic is still computed and still out of the count",
    Array.isArray(legacyArithmeticNotes(livePosture)) &&
      livePosture.legacyDashboard !== undefined &&
      diffPosture(livePosture).length === 0,
    "The legacy dashboard difference belongs in its own group: permanent, " +
      "unserved, not a fault. It must not sit inside the number that has to be " +
      "zero, and it must not disappear either.",
  );

  // ── The two control-content defects: surfaced, not corrected ────────────
  //
  // Pinned deliberately. Correcting either is a decision about what the
  // product claims to assess, not a refactor, so a commit that changes the
  // answer should change this guard too and say why.
  const catalogSource = readFileSync(
    join(process.cwd(), "src/modules/frameworks/frameworks.service.ts"),
    "utf-8",
  );
  const postureSource = readFileSync(
    join(process.cwd(), "src/lib/posture.ts"),
    "utf-8",
  );

  check(
    "the catalog still labels 800-171 Rev 3 over a control count of 110",
    catalogSource.includes('name: "NIST SP 800-171 Rev 3"') &&
      /key: "nist-800-171"[^}]*controlCount: 110/.test(catalogSource),
    "The catalog entry changed. If the label or the count was corrected on " +
      "authority, update this guard in the same commit.",
  );

  check(
    "the scored revision is recorded as Rev 2, which is what disagrees with it",
    /"nist-800-171":\s*\{\s*revision: "Rev 2"/.test(postureSource),
    "posture.ts must record which revision the scoring set belongs to, or the " +
      "inconsistency cannot be reported from data.",
  );

  const nistPosture = livePosture.frameworks.find(
    (framework) => framework.frameworkKey === FRAMEWORK,
  );

  if (nistPosture) {
    const nistFinding = catalogInconsistencies(livePosture).find(
      (finding) => finding.frameworkKey === FRAMEWORK,
    );

    check(
      "the 800-171 revision inconsistency reaches the API",
      nistFinding !== undefined &&
        nistFinding.declaredRevision === "Rev 3" &&
        nistFinding.declaredControlCount === 110 &&
        nistFinding.scoringRevision === "Rev 2",
      "Expected a finding recording a Rev 3 label over the Rev 2 count of 110, " +
        "got " + JSON.stringify(nistFinding ?? null) + ".",
    );
  } else {
    console.log(
      "  note  org 1 has no 800-171 framework row; the catalog assertions above " +
        "still cover the inconsistency.",
    );
  }

  check(
    "the SPRS floor and ceiling are unchanged",
    /const SPRS_FLOOR = -203;/.test(sprsSource) &&
      /const SPRS_CEILING = 110;/.test(sprsSource),
    "The score model moved. It was left alone on purpose: making 110 reachable " +
      "is a methodology decision, not a refactor.",
  );

  check(
    "scoringBasis reports the advertised maximum and the reachable one",
    /advertisedMaximum:\s*SPRS_CEILING/.test(sprsSource) &&
      sprsSource.includes("reachableMaximum") &&
      sprsSource.includes("totalWeight"),
    "A consumer must not be able to read 110 as achievable.",
  );

  check(
    "the reachable maximum is 49, which is the number the API reports",
    -203 + NIST_800_171_R2_TOTAL_WEIGHT === 49,
    "Floor plus total weight is " + (-203 + NIST_800_171_R2_TOTAL_WEIGHT) +
      ", so the surfaced defect needs restating.",
  );

  // ── The score basis, so 20 to 3 cannot read as a collapse ───────────────
  const dashboardSource = readFileSync(
    join(process.cwd(), "src/modules/orgs/orgs.service.ts"),
    "utf-8",
  );

  for (const field of [
    "scoreBasis:",
    "previousDenominator:",
    "objectivesAssessed:",
    "assessedScorePercent:",
    "coveragePercent:",
  ]) {
    check(
      "the dashboard response explains its score basis: " + field,
      dashboardSource.includes(field),
      "scoreBasis must name both denominators, or the drop from 20 to 3 reads " +
        "as a regression instead of a changed question.",
    );
  }

  check(
    "the dashboard reads the SSOT rather than counting rows again",
    dashboardSource.includes("computePosture(orgId)") &&
      dashboardSource.includes("posture.counts.notTested"),
    "The dashboard must take its counts from the SSOT.",
  );

  // ── Deferred work is still deferred, and still honestly labelled ────────
  //
  // Two items were left out of this phase on purpose. Whichever commit ships
  // one of them should update this guard, because until then the completion
  // record says they are outstanding and that has to stay true.
  const driftSource = readFileSync(
    join(process.cwd(), "src/lib/posture-drift.ts"),
    "utf-8",
  );

  check(
    "the drift ledger is still process memory, not a persisted table",
    !driftSource.includes("@workspace/db"),
    "posture-drift.ts now touches the database, so drift-ledger persistence is " +
      "no longer deferred and the completion record must stop saying it is.",
  );

  // The FISMA pass-through shipped in Phase 1c, so this guard no longer asserts
  // that it is absent. Its own assertions live in scripts/fisma-pass-through.test.ts;
  // what is checked here is only that it did not arrive as a re-authored control
  // set, which is the thing this phase existed to prevent.
  check(
    "FISMA arrived as a pass-through, not as a second control set",
    catalogSource.includes('key: "fisma"') &&
      !/frameworkKey: "fisma"/.test(catalogSource),
    "FISMA must borrow the 800-53 mappings through FRAMEWORK_PASS_THROUGHS. " +
      "Mapping rows written under a fisma key would be a second source of truth " +
      "for the same requirements.",
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\nAll mapping consolidation checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
