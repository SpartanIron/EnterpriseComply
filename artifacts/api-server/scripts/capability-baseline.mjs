#!/usr/bin/env node
/**
 * Capability baseline and roadmap claim checker.
 *
 * Why this exists. Work kept getting proposed for parts of this platform that
 * had already shipped, because the roadmap lived in prose and memory while the
 * code moved underneath it. This script measures what is actually in the
 * repository, then holds docs/ROADMAP.md to that measurement: every open
 * roadmap item must carry at least one machine-checkable claim about the code,
 * and CI fails if a claim is false. An item that says something is absent when
 * it already exists cannot be merged.
 *
 * It also enforces structural invariants that have each already caused a
 * production 500. org_audit_shares and org_remediation_tasks were both declared
 * in the Drizzle schema and queried by a live service, while the only CREATE
 * TABLE for them sat in lib/db/src/migrate-new-tables.ts, which no runtime path
 * executes. The reachability check below is the generalised form of that bug:
 * declaring a table is not the same as creating it, and the difference is only
 * visible at runtime unless something looks for it.
 *
 * Nothing here talks to a database or a network. It reads files, so it is safe
 * to run on any checkout and in any CI job.
 *
 * Usage:
 *   node scripts/capability-baseline.mjs            human readable inventory
 *   node scripts/capability-baseline.mjs --json     the same inventory as JSON
 *   node scripts/capability-baseline.mjs --check    invariants + roadmap claims
 *
 * --check prints every violation it finds before exiting 1, so one CI run
 * reports the whole picture rather than the first thing that broke.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

const API_ROOT = join(REPO_ROOT, "artifacts", "api-server");
const API_SRC = join(API_ROOT, "src");
const API_SCRIPTS = join(API_ROOT, "scripts");
const MODULES_DIR = join(API_SRC, "modules");
const MIGRATIONS_DIR = join(API_SRC, "migrations");
const LIB_DIR = join(API_SRC, "lib");
const DB_SRC = join(REPO_ROOT, "lib", "db", "src");
const SCHEMA_DIR = join(DB_SRC, "schema");
// The roadmap path is overridable so the checker can be aimed at a fixture.
// scripts/capability-baseline-negative.test.mjs uses that to prove the check
// rejects a false claim. A check that has only ever been observed passing is
// not evidence that it works.
const roadmapFlagAt = process.argv.indexOf("--roadmap");
const ROADMAP_PATH =
  roadmapFlagAt >= 0 && process.argv[roadmapFlagAt + 1]
    ? process.argv[roadmapFlagAt + 1]
    : join(REPO_ROOT, "docs", "ROADMAP.md");
const VERIFY_SCHEMA_PATH = join(API_SCRIPTS, "verify-schema.mjs");

/**
 * Tables declared in this workspace that the GRC API is not responsible for
 * creating. Each entry needs a reason, so the allowlist cannot quietly become
 * the place where real defects go to hide.
 */
const OUT_OF_TREE_TABLES = new Map([
  [
    "conversations",
    "belongs to the c2s-ciop chat surface, which owns its own schema lifecycle",
  ],
  [
    "messages",
    "belongs to the c2s-ciop chat surface, which owns its own schema lifecycle",
  ],
]);

/**
 * Files executed outside the Nest module graph, so import reachability cannot
 * see them. Keep this list short and cite what runs each one.
 */
const EXTERNALLY_EXECUTED = new Map([
  [
    "artifacts/api-server/scripts/migrate.cjs",
    "railway.toml preDeployCommand",
  ],
]);

/**
 * Provider files that nothing under src imports.
 *
 * Sixteen provider classes were written and not one of them was imported by
 * the application. A provider nothing imports never runs, so the connector it
 * was written for reports connection-only for ever. It is the same defect as a
 * table that is declared and never created, one layer up, and it was found the
 * same way: by asking what refers to what instead of reading the code and
 * believing it.
 *
 * An entry here is a debt that has been looked at, not a debt that is allowed.
 * The list may shrink without ceremony. Adding to it requires a reason.
 */
const UNWIRED_PROVIDER_REASON =
  "Written against the vendor API but registered on no sync path, so POST " +
    "orgs/:orgId/integrations/:key/sync still answers connection-only for it.";

const UNWIRED_PROVIDERS = new Map([
  [
    "google-workspace.provider",
    "Superseded by modules/google-workspace, which is wired, exposes connect, " +
      "sync, status and disconnect, and builds its own RS256 assertion. This " +
      "file is kept because scripts/google-jwt.test.ts asserts against it.",
  ],
  [
    "duo.provider",
    "Implements Duo HMAC request signing, which is the exact thing the spec " +
      "says cannot be done. Neither registered nor promoted out of unavailable.",
  ],
  ["qualys.provider", UNWIRED_PROVIDER_REASON],
  ["sentinelone.provider", UNWIRED_PROVIDER_REASON],
  ["servicenow.provider", UNWIRED_PROVIDER_REASON],
  ["tenable.provider", UNWIRED_PROVIDER_REASON],
  ["wiz.provider", UNWIRED_PROVIDER_REASON],
  ["workday.provider", UNWIRED_PROVIDER_REASON],
]);

function walk(dir, extensions, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, found);
    else if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(full);
  }
  return found;
}

const rel = (absolute) => relative(REPO_ROOT, absolute).split(sep).join("/");

const count = (text, pattern) => (text.match(pattern) || []).length;

const stem = (path) => path.split("/").pop().replace(/\.(ts|mjs|cjs)$/, "");

function loadSources() {
  const files = [
    ...walk(API_SRC, [".ts"]),
    ...walk(API_SCRIPTS, [".ts", ".mjs", ".cjs"]),
    ...walk(DB_SRC, [".ts"]),
  ];
  return files.map((abs) => ({
    path: rel(abs),
    text: readFileSync(abs, "utf8"),
  }));
}

function routesIn(text) {
  const base = (text.match(/@Controller\(\s*["']([^"']*)["']/) || [])[1] ?? "";
  const routes = [];
  const decorator = /@(Get|Post|Put|Patch|Delete)\(\s*(?:["']([^"']*)["'])?\s*\)/g;
  for (const match of text.matchAll(decorator)) {
    const tail = match[2] ?? "";
    const path = [base, tail].filter((part) => part !== "").join("/");
    routes.push(match[1].toUpperCase() + " " + path);
  }
  return routes;
}

function buildInventory() {
  const sources = loadSources();
  const byPath = new Map(sources.map((s) => [s.path, s]));
  const apiSrcFiles = sources.filter((s) =>
    s.path.startsWith("artifacts/api-server/src/"),
  );

  // A file under the API src tree is reachable if any other file in that tree
  // mentions its module stem. This is deliberately generous: a false "reachable"
  // only weakens the check, while a false "unreachable" would fail CI on
  // working code and teach people to disable the check.
  const isReachable = (path) => {
    if (EXTERNALLY_EXECUTED.has(path)) return true;
    if (path.endsWith("src/startup/startup.service.ts")) return true;
    if (!path.startsWith("artifacts/api-server/src/")) return false;
    const needle = stem(path);
    return apiSrcFiles.some((s) => s.path !== path && s.text.includes(needle));
  };

  const modules = [];
  const moduleNames = existsSync(MODULES_DIR)
    ? readdirSync(MODULES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
  for (const name of moduleNames) {
    const files = walk(join(MODULES_DIR, name), [".ts"]).map(rel);
    let loc = 0;
    let dbOps = 0;
    const routes = [];
    for (const path of files) {
      const text = byPath.get(path)?.text ?? "";
      loc += text.split("\n").length;
      dbOps += count(
        text,
        /db\.(?:select|insert|update|delete)\(|pool\.query\(|\.execute\(/g,
      );
      routes.push(...routesIn(text));
    }
    modules.push({ name, files: files.length, loc, dbOps, routes: routes.sort() });
  }

  const schemaTables = new Map();
  for (const abs of walk(SCHEMA_DIR, [".ts"])) {
    const text = readFileSync(abs, "utf8");
    for (const match of text.matchAll(/pgTable\(\s*["']([a-z0-9_]+)["']/g)) {
      schemaTables.set(match[1], rel(abs));
    }
  }

  const createdBy = new Map();
  const createdReachable = new Set();
  for (const source of sources) {
    const reachable = isReachable(source.path);
    const statement = /CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?/gi;
    for (const match of source.text.matchAll(statement)) {
      const table = match[1];
      if (!createdBy.has(table)) createdBy.set(table, []);
      const creators = createdBy.get(table);
      if (!creators.includes(source.path)) creators.push(source.path);
      if (reachable) createdReachable.add(table);
    }
  }

  const migrations = walk(MIGRATIONS_DIR, [".ts"])
    .map(rel)
    .sort()
    .map((path) => ({
      path,
      referencedBy: apiSrcFiles
        .filter((s) => s.path !== path && s.text.includes(stem(path)))
        .map((s) => s.path),
    }));

  const libs = walk(LIB_DIR, [".ts"])
    .map(rel)
    .sort()
    .map((path) => ({ path, loc: byPath.get(path).text.split("\n").length }));

  const routes = [...new Set(modules.flatMap((m) => m.routes))].sort();

  let expectedTables = null;
  if (existsSync(VERIFY_SCHEMA_PATH)) {
    const text = readFileSync(VERIFY_SCHEMA_PATH, "utf8");
    const block = text.match(/EXPECTED_TABLES\s*=\s*\[([\s\S]*?)\]/);
    if (block) {
      expectedTables = [...block[1].matchAll(/["']([a-z0-9_]+)["']/g)].map(
        (m) => m[1],
      );
    }
  }

  return {
    modules,
    schemaTables,
    createdBy,
    createdReachable,
    migrations,
    libs,
    routes,
    expectedTables,
    sources,
    hasWebClient: existsSync(join(REPO_ROOT, "artifacts", "web-client")),
  };
}

function claimHolds(inventory, kind, subject, value) {
  switch (subject) {
    case "module":
      return existsSync(join(MODULES_DIR, value));
    case "file":
      return existsSync(join(REPO_ROOT, value));
    case "symbol":
      return inventory.sources.some((s) => s.text.includes(value));
    case "table":
      return inventory.schemaTables.has(value) || inventory.createdBy.has(value);
    case "route":
      return inventory.routes.some((route) => route.includes(value));
    default:
      return null;
  }
}

function checkRoadmap(inventory, violations) {
  if (!existsSync(ROADMAP_PATH)) {
    violations.push(
      "docs/ROADMAP.md is missing. The roadmap is the artifact this check exists to constrain.",
    );
    return;
  }
  const text = readFileSync(ROADMAP_PATH, "utf8");
  const lines = text.split("\n");
  const tick = String.fromCharCode(96);
  const claim = new RegExp(
    tick + "(absent|present):(module|file|symbol|table|route):([^" + tick + "]+)" + tick,
    "g",
  );

  lines.forEach((line, index) => {
    const number = index + 1;
    const open = /^\s*[-*]\s+\[ \]\s+/.test(line);
    const claims = [...line.matchAll(claim)];
    if (open && claims.length === 0) {
      violations.push(
        "docs/ROADMAP.md:" +
          number +
          " is an open item with no evidence claim. Add at least one claim such as " +
          tick +
          "absent:file:path/to/thing.ts" +
          tick +
          " so the item cannot outlive the gap it describes.",
      );
    }
    for (const [, kind, subject, value] of claims) {
      const exists = claimHolds(inventory, kind, subject, value.trim());
      if (exists === null) continue;
      if (kind === "absent" && exists) {
        violations.push(
          "docs/ROADMAP.md:" +
            number +
            " claims " +
            subject +
            " " +
            value.trim() +
            " is absent, but it is present in the repository. This is the case this check exists to catch: do not build it again.",
        );
      }
      if (kind === "present" && !exists) {
        violations.push(
          "docs/ROADMAP.md:" +
            number +
            " claims " +
            subject +
            " " +
            value.trim() +
            " is present, but it was not found. Either the claim is wrong or something was removed.",
        );
      }
    }
  });
}

function runCheck(inventory) {
  const violations = [];

  for (const [table, declaredIn] of inventory.schemaTables) {
    if (OUT_OF_TREE_TABLES.has(table)) continue;
    if (inventory.createdReachable.has(table)) continue;
    const creators = inventory.createdBy.get(table) ?? [];
    violations.push(
      "Table " +
        table +
        " is declared in " +
        declaredIn +
        " but no reachable boot path creates it" +
        (creators.length
          ? ". The only CREATE TABLE statements live in " +
            creators.join(", ") +
            ", which nothing executes."
          : " and no CREATE TABLE statement exists anywhere.") +
        " Any endpoint that queries it returns 500 rather than an empty list.",
    );
  }

  for (const migration of inventory.migrations) {
    if (migration.referencedBy.length === 0) {
      violations.push(
        "Migration " +
          migration.path +
          " is never referenced by anything under artifacts/api-server/src, so it does not run.",
      );
    }
  }

  if (inventory.expectedTables) {
    for (const table of inventory.expectedTables) {
      if (OUT_OF_TREE_TABLES.has(table)) continue;
      if (inventory.createdReachable.has(table)) continue;
      violations.push(
        "scripts/verify-schema.mjs expects table " +
          table +
          " but no reachable boot path creates it.",
      );
    }
  } else {
    console.log(
      "note: EXPECTED_TABLES could not be parsed out of scripts/verify-schema.mjs, so that cross-check was skipped.",
    );
  }

  checkRoadmap(inventory, violations);

  // Every connector provider file must be imported by the application.
  //
  // A provider that only a test imports does not run in production. The
  // referrer therefore has to be under src, not under scripts.
  const providersDir = join(MODULES_DIR, "integrations", "providers");
  if (existsSync(providersDir)) {
    const sources = loadSources();
    for (const entry of readdirSync(providersDir)) {
      if (!entry.endsWith(".ts")) continue;
      const stem = entry.replace(/\.ts$/, "");
      const importedBySrc = sources.some(
        (s) =>
          s.path.includes("api-server" + sep + "src") &&
          !s.path.endsWith(entry) &&
          s.text.includes("providers/" + stem),
      );
      if (importedBySrc) continue;
      if (UNWIRED_PROVIDERS.has(stem)) continue;
      violations.push(
        "Provider " +
          entry +
          " is imported by nothing under src and is not listed in " +
          "UNWIRED_PROVIDERS with a reason. Wire it, or record why it is not " +
          "wired. A provider nothing imports collects nothing.",
      );
    }
  }

  // A connector declared unavailable must not already be implemented.
  //
  // google-workspace was declared unavailable in connector-specs.ts while
  // modules/google-workspace shipped connect, sync, status and disconnect
  // routes and its own RS256 assertion. The catalogue therefore told customers
  // a working connector was not available yet, and nothing in the build
  // noticed. Both readings of a clash here are defects: either the module is
  // dead code, or the connector is not unavailable.
  const specsPath = join(MODULES_DIR, "integrations", "connector-specs.ts");
  if (existsSync(specsPath)) {
    const specsText = readFileSync(specsPath, "utf8");
    const declaredUnavailable = [
      ...specsText.matchAll(/unavailable\(\s*"([a-z0-9-]+)"/g),
    ].map((m) => m[1]);
    for (const key of declaredUnavailable) {
      if (!existsSync(join(MODULES_DIR, key))) continue;
      violations.push(
        "Connector " +
          key +
          " is declared unavailable in connector-specs.ts, but " +
          "src/modules/" +
          key +
          " exists. Either that module is dead or the connector is reachable.",
      );
    }
  }

  if (violations.length === 0) {
    console.log("capability baseline: OK");
    console.log(
      "  " +
        inventory.modules.length +
        " api modules, " +
        inventory.routes.length +
        " routes, " +
        inventory.schemaTables.size +
        " declared tables, " +
        inventory.migrations.length +
        " boot migrations, all reachable",
    );
    return 0;
  }

  console.error("capability baseline: " + violations.length + " violation(s)");
  for (const violation of violations) console.error("  - " + violation);
  return 1;
}

function printReport(inventory) {
  console.log("# Measured capability baseline");
  console.log("");
  console.log("API modules: " + inventory.modules.length);
  for (const module of inventory.modules) {
    console.log(
      "  " +
        module.name.padEnd(20) +
        " files=" +
        String(module.files).padStart(2) +
        " loc=" +
        String(module.loc).padStart(5) +
        " routes=" +
        String(module.routes.length).padStart(2) +
        " dbOps=" +
        String(module.dbOps).padStart(3),
    );
  }
  console.log("");
  console.log("Declared tables: " + inventory.schemaTables.size);
  console.log("Boot migrations: " + inventory.migrations.length);
  console.log("Shared libs under src/lib: " + inventory.libs.length);
  console.log("Distinct routes: " + inventory.routes.length);
  console.log(
    "Web client in this repository: " + (inventory.hasWebClient ? "yes" : "no"),
  );
  console.log("");
  console.log("Tables with no reachable creator:");
  let flagged = 0;
  for (const [table] of inventory.schemaTables) {
    if (inventory.createdReachable.has(table)) continue;
    flagged += 1;
    const note = OUT_OF_TREE_TABLES.get(table);
    console.log("  " + table + (note ? "  (allowed: " + note + ")" : "  (DEFECT)"));
  }
  if (flagged === 0) console.log("  none");
}

function main() {
  const args = new Set(process.argv.slice(2));
  const inventory = buildInventory();

  if (args.has("--json")) {
    console.log(
      JSON.stringify(
        {
          modules: inventory.modules,
          declaredTables: [...inventory.schemaTables.keys()].sort(),
          tablesWithoutReachableCreator: [...inventory.schemaTables.keys()]
            .filter((t) => !inventory.createdReachable.has(t))
            .sort(),
          migrations: inventory.migrations,
          libs: inventory.libs,
          routes: inventory.routes,
          expectedTables: inventory.expectedTables,
          hasWebClient: inventory.hasWebClient,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.has("--check")) return runCheck(inventory);

  printReport(inventory);
  return 0;
}

process.exit(main());
