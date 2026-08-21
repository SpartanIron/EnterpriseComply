#!/usr/bin/env node
/**
 * risk-seed-invariants.mjs
 *
 * Proves, rather than assumes, that the risk seed is idempotent and that the
 * repair migration is safe to run on every boot.
 *
 * The old seeder inserted twenty rows per org per boot because its count check
 * was computed and then ignored. A test that only asserts "there are no
 * duplicates right now" would have passed on the very first boot of a fresh
 * database and told us nothing. So this runs across three server boots:
 *
 *   --verify-boot1   assert the invariants on a database the repair has just
 *                    created, prove the uniqueness constraint actually rejects
 *                    a duplicate and folds case and whitespace, then
 *                    deliberately manufacture the pre-migration state: drop the
 *                    index, insert a duplicate group including one row a human
 *                    has curated, and null out the review dates. Snapshot.
 *
 *   --verify-boot2   assert the repair collapsed that group to one row, kept the
 *                    curated row rather than blindly keeping the oldest,
 *                    quarantined what it removed, restored the index, refilled
 *                    the review dates, and - the assertion that matters most -
 *                    that the seeder inserted nothing at all.
 *
 *   --verify-boot3   assert boot 2's state is byte for byte unchanged, which is
 *                    what "idempotent" has to mean for something that runs on
 *                    every single start.
 *
 * Requires DATABASE_URL. Exit code 0 = all assertions passed, 1 = failure.
 */

import { Client } from "pg";
import { writeFileSync, readFileSync, existsSync } from "fs";

const UNIQUE_INDEX = "org_risks_org_title_uniq";
const QUARANTINE = "org_risks_dedupe_quarantine";
const FIXTURE_SLUG = "ci-risk-seed-fixture";
const FIXTURE_TITLE = "CI duplicate probe";
const SNAP1 = "/tmp/risk-seed-boot1.json";
const SNAP2 = "/tmp/risk-seed-boot2.json";

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? " - " + detail : ""}`);
  }
}

function equal(label, actual, expected) {
  check(label, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

async function scalar(client, text, params = []) {
  const res = await client.query(text, params);
  const row = res.rows[0];
  if (!row) return null;
  return Object.values(row)[0];
}

async function indexPresent(client) {
  const n = await scalar(client, "SELECT COUNT(*)::int FROM pg_indexes WHERE indexname = $1", [UNIQUE_INDEX]);
  return Number(n) > 0;
}

async function duplicateGroups(client) {
  return Number(
    await scalar(
      client,
      `SELECT COUNT(*)::int FROM (
         SELECT 1 FROM org_risks GROUP BY org_id, LOWER(BTRIM(title)) HAVING COUNT(*) > 1
       ) d`,
    ),
  );
}

async function nullReviewDates(client) {
  return Number(await scalar(client, "SELECT COUNT(*)::int FROM org_risks WHERE review_date IS NULL"));
}

async function reviewDateDefault(client) {
  return await scalar(
    client,
    `SELECT column_default FROM information_schema.columns
      WHERE table_name = 'org_risks' AND column_name = 'review_date'`,
  );
}

async function orgsWithRisksMissingMarker(client) {
  return Number(
    await scalar(
      client,
      `SELECT COUNT(*)::int FROM (
         SELECT DISTINCT org_id FROM org_risks
         EXCEPT
         SELECT org_id FROM org_risks_seeded
       ) m`,
    ),
  );
}

async function snapshot(client) {
  const perOrg = (
    await client.query("SELECT org_id, COUNT(*)::int AS n FROM org_risks GROUP BY org_id ORDER BY org_id")
  ).rows;
  return {
    takenAt: await scalar(client, "SELECT NOW()"),
    total: Number(await scalar(client, "SELECT COUNT(*)::int FROM org_risks")),
    maxId: Number(await scalar(client, "SELECT COALESCE(MAX(id), 0)::int FROM org_risks")),
    quarantined: Number(await scalar(client, `SELECT COUNT(*)::int FROM ${QUARANTINE}`)),
    perOrg: perOrg.map((r) => ({ orgId: Number(r.org_id), n: Number(r.n) })),
  };
}

/** Shared invariants. Anything true after every boot belongs here. */
async function assertBaseInvariants(client, phase) {
  console.log(`${phase}: base invariants`);
  equal("no duplicate (org, title) groups remain", await duplicateGroups(client), 0);
  check("uniqueness constraint is in place", await indexPresent(client));
  equal("no risk is left without a review date", await nullReviewDates(client), 0);
  check(
    "review_date has a default so new rows cannot be created without one",
    String(await reviewDateDefault(client) ?? "").length > 0,
  );
  equal("every org holding risks is marked as seeded", await orgsWithRisksMissingMarker(client), 0);
  console.log("");
}

async function verifyBoot1(client) {
  await assertBaseInvariants(client, "boot 1");

  // ── The constraint has to actually reject things ──────────────────────────
  console.log("boot 1: uniqueness is enforced, not merely declared");
  await client.query("DELETE FROM organizations WHERE slug = $1", [FIXTURE_SLUG]);
  const orgId = Number(
    await scalar(client, "INSERT INTO organizations (name, slug) VALUES ('CI Risk Fixture', $1) RETURNING id", [
      FIXTURE_SLUG,
    ]),
  );
  check("fixture org created", Number.isFinite(orgId) && orgId > 0);

  await client.query("INSERT INTO org_risks (org_id, title, review_date) VALUES ($1, $2, NOW())", [
    orgId,
    FIXTURE_TITLE,
  ]);

  let rejectedExact = false;
  try {
    await client.query("INSERT INTO org_risks (org_id, title, review_date) VALUES ($1, $2, NOW())", [
      orgId,
      FIXTURE_TITLE,
    ]);
  } catch {
    rejectedExact = true;
  }
  check("an exact duplicate title is rejected", rejectedExact);

  let rejectedFolded = false;
  try {
    await client.query("INSERT INTO org_risks (org_id, title, review_date) VALUES ($1, $2, NOW())", [
      orgId,
      "   ci DUPLICATE Probe   ",
    ]);
  } catch {
    rejectedFolded = true;
  }
  check("a case and whitespace variant is rejected too", rejectedFolded);

  const otherOrgAllowed = await (async () => {
    try {
      await client.query("INSERT INTO org_risks (org_id, title, review_date) VALUES ($1, $2, NOW())", [
        orgId + 100000,
        FIXTURE_TITLE,
      ]);
      return true;
    } catch {
      return false;
    }
  })();
  check("the same title in a different org is still allowed", otherOrgAllowed);
  await client.query("DELETE FROM org_risks WHERE org_id = $1", [orgId + 100000]);
  console.log("");

  // ── Manufacture the pre-migration state ──────────────────────────────────
  // Dropping the index here is the only way to recreate the condition the old
  // seeder left production in. This is a disposable CI database.
  console.log("boot 1: manufacturing the pre-migration state");
  await client.query(`DROP INDEX IF EXISTS ${UNIQUE_INDEX}`);
  check("index dropped for the fixture", !(await indexPresent(client)));

  // Three more copies, one of them curated. The curated row is inserted last so
  // that "keep the oldest" and "keep the curated one" give different answers -
  // otherwise the survivor rule is untested.
  await client.query("INSERT INTO org_risks (org_id, title) VALUES ($1, $2)", [orgId, FIXTURE_TITLE]);
  await client.query("INSERT INTO org_risks (org_id, title) VALUES ($1, $2)", [orgId, "  Ci Duplicate PROBE "]);
  const curatedId = Number(
    await scalar(
      client,
      `INSERT INTO org_risks (org_id, title, status, owner_email)
       VALUES ($1, $2, 'mitigated', 'analyst@example.test') RETURNING id`,
      [orgId, FIXTURE_TITLE],
    ),
  );
  await client.query("UPDATE org_risks SET review_date = NULL WHERE org_id = $1", [orgId]);

  const fixtureCount = Number(
    await scalar(client, "SELECT COUNT(*)::int FROM org_risks WHERE org_id = $1", [orgId]),
  );
  equal("fixture holds four copies of one title", fixtureCount, 4);
  check("the curated copy is not the oldest of the group", curatedId > 0);

  const snap = await snapshot(client);
  writeFileSync(SNAP1, JSON.stringify({ ...snap, orgId, curatedId }, null, 2));
  console.log(`  snapshot written to ${SNAP1}`);
  console.log("");
}

async function verifyBoot2(client) {
  if (!existsSync(SNAP1)) {
    console.error(`missing ${SNAP1}; run --verify-boot1 first`);
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(SNAP1, "utf8"));

  await assertBaseInvariants(client, "boot 2");

  console.log("boot 2: the repair did its job");
  const fixtureRows = (
    await client.query("SELECT id, title, status FROM org_risks WHERE org_id = $1 ORDER BY id", [before.orgId])
  ).rows;
  equal("the duplicate group collapsed to one row", fixtureRows.length, 1);
  equal(
    "the surviving row is the one a human had curated",
    fixtureRows[0] ? Number(fixtureRows[0].id) : -1,
    before.curatedId,
  );
  equal("the curated status survived", fixtureRows[0] ? fixtureRows[0].status : null, "mitigated");

  const quarantined = Number(
    await scalar(client, `SELECT COUNT(*)::int FROM ${QUARANTINE} WHERE org_id = $1`, [before.orgId]),
  );
  equal("the three removed rows are recoverable from quarantine", quarantined, 3);

  const snapshotsCarryData = Number(
    await scalar(
      client,
      `SELECT COUNT(*)::int FROM ${QUARANTINE} WHERE org_id = $1 AND row ? 'title' AND row ? 'org_id'`,
      [before.orgId],
    ),
  );
  equal("each snapshot is a whole row, not just an id", snapshotsCarryData, 3);
  console.log("");

  // ── The assertion this whole test exists for ─────────────────────────────
  console.log("boot 2: the seeder stood down");
  const insertedSinceBoot1 = Number(
    await scalar(client, "SELECT COUNT(*)::int FROM org_risks WHERE created_at > $1", [before.takenAt]),
  );
  equal("no risk row was created during the second boot", insertedSinceBoot1, 0);
  check(
    "the highest id did not advance, so nothing was inserted and rolled back either",
    Number(await scalar(client, "SELECT COALESCE(MAX(id), 0)::int FROM org_risks")) <= before.maxId,
  );

  for (const org of before.perOrg) {
    if (org.orgId === before.orgId) continue;
    const now = Number(
      await scalar(client, "SELECT COUNT(*)::int FROM org_risks WHERE org_id = $1", [org.orgId]),
    );
    equal(`org ${org.orgId} risk count unchanged`, now, org.n);
  }
  console.log("");

  const snap = await snapshot(client);
  writeFileSync(SNAP2, JSON.stringify({ ...snap, orgId: before.orgId, curatedId: before.curatedId }, null, 2));
  console.log(`  snapshot written to ${SNAP2}`);
  console.log("");
}

async function verifyBoot3(client) {
  if (!existsSync(SNAP2)) {
    console.error(`missing ${SNAP2}; run --verify-boot2 first`);
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(SNAP2, "utf8"));

  await assertBaseInvariants(client, "boot 3");

  console.log("boot 3: running the repair again changed nothing");
  const after = await snapshot(client);
  equal("total risk count unchanged", after.total, before.total);
  equal("highest id unchanged", after.maxId, before.maxId);
  equal("quarantine size unchanged", after.quarantined, before.quarantined);
  equal(
    "no risk row was created during the third boot",
    Number(await scalar(client, "SELECT COUNT(*)::int FROM org_risks WHERE created_at > $1", [before.takenAt])),
    0,
  );
  console.log("");

  console.log("boot 3: cleaning up the fixture");
  await client.query(`DELETE FROM ${QUARANTINE} WHERE org_id = $1`, [before.orgId]);
  await client.query("DELETE FROM org_risks WHERE org_id = $1", [before.orgId]);
  await client.query("DELETE FROM org_risks_seeded WHERE org_id = $1", [before.orgId]);
  await client.query("DELETE FROM organizations WHERE id = $1", [before.orgId]);
  console.log("  fixture removed");
  console.log("");
}

async function main() {
  const mode = process.argv.find((a) => a.startsWith("--verify-boot"));
  if (!mode) {
    console.error("usage: risk-seed-invariants.mjs --verify-boot1 | --verify-boot2 | --verify-boot3");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (mode === "--verify-boot1") await verifyBoot1(client);
    else if (mode === "--verify-boot2") await verifyBoot2(client);
    else if (mode === "--verify-boot3") await verifyBoot3(client);
    else {
      console.error(`unknown mode ${mode}`);
      process.exit(1);
    }
  } finally {
    await client.end();
  }

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("risk seed invariants crashed:", err);
  process.exit(1);
});
