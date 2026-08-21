/**
 * Phase 1c regression guard: the FISMA pass-through and the FIPS 199 tag.
 *
 * FISMA was deferred out of Phase 1 on purpose, with a guard asserting it stayed
 * out so the completion record could not quietly claim it. This file replaces
 * that guard now that it has shipped.
 *
 * What is protected here is the shape of the implementation, not its presence.
 * FISMA publishes no controls: agencies implement it through NIST SP 800-53,
 * scoped by FIPS 199. So the correct implementation borrows the 800-53 mappings
 * and says so. The incorrect one - the one this file exists to catch - writes a
 * second set of mapping rows under a fisma key and creates a second source of
 * truth for the same requirements.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  db,
  organizationsTable,
  orgFrameworksTable,
  ucoControlsTable,
  ucoFrameworkMappingsTable,
} from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import {
  FRAMEWORK_PASS_THROUGHS,
  passThroughFor,
  resolveMappingSource,
} from "../src/lib/framework-mappings";
import { computePosture } from "../src/lib/posture";
import { FRAMEWORK_CATALOG, FrameworksService } from "../src/modules/frameworks/frameworks.service";

const SOURCE = "nist-800-53";
const FIXTURE_MAPPING = "AC-1";

let failures = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log("  ok    " + name);
  } else {
    failures += 1;
    console.error("  FAIL  " + name + "\n        " + detail);
  }
}

/**
 * A pass-through can only be shown to resolve if the framework it borrows from
 * has mappings to borrow. The blank CI database seeds the control catalog but no
 * 800-53 mapping rows, so the first run of this guard reported 0 === 0 and
 * called it agreement. One row is created if the table has none for 800-53.
 */
async function ensureSourceMapping(): Promise<void> {
  const existing = await db
    .select()
    .from(ucoFrameworkMappingsTable)
    .where(eq(ucoFrameworkMappingsTable.frameworkKey, SOURCE));
  if (existing.length > 0) return;

  const [control] = await db.select().from(ucoControlsTable).limit(1);
  if (!control) return;

  await db.insert(ucoFrameworkMappingsTable).values({
    ucoControlId: control.controlId,
    frameworkKey: SOURCE,
    frameworkControlId: FIXTURE_MAPPING,
    frameworkControlName: "Policy and Procedures (guard fixture)",
  });
}

/** The org must hold both keys, or there is nothing to compare. */
async function ensureOrgFrameworks(service: FrameworksService, orgId: number): Promise<string[]> {
  const existing = await db
    .select()
    .from(orgFrameworksTable)
    .where(eq(orgFrameworksTable.orgId, orgId));
  const have = new Set(existing.map((f) => f.frameworkKey));
  const added: string[] = [];

  for (const key of [SOURCE, "fisma"]) {
    if (!have.has(key)) added.push(key);
  }
  if (added.length > 0) await service.addFrameworks(orgId, added);
  return added;
}

async function main() {
  console.log("Phase 1c: FISMA pass-through and FIPS 199 guard");

  const passThrough = passThroughFor("fisma");
  check(
    "FISMA is declared as a pass-through of 800-53",
    passThrough !== null && passThrough.source === "nist-800-53",
    "FRAMEWORK_PASS_THROUGHS=" + JSON.stringify(FRAMEWORK_PASS_THROUGHS),
  );
  check(
    "the pass-through carries a basis and a caveat",
    (passThrough?.basis.length ?? 0) > 40 && (passThrough?.caveat.length ?? 0) > 40,
    "A pass-through without a written basis is an unexplained shortcut, and " +
      "without a caveat it reads as an independent assessment.",
  );
  check(
    "resolution points FISMA at the 800-53 mappings and leaves others alone",
    resolveMappingSource("fisma") === "nist-800-53" &&
      resolveMappingSource("nist-800-53") === "nist-800-53",
    "resolveMappingSource must be identity for everything that is not a pass-through.",
  );
  check(
    "FISMA is in the catalog and says what it is",
    FRAMEWORK_CATALOG.some(
      (f) =>
        f.key === "fisma" &&
        /800-53/.test(f.name) &&
        /not an independent assessment/i.test(f.description),
    ),
    "The catalog entry must name the pass-through, so nobody reads a FISMA row " +
      "as a separate assessment.",
  );

  const fismaRows = await db
    .select()
    .from(ucoFrameworkMappingsTable)
    .where(eq(ucoFrameworkMappingsTable.frameworkKey, "fisma"));
  check(
    "no mapping rows exist under the fisma key",
    fismaRows.length === 0,
    "Found " + fismaRows.length + " mapping row(s) for fisma. A pass-through " +
      "stores nothing; rows here are a duplicate source of truth for the 800-53 " +
      "requirements.",
  );

  const service = new FrameworksService();
  const orgs = await db.select().from(organizationsTable).orderBy(asc(organizationsTable.id));
  const org = orgs[0];
  check("an organisation exists to assess", org !== undefined, "organizations is empty.");
  if (!org) {
    console.error("\n1 check(s) failed.");
    process.exit(1);
  }

  await ensureSourceMapping();
  const addedKeys = await ensureOrgFrameworks(service, org.id);

  const source = await service.getFrameworkControls(org.id, SOURCE);
  const viaFisma = await service.getFrameworkControls(org.id, "fisma");

  check(
    "the framework being borrowed from has mappings to borrow",
    source.total > 0,
    "800-53 has no mappings even after the fixture, so nothing below can " +
      "distinguish a resolved alias from an unresolved one.",
  );
  check(
    "the FISMA view returns the same control set as 800-53",
    viaFisma.total === source.total && viaFisma.total > 0,
    "fisma=" + viaFisma.total + " nist-800-53=" + source.total +
      ". A pass-through that returns nothing looks like a bug and reads like an " +
      "assessment of nothing.",
  );
  check(
    "the FISMA view reports what it borrowed",
    viaFisma.passThroughOf === "nist-800-53" && viaFisma.mappingSourceKey === "nist-800-53",
    "The response must name the framework whose mappings it read.",
  );
  check(
    "800-53 itself is not reported as a pass-through",
    source.passThroughOf === null,
    "Only the alias is a pass-through.",
  );

  const before = await computePosture(org.id);
  check(
    "the posture reports a FIPS 199 block",
    before.fips199 !== undefined && typeof before.fips199.note === "string",
    "fips199=" + JSON.stringify(before.fips199),
  );
  check(
    "an uncategorised system says so rather than defaulting to low",
    before.fips199.impactLevel === null
      ? before.fips199.source === "not set" &&
        /no fips 199 impact level has been recorded/i.test(before.fips199.note)
      : ["low", "moderate", "high"].includes(before.fips199.impactLevel),
    "fips199=" + JSON.stringify(before.fips199) +
      ". Defaulting an uncategorised system to low would invent the scope of its " +
      "own assessment.",
  );

  await db
    .update(organizationsTable)
    .set({ fips199Impact: "moderate" })
    .where(eq(organizationsTable.id, org.id));

  const after = await computePosture(org.id);
  check(
    "a recorded level reaches the posture",
    after.fips199.impactLevel === "moderate" &&
      after.fips199.source === "recorded on the organisation",
    "fips199=" + JSON.stringify(after.fips199),
  );
  check(
    "recording a level does not silently change coverage",
    after.counts.total === before.counts.total,
    "The level is recorded, not yet used to select an 800-53 baseline. If that " +
      "changes, this assertion changes with it and the caveat must stop saying " +
      "no baseline filter is applied.",
  );

  // Leave the database as it was found.
  await db
    .update(organizationsTable)
    .set({ fips199Impact: before.fips199.impactLevel })
    .where(eq(organizationsTable.id, org.id));

  const withFisma = await computePosture(org.id);
  const fismaPosture = withFisma.frameworks.find((f) => f.frameworkKey === "fisma");
  const source53 = withFisma.frameworks.find((f) => f.frameworkKey === "nist-800-53");

  check(
    "posture resolves the FISMA mappings",
    fismaPosture !== undefined && fismaPosture.mappedControlCount > 0,
    "fisma posture=" + JSON.stringify(fismaPosture) +
      ". Zero mapped objectives means the alias was not resolved.",
  );
  check(
    "FISMA and 800-53 report identical coverage, being the same set",
    fismaPosture !== undefined &&
      source53 !== undefined &&
      fismaPosture.mappedControlCount === source53.mappedControlCount,
    "fisma=" + String(fismaPosture?.mappedControlCount) +
      " nist-800-53=" + String(source53?.mappedControlCount),
  );
  check(
    "the FISMA posture names its source and carries its caveat",
    fismaPosture?.passThroughOf === "nist-800-53" &&
      (fismaPosture?.passThroughCaveat?.length ?? 0) > 40,
    "passThroughOf=" + String(fismaPosture?.passThroughOf),
  );

  // Only the rows this guard added, each identified by both columns. Never a
  // blanket delete of the organisation's frameworks.
  for (const key of addedKeys) {
    await db
      .delete(orgFrameworksTable)
      .where(and(eq(orgFrameworksTable.orgId, org.id), eq(orgFrameworksTable.frameworkKey, key)));
  }

  const rollback = readFileSync(
    join(process.cwd(), "scripts/rollback-fisma-fips199.cjs"),
    "utf-8",
  );
  check(
    "the rollback is dry-run unless confirmed",
    rollback.includes("--confirm") && rollback.includes("DRY_RUN"),
    "A rollback that drops a column on an accidental invocation is not a rollback.",
  );

  if (failures > 0) {
    console.error("\n" + failures + " check(s) failed.");
    process.exit(1);
  }

  console.log("\nAll FISMA pass-through checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Guard crashed:", error);
  process.exit(1);
});
