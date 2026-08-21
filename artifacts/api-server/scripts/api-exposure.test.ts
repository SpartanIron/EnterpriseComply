/**
 * Phase 1c regression guard: API exposure and trend integrity.
 *
 * Re-runs the two measurements that defined the defects rather than checking
 * that the code looks right.
 *
 * 1. /orgs/:orgId/monitoring returned org_integrations rows with accessToken,
 *    refreshToken and the credential half of config still on them. Measured on
 *    the live organisation: one populated accessToken, as ciphertext, in a
 *    response the browser reads.
 *
 * 2. /orgs/:orgId/score-history returned a generated ninety-day curve whenever
 *    the table was empty. Measured on the live organisation: thirty-one points,
 *    thirty of them with negative ids, scores between 17 and 23, and today's
 *    point reading 22 while the posture SSOT read 3.
 *
 * Run against the fresh database CI stands up, after the server has booted at
 * least once so the seed and the boot-time snapshot have both happened.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, complianceScoreHistoryTable, orgIntegrationsTable } from "@workspace/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { CIPHERTEXT_PREFIX, findCredentialLeaks } from "../src/lib/integration-redaction";
import { readScoreHistory, recordScoreSnapshot, utcDayBounds } from "../src/lib/score-history";
import { computePosture } from "../src/lib/posture";
import { MonitoringService } from "../src/modules/monitoring/monitoring.service";

const ORG = 1;
const FIXTURE_KEY = "credential-redaction-fixture";
/** Never a real credential. Assembled from the exported prefix so no literal
 *  ciphertext string sits in the repository for a scanner to flag. */
const FIXTURE_SECRET = CIPHERTEXT_PREFIX + "fixture-not-a-real-credential";

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
 * Strip comments before searching for code.
 *
 * The two assertions below look for the deleted generator's arithmetic, and its
 * replacement documents that arithmetic in a module comment so the next reader
 * knows what was removed and why. The first CI run failed on exactly that:
 * prose describing a deleted defect is not the defect. Comments are removed so
 * the search sees code.
 *
 * Naive by intent. It does not try to protect string literals containing
 * comment markers, and it is only ever pointed at these two files.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * A connected integration carrying credential material has to exist or the
 * redaction assertions pass by having nothing to redact. On a blank CI database
 * org 1 has no integrations at all, which is exactly how a guard like this
 * ends up green and worthless.
 */
async function ensureCredentialFixture(): Promise<void> {
  const existing = await db
    .select()
    .from(orgIntegrationsTable)
    .where(
      and(
        eq(orgIntegrationsTable.orgId, ORG),
        eq(orgIntegrationsTable.integrationKey, FIXTURE_KEY),
      ),
    );

  if (existing.length > 0) return;

  await db.insert(orgIntegrationsTable).values({
    orgId: ORG,
    integrationKey: FIXTURE_KEY,
    name: "Credential redaction fixture",
    status: "connected",
    accessToken: FIXTURE_SECRET,
    refreshToken: FIXTURE_SECRET,
    config: { apiToken: FIXTURE_SECRET, zoneId: "fixture-zone" },
  });
}

async function main() {
  console.log("Phase 1c: API exposure and trend integrity guard");

  // ── 1. The leak detector has to be able to detect ────────────────────────
  //
  // Asserted first and against a raw row, because every assertion below leans
  // on findCredentialLeaks. A detector that returns an empty array for
  // everything would make the whole file report success.
  const rawRow = {
    id: 1,
    accessToken: FIXTURE_SECRET,
    tokenExpiresAt: new Date(),
    config: { apiToken: FIXTURE_SECRET, zoneId: "fixture-zone" },
  };
  const rawLeaks = findCredentialLeaks(rawRow);
  check(
    "the detector finds credential material in an unredacted row",
    rawLeaks.length >= 2,
    "findCredentialLeaks returned " + rawLeaks.length + " finding(s) for a row " +
      "holding two credentials. The detector is broken, so every check below is " +
      "meaningless.",
  );
  check(
    "the detector does not flag tokenExpiresAt",
    !rawLeaks.some((l) => l.includes("tokenExpiresAt")),
    "A timestamp was reported as a credential. Substring matching on property " +
      "names trains people to ignore this check.",
  );

  // ── 2. The monitoring response carries no credential material ────────────
  await ensureCredentialFixture();

  const monitoring = new MonitoringService();
  const response = await monitoring.getMonitoringJobs(ORG);
  const jobs = response.monitoringJobs as Array<Record<string, unknown>>;
  const fixture = jobs.find((j) => j.integrationKey === FIXTURE_KEY);

  check(
    "the fixture reaches the monitoring response",
    fixture !== undefined,
    "The connected fixture integration is missing from getMonitoringJobs, so " +
      "there is nothing to assert about. jobs=" + jobs.length,
  );

  const leaks = findCredentialLeaks(response);
  check(
    "the monitoring response carries no credential material",
    leaks.length === 0,
    "Credential material found at: " + leaks.join(", "),
  );

  check(
    "redaction reports that a credential is on file",
    fixture?.hasStoredCredentials === true,
    "hasStoredCredentials must stay true. Removing the value without saying a " +
      "value exists breaks every caller that shows connection state.",
  );

  const fixtureConfig = (fixture?.config ?? {}) as Record<string, unknown>;
  check(
    "redaction keeps the non-credential config",
    fixtureConfig.zoneId === "fixture-zone" && fixtureConfig.apiToken === undefined,
    "Redaction must remove credential keys and leave the rest. config=" +
      JSON.stringify(fixtureConfig),
  );

  check(
    "the monitoring service no longer spreads integration rows raw",
    (() => {
      const source = codeOnly(readSource("src/modules/monitoring/monitoring.service.ts"));
      return source.includes("redactConnectionCredentials(") && !/\.\.\.i,/.test(source);
    })(),
    "getMonitoringJobs must not spread an org_integrations row into its " +
      "response. That is the exact shape of the original defect.",
  );

  // ── 3. The trend is recorded, not generated ──────────────────────────────
  const serviceSource = codeOnly(readSource("src/modules/score-history/score-history.service.ts"));
  const libSource = codeOnly(readSource("src/lib/score-history.ts"));

  check(
    "no random number generator is involved in the trend",
    !serviceSource.includes("Math.random") && !libSource.includes("Math.random"),
    "The score history path calls Math.random. The generated curve is back.",
  );
  check(
    "the trend has no synthetic floor",
    !libSource.includes("currentScore - 35") && !serviceSource.includes("currentScore - 35"),
    "The old generator started at Math.max(currentScore - 35, 20). Any floor " +
      "like it invents history.",
  );

  const history = await readScoreHistory(ORG);
  check(
    "the history declares itself measured rather than synthetic",
    history.basis.synthetic === false && history.basis.source === "compliance_score_history",
    "basis=" + JSON.stringify(history.basis),
  );
  check(
    "every point is a stored row, not a generated one",
    history.history.every((p) => typeof p.id === "number" && p.id > 0),
    "The generator gave its points negative ids. Any id at or below zero means " +
      "something is fabricating points again. ids=" +
      history.history.map((p) => p.id).join(","),
  );

  // ── 4. The trend and the dashboard header cannot disagree ────────────────
  await recordScoreSnapshot(ORG);
  const posture = await computePosture(ORG);
  const afterFirst = await readScoreHistory(ORG);
  const latest = afterFirst.history[afterFirst.history.length - 1];

  check(
    "the recorded point equals the SSOT score the header shows",
    latest !== undefined && Number(latest.overallScore) === posture.scorePercent,
    "recorded=" + String(latest?.overallScore) + " ssot=" + posture.scorePercent +
      ". This is the assertion that failed before the phase: the trend read 22 " +
      "while the SSOT read 3.",
  );
  check(
    "the recorded passing count equals the SSOT passing count",
    latest !== undefined && latest.passingControls === posture.counts.passing,
    "recorded=" + String(latest?.passingControls) + " ssot=" + posture.counts.passing,
  );

  // ── 5. One point per UTC day, however many times the server boots ────────
  await recordScoreSnapshot(ORG);
  await recordScoreSnapshot(ORG);

  const { start, next } = utcDayBounds(new Date());
  const todaysPoints = await db
    .select()
    .from(complianceScoreHistoryTable)
    .where(
      and(
        eq(complianceScoreHistoryTable.orgId, ORG),
        gte(complianceScoreHistoryTable.recordedAt, start),
        lt(complianceScoreHistoryTable.recordedAt, next),
      ),
    );

  check(
    "three snapshots on one day leave one point",
    todaysPoints.length === 1,
    "Found " + todaysPoints.length + " points for today. The snapshot runs at " +
      "boot and every deploy restarts the service, so a per-boot insert turns " +
      "the chart into a deployment log.",
  );

  // ── 6. An empty series says so instead of inventing one ──────────────────
  const emptyOrg = 987654;
  const empty = await readScoreHistory(emptyOrg);
  check(
    "an organisation with no history gets an empty series and an explanation",
    empty.history.length === 0 &&
      empty.basis.points === 0 &&
      empty.basis.synthetic === false &&
      empty.basis.note.length > 0,
    "An org with no recorded points must get [] and a note saying why, not a " +
      "generated curve. basis=" + JSON.stringify(empty.basis),
  );

  // ── 7. The front end no longer hides the panel silently ─────────────────
  const dashboardSource = readFileSync(
    join(process.cwd(), "../c2s-ciop/src/pages/Dashboard.tsx"),
    "utf-8",
  );
  check(
    "the dashboard renders an explanation when there is no trend yet",
    dashboardSource.includes("No recorded history yet") &&
      dashboardSource.includes("basis?.note"),
    "The empty branch must explain itself rather than returning null.",
  );
  check(
    "the dashboard no longer claims a ninety-day window",
    !dashboardSource.includes("90-day history") && !dashboardSource.includes("pts over 90d"),
    "The header labelled every series as ninety days of history regardless of " +
      "what was recorded.",
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\nAll API exposure and trend integrity checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
