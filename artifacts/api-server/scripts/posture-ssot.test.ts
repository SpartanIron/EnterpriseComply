/**
 * posture-ssot.test.ts
 *
 * CI regression guard for the Phase 1 posture single source of truth.
 *
 * Must run under SWC, and needs DATABASE_URL:
 *   node --import @swc-node/register/esm-register scripts/posture-ssot.test.ts
 *
 * This is deliberately not a test of "does the function return an object". It
 * rebuilds the exact defect that was measured on org 1 before Phase 1 started -
 * a control set where two objectives pass, three warn, one fails, most have no
 * result row at all, one row carries a status the code does not recognise, and
 * one points at a control that no longer exists - and then asserts the SSOT
 * reports all of it correctly while the legacy arithmetic still gets it wrong
 * in the specific ways that were diagnosed.
 *
 * If someone reintroduces derive-by-subtraction, or counts result rows instead
 * of control objectives, these assertions fail with the reason attached.
 *
 * Exit code 0 = all assertions passed, 1 = one or more failed.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { computePosture, diffLegacyDashboard, normaliseStatus } from "../src/lib/posture.js";

const FIXTURE_SLUG = "ci-posture-ssot-fixture";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? " - " + detail : ""}`);
  }
}

function equal(label: string, actual: unknown, expected: unknown) {
  check(label, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

function rows<T = Record<string, unknown>>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  return Array.isArray(r?.rows) ? r.rows : ((result as T[]) ?? []);
}

async function cleanup(orgId: number | null) {
  if (orgId === null) return;
  await db.execute(sql`DELETE FROM org_control_results WHERE org_id = ${orgId}`);
  await db.execute(sql`DELETE FROM org_frameworks WHERE org_id = ${orgId}`);
  await db.execute(sql`DELETE FROM org_risks WHERE org_id = ${orgId}`);
  await db.execute(sql`DELETE FROM org_risks_seeded WHERE org_id = ${orgId}`);
  await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
}

async function main() {
  console.log("posture SSOT regression guard");
  console.log("");

  // ── normaliseStatus, the border ────────────────────────────────────────────
  console.log("normaliseStatus");
  equal("passing is recognised", normaliseStatus("passing").status, "passing");
  equal("warning is recognised", normaliseStatus("warning").status, "warning");
  check("warning is not silently untested", normaliseStatus("warning").recognised === true);
  equal("mixed case folds", normaliseStatus("  Failing ").status, "failing");
  equal("absent means untested", normaliseStatus(null).status, "not_tested");
  check("absent is a recognised state", normaliseStatus(null).recognised === true);
  equal("unknown string scores as untested", normaliseStatus("in_progress").status, "not_tested");
  check(
    "unknown string is flagged rather than absorbed",
    normaliseStatus("in_progress").recognised === false,
  );
  console.log("");

  let orgId: number | null = null;

  try {
    // ── Fixture ───────────────────────────────────────────────────────────────
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${FIXTURE_SLUG}`);
    const created = rows<{ id: number }>(
      await db.execute(
        sql`INSERT INTO organizations (name, slug) VALUES ('CI Posture Fixture', ${FIXTURE_SLUG}) RETURNING id`,
      ),
    );
    orgId = Number(created[0].id);
    check("fixture org created", Number.isFinite(orgId) && orgId > 0);

    const controlIds = rows<{ control_id: string }>(
      await db.execute(sql`SELECT control_id FROM uco_controls ORDER BY control_id`),
    ).map((r) => r.control_id);

    const totalControls = controlIds.length;
    check("control objectives exist to score against", totalControls >= 8, `found ${totalControls}`);
    if (totalControls < 8) throw new Error("not enough uco_controls seeded to run this test");

    // Two passing, three warning, one failing. Everything else untested by
    // omission - which is the case the legacy dashboard cannot see at all.
    const assign: Array<[string, string]> = [
      [controlIds[0], "passing"],
      [controlIds[1], "passing"],
      [controlIds[2], "warning"],
      [controlIds[3], "warning"],
      [controlIds[4], "warning"],
      [controlIds[5], "failing"],
      // A status no consumer knows how to score. This is the raw-enum class of
      // defect: it must be reported, not folded into untested in silence.
      [controlIds[6], "in_progress"],
    ];

    for (const [controlId, status] of assign) {
      await db.execute(
        sql`INSERT INTO org_control_results (org_id, uco_control_id, status)
            VALUES (${orgId}, ${controlId}, ${status})`,
      );
    }

    // A result pointing at an objective that does not exist. It must not be
    // able to inflate any count.
    await db.execute(
      sql`INSERT INTO org_control_results (org_id, uco_control_id, status)
          VALUES (${orgId}, 'UCO-DOES-NOT-EXIST', 'passing')`,
    );

    const posture = await computePosture(orgId);

    // ── The buckets ──────────────────────────────────────────────────────────
    console.log("counts over every control objective");
    equal("passing", posture.counts.passing, 2);
    equal("warning", posture.counts.warning, 3);
    equal("failing", posture.counts.failing, 1);
    equal("total is the objective count, not the result-row count", posture.counts.total, totalControls);
    equal("assessed", posture.counts.assessed, 6);
    equal(
      "notTested covers every objective without a usable result",
      posture.counts.notTested,
      totalControls - 6,
    );
    check(
      "buckets sum to the total",
      posture.counts.passing +
        posture.counts.warning +
        posture.counts.failing +
        posture.counts.notTested ===
        posture.counts.total,
    );
    equal("orphaned result is excluded", posture.orphanedResults, 1);
    equal(
      "unrecognised status is reported",
      posture.unrecognisedStatuses["in_progress"],
      1,
    );
    console.log("");

    // ── The ratios ───────────────────────────────────────────────────────────
    console.log("named ratios");
    equal(
      "scorePercent divides by every objective",
      posture.scorePercent,
      Math.round((2 / totalControls) * 100),
    );
    equal("assessedScorePercent divides by what was assessed", posture.assessedScorePercent, 33);
    equal(
      "coveragePercent is assessed over total",
      posture.coveragePercent,
      Math.round((6 / totalControls) * 100),
    );
    console.log("");

    // ── The legacy arithmetic, reproduced and diffed ──────────────────────────
    console.log("legacy arithmetic and drift");
    equal("legacy counts result rows", posture.legacyDashboard.total, 8);
    equal("legacy passing", posture.legacyDashboard.passing, 3);
    equal("legacy failing", posture.legacyDashboard.failing, 1);
    // 8 - 3 - 1 = 4: three warnings plus the unrecognised row, all reported as
    // untested by subtraction. This is the original defect, asserted, not
    // described.
    equal("legacy notTested absorbs warnings by subtraction", posture.legacyDashboard.notTested, 4);
    check(
      "legacy notTested disagrees with the SSOT",
      posture.legacyDashboard.notTested !== posture.counts.notTested,
    );
    equal("legacy overallScore is inflated by its denominator", posture.legacyDashboard.overallScore, 38);
    check(
      "legacy score is higher than the honest score",
      posture.legacyDashboard.overallScore > posture.scorePercent,
    );

    const divergences = diffLegacyDashboard(posture);
    const fields = divergences.map((d) => d.field);
    check("drift report names the total", fields.includes("total"));
    check("drift report names notTested", fields.includes("notTested"));
    check("drift report names overallScore", fields.includes("overallScore"));
    check("drift report names the missing warning bucket", fields.includes("warning"));
    check(
      "every divergence carries a cause, not just a delta",
      divergences.length > 0 && divergences.every((d) => typeof d.cause === "string" && d.cause.length > 20),
    );
    console.log("");
  } finally {
    await cleanup(orgId);
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("posture SSOT regression guard crashed:", err);
    process.exit(1);
  });
