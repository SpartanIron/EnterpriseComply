/**
 * Phase 1c regression guard: the surfaces that render posture.
 *
 * The API has been serving four control statuses, a scoreBasis block, two
 * coverage warnings and one catalog inconsistency since the Phase 1 cutover.
 * Measured on production before this change:
 *
 *   - the dashboard KPI row rendered Passing, Failing and Not Tested. Five
 *     controls held status "warning" and appeared in no header figure.
 *   - the controls page tallied its own counts in the browser with the same
 *     three buckets and had no Warning filter tab, so those five controls could
 *     not be listed on their own.
 *   - scoreBasis was rendered nowhere, so the headline fell from 20 to 3 with
 *     nothing on screen saying the denominator had changed.
 *   - the coverage warnings and the revision mismatch were visible only to
 *     somebody reading JSON.
 *
 * Serving a number nobody renders is the same as not having it, so these
 * assertions cover both halves: the API carries the counts, and the pages read
 * them.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, organizationsTable, orgControlResultsTable, ucoControlsTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { computePosture, diffPosture, syncStoredFrameworkPosture } from "../src/lib/posture";
import { ControlsService } from "../src/modules/controls/controls.service";
import { OrgsService } from "../src/modules/orgs/orgs.service";

/**
 * Preferred organisation id. Resolved against the database rather than assumed,
 * because a blank CI database is not guaranteed to hold an organisation with
 * id 1 - the first run of this guard failed on exactly that, having asserted
 * something about production that is not true of CI.
 */
const PREFERRED_ORG = 1;

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n        " + detail);
  }
}

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf-8");
}

/**
 * At least one control has to hold status "warning" or every warning assertion
 * below passes by having nothing to count. A blank CI database has no warning
 * results at all, which is how the bucket went missing without any test
 * noticing.
 */
async function ensureWarningFixture(ORG: number): Promise<string | null> {
  const existing = await db
    .select()
    .from(orgControlResultsTable)
    .where(and(eq(orgControlResultsTable.orgId, ORG), eq(orgControlResultsTable.status, "warning")));

  if (existing.length > 0) return existing[0].ucoControlId;

  const [control] = await db.select().from(ucoControlsTable).limit(1);
  if (!control) return null;

  const already = await db
    .select()
    .from(orgControlResultsTable)
    .where(
      and(
        eq(orgControlResultsTable.orgId, ORG),
        eq(orgControlResultsTable.ucoControlId, control.controlId),
      ),
    );

  if (already.length > 0) {
    await db
      .update(orgControlResultsTable)
      .set({ status: "warning" })
      .where(eq(orgControlResultsTable.id, already[0].id));
  } else {
    await db.insert(orgControlResultsTable).values({
      orgId: ORG,
      ucoControlId: control.controlId,
      status: "warning",
      result: "Fixture for the Phase 1c warning-bucket guard.",
    });
  }

  return control.controlId;
}

async function main() {
  console.log("Phase 1c: posture surfaces guard");

  const orgs = await db.select().from(organizationsTable).orderBy(asc(organizationsTable.id));
  const org = orgs.find((o) => o.id === PREFERRED_ORG) ?? orgs[0];
  check(
    "an organisation exists to assess",
    org !== undefined,
    "No rows in organizations, so there is nothing to build a dashboard for.",
  );
  if (!org) {
    console.error("\n1 check(s) failed.");
    process.exit(1);
  }
  const ORG = org.id;
  console.log("  info  asserting against org " + ORG);

  const warningControlId = await ensureWarningFixture(ORG);
  check(
    "a control in warning exists to be counted",
    warningControlId !== null,
    "No UCO controls in the database, so the warning bucket cannot be measured.",
  );

  // The fixture changed a control status, so the denormalised columns are now
  // one status behind. Production runs this sync on every patch and at boot;
  // running it here keeps the guard from leaving drift behind for whichever
  // step runs next, and asserting on it afterwards proves the fixture was
  // absorbed rather than merely tolerated.
  await syncStoredFrameworkPosture(ORG);

  const posture = await computePosture(ORG);
  check(
    "the SSOT reports at least one control in warning",
    posture.counts.warning > 0,
    "posture.counts.warning is " + posture.counts.warning + " after the fixture ran.",
  );
  check(
    "the fixture leaves no drift between the SSOT and the stored columns",
    diffPosture(posture).length === 0,
    "Divergences: " + JSON.stringify(diffPosture(posture)),
  );

  // ── The controls endpoint serves the counts ──────────────────────────────
  const controlsService = new ControlsService();
  const controlsResponse = await controlsService.getOrgControls(ORG);
  const summary = (controlsResponse as {
    summary?: { source: string; degraded: boolean; counts: Record<string, number> };
  }).summary;

  check(
    "the controls response carries a summary",
    summary !== undefined,
    "getOrgControls must serve the counts rather than leaving the page to tally them.",
  );
  check(
    "the summary comes from the SSOT, not a local tally",
    summary?.source === "posture-ssot" && summary?.degraded === false,
    "summary=" + JSON.stringify(summary),
  );
  check(
    "the summary counts warning separately",
    summary?.counts.warning === posture.counts.warning,
    "controls=" + String(summary?.counts.warning) + " ssot=" + posture.counts.warning,
  );
  check(
    "the four buckets add up to the total",
    summary !== undefined &&
      summary.counts.passing +
        summary.counts.warning +
        summary.counts.failing +
        summary.counts.notTested ===
        summary.counts.total,
    "The buckets must partition the control set. counts=" + JSON.stringify(summary?.counts),
  );

  // ── The dashboard endpoint agrees with the controls endpoint ─────────────
  const orgsService = new OrgsService();
  const dashboard = (await orgsService.getDashboard(ORG, org)) as {
    controlSummary?: Record<string, number>;
    scoreBasis?: Record<string, unknown>;
  };

  check(
    "the dashboard and the controls endpoint report the same warning count",
    dashboard.controlSummary?.warning === summary?.counts.warning,
    "dashboard=" + String(dashboard.controlSummary?.warning) +
      " controls=" + String(summary?.counts.warning) +
      ". Two endpoints reading one source of truth cannot disagree.",
  );
  check(
    "the dashboard still carries a score basis for the page to render",
    dashboard.scoreBasis !== undefined &&
      typeof dashboard.scoreBasis.note === "string" &&
      typeof dashboard.scoreBasis.denominator === "string",
    "scoreBasis=" + JSON.stringify(dashboard.scoreBasis),
  );

  // ── The pages render what the API serves ────────────────────────────────
  const controlsPage = readSource("../c2s-ciop/src/pages/Controls.tsx");
  const dashboardPage = readSource("../c2s-ciop/src/pages/Dashboard.tsx");

  check(
    "the controls page can filter for warning",
    controlsPage.includes('filter === "warning"') && controlsPage.includes('["warning", "Warning"'),
    "Without a filter tab the warning controls cannot be listed on their own.",
  );
  check(
    "the controls page shows a warning tile",
    controlsPage.includes('label: "Warning"') && controlsPage.includes("stats.warning"),
    "The header must count the bucket it renders badges for.",
  );
  check(
    "the controls page takes its counts from the response",
    controlsPage.includes("data?.summary"),
    "The page must render the served counts rather than deciding its own.",
  );
  check(
    "the dashboard shows a warning tile",
    dashboardPage.includes('label="Warning (Assigned)"') && dashboardPage.includes("cs.warning"),
    "The KPI row must include the warning bucket.",
  );
  check(
    "the dashboard renders the score basis",
    dashboardPage.includes("ScoreBasisPanel") && dashboardPage.includes("basis.note"),
    "scoreBasis exists so a reader can tell a changed denominator from a fallen score.",
  );
  check(
    "the dashboard renders the coverage and catalog findings",
    dashboardPage.includes("coverageWarnings") && dashboardPage.includes("catalogInconsistencies"),
    "Both were served and neither was on screen.",
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\nAll posture surface checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
