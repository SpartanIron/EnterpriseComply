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
import { db, ucoFrameworkMappingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  NIST_800_171_R2_REQUIREMENT_COUNT,
  NIST_800_171_R2_TOTAL_WEIGHT,
  findUnresolvableMappings,
  getResolvedMappings,
  normaliseScoringId,
  padScoringId,
} from "../src/lib/framework-mappings";
import { computePosture, diffPosture, syncStoredFrameworkPosture } from "../src/lib/posture";

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
