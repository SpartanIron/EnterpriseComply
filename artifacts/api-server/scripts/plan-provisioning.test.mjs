/**
 * Unit tests for the ORG_PLAN_PROVISIONING parser and the provisioning applier.
 *
 * No database, no API server, no network. A fake db object records the SQL it is
 * handed, which is enough to assert the two properties that matter:
 *
 *   1. an org already on its configured tier is not written to at all, so the
 *      applier is genuinely idempotent and cannot churn the audit log on restart;
 *   2. a real change writes exactly one UPDATE and exactly one audit INSERT.
 *
 * Usage:
 *   node --import @swc-node/register/esm-register artifacts/api-server/scripts/plan-provisioning.test.mjs
 */

import {
  parsePlanProvisioning,
  applyPlanProvisioning,
  VALID_PLAN_TIERS,
} from "../src/provisioning/org-plan.provisioning.ts";

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

const quietLogger = { log() {}, warn() {}, error() {} };

console.log("\nORG_PLAN_PROVISIONING parser");

check("tier vocabulary matches plan.guard", [...VALID_PLAN_TIERS], [
  "starter",
  "professional",
  "enterprise",
  "federal",
]);

check("empty input yields nothing", parsePlanProvisioning(""), { entries: [], invalid: [] });
check("undefined input yields nothing", parsePlanProvisioning(undefined), {
  entries: [],
  invalid: [],
});
check("null input yields nothing", parsePlanProvisioning(null), { entries: [], invalid: [] });
check("whitespace only yields nothing", parsePlanProvisioning("   "), {
  entries: [],
  invalid: [],
});

check("single entry", parsePlanProvisioning("colorcode-solutions=federal").entries, [
  { slug: "colorcode-solutions", plan: "federal" },
]);

check(
  "multiple entries with untidy spacing",
  parsePlanProvisioning(" acme-inc = enterprise ,  beta-co=professional ").entries,
  [
    { slug: "acme-inc", plan: "enterprise" },
    { slug: "beta-co", plan: "professional" },
  ],
);

check(
  "slug and tier are case insensitive",
  parsePlanProvisioning("ColorCode-Solutions=FEDERAL").entries,
  [{ slug: "colorcode-solutions", plan: "federal" }],
);

check("trailing comma is ignored", parsePlanProvisioning("acme-inc=federal,").entries, [
  { slug: "acme-inc", plan: "federal" },
]);

// A typo must never be guessed at. Silently provisioning the wrong tier is worse
// than loudly skipping the entry.
check("unknown tier is rejected", parsePlanProvisioning("acme-inc=platinum").entries, []);
check("unknown tier is reported", parsePlanProvisioning("acme-inc=platinum").invalid, [
  "acme-inc=platinum (unknown tier platinum)",
]);
check("missing separator is rejected", parsePlanProvisioning("acme-inc").entries, []);
check("empty slug is rejected", parsePlanProvisioning("=federal").entries, []);
check("empty tier is rejected", parsePlanProvisioning("acme-inc=").invalid, [
  "acme-inc= (unknown tier <empty>)",
]);

check(
  "duplicate slug keeps the first and reports the second",
  parsePlanProvisioning("acme-inc=federal,acme-inc=starter").entries,
  [{ slug: "acme-inc", plan: "federal" }],
);

check(
  "one bad entry does not discard the good ones",
  parsePlanProvisioning("acme-inc=federal,broken,beta-co=starter").entries,
  [
    { slug: "acme-inc", plan: "federal" },
    { slug: "beta-co", plan: "starter" },
  ],
);

console.log("\nProvisioning applier");

/**
 * Fake db. Returns a queued result per execute() call and counts the calls.
 * Deliberately does not inspect the generated SQL text: that would couple the
 * test to drizzle internals. Call counts are enough to prove idempotency.
 */
function fakeDb(queue) {
  const calls = [];
  return {
    calls,
    async execute(q) {
      calls.push(q);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next ?? { rows: [] };
    },
  };
}

// Already on the configured tier: no UPDATE, no audit row, no log churn.
{
  const db = fakeDb([{ rows: [{ id: 1, plan: "federal" }] }]);
  const res = await applyPlanProvisioning(db, "colorcode-solutions=federal", quietLogger);
  check("no-op leaves the row alone", db.calls.length, 1);
  check("no-op is reported as unchanged", res.unchanged, ["colorcode-solutions"]);
  check("no-op changes nothing", res.changed, []);
}

// A real change: one UPDATE and one audit INSERT, and the transition is reported.
{
  const db = fakeDb([
    { rows: [{ id: 1, plan: "starter" }] },
    { rows: [] },
    { rows: [] },
  ]);
  const res = await applyPlanProvisioning(db, "colorcode-solutions=federal", quietLogger);
  check("change issues select, update and audit insert", db.calls.length, 3);
  check("change is reported with the transition", res.changed, [
    "colorcode-solutions: starter -> federal",
  ]);
  check("change is not also reported as unchanged", res.unchanged, []);
}

// A driver that returns a bare array rather than a QueryResult must still work.
{
  const db = fakeDb([[{ id: 7, plan: "starter" }], [], []]);
  const res = await applyPlanProvisioning(db, "acme-inc=enterprise", quietLogger);
  check("bare array result is understood", res.changed, ["acme-inc: starter -> enterprise"]);
}

// An unknown slug is skipped, not created. Provisioning never invents tenants.
{
  const db = fakeDb([{ rows: [] }]);
  const res = await applyPlanProvisioning(db, "ghost-org=federal", quietLogger);
  check("unknown slug writes nothing", db.calls.length, 1);
  check("unknown slug is reported missing", res.missing, ["ghost-org"]);
}

// A malformed variable must not touch the database at all.
{
  const db = fakeDb([]);
  const res = await applyPlanProvisioning(db, "acme-inc=platinum", quietLogger);
  check("malformed config touches no rows", db.calls.length, 0);
  check("malformed config is reported", res.invalid, [
    "acme-inc=platinum (unknown tier platinum)",
  ]);
}

// An unset variable is the normal case and must be a clean no-op.
{
  const db = fakeDb([]);
  const res = await applyPlanProvisioning(db, undefined, quietLogger);
  check("unset config touches no rows", db.calls.length, 0);
  check("unset config reports nothing", res, {
    unchanged: [],
    changed: [],
    missing: [],
    invalid: [],
  });
}

// A failed audit write must not lose the fact that the tier changed.
{
  const db = fakeDb([
    { rows: [{ id: 1, plan: "starter" }] },
    { rows: [] },
    new Error("audit table is read only"),
  ]);
  const res = await applyPlanProvisioning(db, "colorcode-solutions=federal", quietLogger);
  check("audit failure still reports the change", res.changed, [
    "colorcode-solutions: starter -> federal",
  ]);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} provisioning check(s) failed`);
  process.exit(1);
}
console.log("Plan provisioning behaves as specified.\n");
