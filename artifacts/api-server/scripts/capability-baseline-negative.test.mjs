#!/usr/bin/env node
/**
 * Negative control for the capability baseline.
 *
 * The baseline check has been green since it was written, which proves only
 * that it can pass. A check whose failure path has never been observed is not
 * evidence of anything: it could be passing because the repository is sound or
 * because the check does nothing. This file settles that by feeding the checker
 * roadmaps that are deliberately wrong and requiring it to reject them.
 *
 * Fixtures are written to a temporary directory. The repository is never
 * modified, and the real roadmap is also run as the positive control so that a
 * checker that simply fails everything cannot pass this file either.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CHECKER = join(HERE, "capability-baseline.mjs");
const REAL_ROADMAP = join(HERE, "..", "..", "..", "docs", "ROADMAP.md");
const TICK = String.fromCharCode(96);

let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log("  ok    " + name);
    return;
  }
  failed += 1;
  console.error("  FAIL  " + name);
  if (detail) console.error("        " + detail);
}

function runChecker(roadmapPath) {
  const result = spawnSync(
    process.execPath,
    [CHECKER, "--check", "--roadmap", roadmapPath],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    output: String(result.stdout ?? "") + String(result.stderr ?? ""),
  };
}

function fixture(dir, name, body) {
  const path = join(dir, name);
  writeFileSync(path, body, "utf8");
  return path;
}

function claim(text) {
  return TICK + text + TICK;
}

const dir = mkdtempSync(join(tmpdir(), "capability-baseline-negative-"));
const header = "# Fixture roadmap" + String.fromCharCode(10, 10) + "## Open work" + String.fromCharCode(10, 10);
const nl = String.fromCharCode(10);

console.log("capability baseline negative control");

// Positive control first. If this fails, nothing below means anything.
const real = runChecker(REAL_ROADMAP);
check(
  "the checked-in roadmap passes",
  real.status === 0,
  "exit " + real.status + nl + real.output,
);

const falseAbsent = fixture(
  dir,
  "false-absent.md",
  header +
    "- [ ] Build the integrations module " +
    claim("absent:module:integrations") +
    nl,
);
const a = runChecker(falseAbsent);
check(
  "an absent: claim for something that exists is rejected",
  a.status === 1,
  "exit " + a.status + nl + a.output,
);
check(
  "the rejection names the false claim",
  a.output.includes("integrations"),
  a.output,
);

const noClaim = fixture(
  dir,
  "no-claim.md",
  header + "- [ ] Something worth doing, with no evidence at all" + nl,
);
const b = runChecker(noClaim);
check(
  "an open item carrying no claim is rejected",
  b.status === 1,
  "exit " + b.status + nl + b.output,
);

const falsePresent = fixture(
  dir,
  "false-present.md",
  header +
    "- [x] Shipped the thing " +
    claim("present:module:no-such-module-exists-here") +
    nl,
);
const c = runChecker(falsePresent);
check(
  "a present: claim for something absent is rejected",
  c.status === 1,
  "exit " + c.status + nl + c.output,
);

const trueAbsent = fixture(
  dir,
  "true-absent.md",
  header +
    "- [ ] Not built yet " +
    claim("absent:module:no-such-module-exists-here") +
    nl,
);
const d = runChecker(trueAbsent);
check(
  "a true absent: claim is accepted",
  d.status === 0,
  "exit " + d.status + nl + d.output,
);

if (failed > 0) {
  console.error(nl + failed + " negative-control assertion(s) failed");
  process.exit(1);
}
console.log(nl + "negative control: the checker rejects what it should reject");
