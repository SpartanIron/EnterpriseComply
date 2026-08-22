/**
 * Guard: retracting a connector-written control result.
 *
 * Three properties have to keep holding, and none of them is visible by
 * reading a diff:
 *
 *   1. A retraction never becomes an attestation. The write this produces
 *      must not carry manualOverride or manualOverrideBy. If someone adds
 *      them to make a UI badge easier, the row starts telling an assessor
 *      that a named officer signed off on a control nobody tested.
 *
 *   2. A human assertion is refused. The endpoint exists to withdraw machine
 *      output; a manually set status belongs to the person who set it.
 *
 *   3. The previous values survive. They cannot be recovered from the row
 *      once overwritten, so if the snapshot stops being complete the audit
 *      log stops being a record of what changed.
 *
 * The decision is a pure function, so this runs without a database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLEARED_STATUS,
  planAutomatedResultClear,
} from "../src/lib/control-result-clear";
import type { ClearableResultRow } from "../src/lib/control-result-clear";

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n" + "        " + detail);
  }
}

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

function row(overrides: Partial<ClearableResultRow> = {}): ClearableResultRow {
  return {
    status: "passing",
    result: "Slack: control verified via automated scan",
    evidence: null,
    evidenceUrl: null,
    integrationKey: "slack",
    failureReason: null,
    lastTestedAt: new Date("2026-08-22T00:45:13.117Z"),
    manualOverride: false,
    ...overrides,
  };
}

console.log("\ncontrol result retraction\n");

// 1. Refusals.
const noRow = planAutomatedResultClear(null);
check(
  "a control with no stored result is refused",
  noRow.ok === false && noRow.reason === "no_result",
  "got " + JSON.stringify(noRow),
);

const manual = planAutomatedResultClear(row({ manualOverride: true }));
check(
  "a manually set result is refused even when an integration is recorded",
  manual.ok === false && manual.reason === "manual_override",
  "got " + JSON.stringify(manual),
);

const notAutomated = planAutomatedResultClear(row({ integrationKey: null }));
check(
  "a result with no integration recorded is refused",
  notAutomated.ok === false && notAutomated.reason === "not_automated",
  "got " + JSON.stringify(notAutomated),
);

check(
  "every refusal carries a message a human can act on",
  [noRow, manual, notAutomated].every(
    (r) => r.ok === false && typeof r.message === "string" && r.message.length > 40,
  ),
  "one refusal had no usable message",
);

// 2. The approved plan.
const plan = planAutomatedResultClear(row());
check("a connector-written result may be retracted", plan.ok === true, JSON.stringify(plan));

if (plan.ok) {
  check(
    "retraction lands on not_tested and nowhere else",
    plan.updates.status === CLEARED_STATUS && CLEARED_STATUS === "not_tested",
    "status was " + plan.updates.status,
  );

  const nulled = [
    "result",
    "evidence",
    "evidenceUrl",
    "integrationKey",
    "failureReason",
    "lastTestedAt",
    "nextTestAt",
  ];
  const notNulled = nulled.filter(
    (k) => (plan.updates as unknown as Record<string, unknown>)[k] !== null,
  );
  check(
    "every field that carried the assertion is cleared",
    notNulled.length === 0,
    "still set: " + notNulled.join(", "),
  );

  const forbidden = Object.keys(plan.updates).filter((k) =>
    k.toLowerCase().startsWith("manualoverride"),
  );
  check(
    "a retraction is not an attestation: no manualOverride in the write",
    forbidden.length === 0,
    "found: " + forbidden.join(", "),
  );

  check(
    "the fabricated status and sentence are preserved in the snapshot",
    plan.previous.status === "passing" &&
      plan.previous.result === "Slack: control verified via automated scan" &&
      plan.previous.integrationKey === "slack",
    JSON.stringify(plan.previous),
);

  const restorable = Object.keys(plan.updates).filter((k) => k !== "nextTestAt");
  const missing = restorable.filter(
    (k) => !Object.prototype.hasOwnProperty.call(plan.previous, k),
  );
  check(
    "the snapshot covers every field the write clears",
    missing.length === 0,
    "not snapshotted: " + missing.join(", "),
  );

  check(
    "lastTestedAt is snapshotted as an ISO string",
    plan.previous.lastTestedAt === "2026-08-22T00:45:13.117Z",
    "got " + String(plan.previous.lastTestedAt),
  );
}

const fromString = planAutomatedResultClear(
  row({ lastTestedAt: "2026-08-22T00:45:13.124Z" }),
);
check(
  "a string timestamp is normalised the same way a Date is",
  fromString.ok === true &&
    fromString.previous.lastTestedAt === "2026-08-22T00:45:13.124Z",
  JSON.stringify(fromString.ok ? fromString.previous : fromString),
);

const noTimestamp = planAutomatedResultClear(row({ lastTestedAt: null }));
check(
  "a missing timestamp snapshots as null, not as the epoch",
  noTimestamp.ok === true && noTimestamp.previous.lastTestedAt === null,
  JSON.stringify(noTimestamp.ok ? noTimestamp.previous : noTimestamp),
);

// 3. The wiring. These read source because the properties are about how the
// endpoint is guarded and what it records, not about a return value.
const controller = readSource("src/modules/controls/controls.controller.ts");
const service = readSource("src/modules/controls/controls.service.ts");

check(
  "the route exists",
  controller.includes("clear-automated-result"),
  "no clear-automated-result route in the controls controller",
);

const routeIndex = controller.indexOf("clear-automated-result");
const routeBlock = routeIndex >= 0 ? controller.slice(routeIndex, routeIndex + 400) : "";
check(
  "the route is owner-guarded",
  routeBlock.includes('RequireRole("owner")'),
  "guard on the retraction route was: " + routeBlock.slice(0, 200),
);
check(
  "the route is not analyst-guarded",
  !routeBlock.includes('RequireRole("analyst")'),
  "the retraction route accepts analyst",
);

const methodStart = service.indexOf("async clearAutomatedResult");
const methodEnd = service.indexOf("async getFrameworkImpact");
const method =
  methodStart >= 0 && methodEnd > methodStart ? service.slice(methodStart, methodEnd) : "";

check(
  "the service method is present and delimited",
  method.length > 400,
  "could not isolate clearAutomatedResult in the service",
);
check(
  "the retraction is audit logged",
  method.includes("control_result.automated_retracted"),
  "no retraction audit action found",
);
check(
  "a refused retraction is audit logged too",
  method.includes("control_result.retraction_refused"),
  "no refusal audit action found",
);
check(
  "the previous values are what gets recorded",
  method.includes("previous: plan.previous"),
  "the audit entry does not carry plan.previous",
);
check(
  "the service does not reintroduce manualOverride on this path",
  !method.includes("manualOverride: true"),
  "clearAutomatedResult sets manualOverride",
);
check(
  "the decision is not duplicated in the service",
  method.includes("planAutomatedResultClear("),
  "the service does not call the shared decision",
);

console.log("");
if (failures > 0) {
  console.error(String(failures) + " check(s) failed");
  process.exit(1);
}
console.log("all checks passed");
