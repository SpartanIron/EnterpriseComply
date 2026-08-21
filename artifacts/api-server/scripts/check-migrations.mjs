/**
 * Migration Safety Scanner — P1-19
 *
 * Statically parses migration SQL (startup.service.ts + any *.sql files in
 * lib/db/migrations/) and fails if it finds destructive or high-risk SQL
 * that has not been explicitly approved.
 *
 * Approval syntax (add as an inline comment on the offending line):
 *   -- MIGRATION-APPROVED: <reason why this is intentional>
 *
 * Exit code: 0 = clean, 1 = unapproved destructive change found
 *
 * Usage:
 *   node artifacts/api-server/scripts/check-migrations.mjs
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dir    = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dir, "../../..");

// ── Files to scan ─────────────────────────────────────────────────────────────
// Add new migration sources here as the project evolves.
const SCAN_TARGETS = [
  join(REPO_ROOT, "artifacts/api-server/src/startup/startup.service.ts"),
  // New boot migrations are enrolled here as they are written.
  //
  // The five files already in src/migrations/ are NOT enrolled yet: between
  // them they carry five DROP POLICY / DROP TRIGGER / DELETE FROM lines that
  // predate this scanner and would each need their own approval tag triaged on
  // its own merits. Back-enrolling them is tracked separately; doing it inside
  // an unrelated change would mean rubber-stamping SQL nobody reviewed.
  join(REPO_ROOT, "artifacts/api-server/src/migrations/risk-seed-dedupe.migration.ts"),
  join(REPO_ROOT, "artifacts/api-server/src/migrations/mapping-consolidation.migration.ts"),
];

// Pick up any .sql files under lib/db/migrations/ (Drizzle generate output)
const SQL_MIGRATIONS_DIR = join(REPO_ROOT, "lib/db/migrations");
if (existsSync(SQL_MIGRATIONS_DIR)) {
  for (const f of readdirSync(SQL_MIGRATIONS_DIR, { recursive: true })) {
    if (String(f).endsWith(".sql")) SCAN_TARGETS.push(join(SQL_MIGRATIONS_DIR, String(f)));
  }
}

// ── Destructive patterns ──────────────────────────────────────────────────────
// Each entry: { regex, label, severity }
//   severity "error"   → blocks CI (requires explicit approval comment)
//   severity "warning" → printed but does not block CI
const PATTERNS = [
  // Data-loss operations — always block
  { regex: /\bDROP\s+TABLE\b/i,                        label: "DROP TABLE",                                    severity: "error"   },
  { regex: /\bDROP\s+COLUMN\b/i,                       label: "DROP COLUMN",                                   severity: "error"   },
  { regex: /\bTRUNCATE\b/i,                            label: "TRUNCATE",                                      severity: "error"   },
  { regex: /\bALTER\s+TABLE\b[^;]*\bDROP\b/i,          label: "ALTER TABLE ... DROP",                          severity: "error"   },
  { regex: /\bDROP\s+SCHEMA\b/i,                       label: "DROP SCHEMA",                                   severity: "error"   },
  { regex: /\bDELETE\s+FROM\b/i,                       label: "DELETE FROM (in migration — likely wrong)",      severity: "error"   },

  // Constraint / index removals — block; reversible but may break app
  { regex: /\bDROP\s+CONSTRAINT\b/i,                   label: "DROP CONSTRAINT",                               severity: "error"   },
  { regex: /\bDROP\s+INDEX\b/i,                        label: "DROP INDEX",                                    severity: "error"   },

  // Risky but not always wrong — warn only
  { regex: /ALTER\s+COLUMN\b[^;]*\bTYPE\b/i,           label: "ALTER COLUMN TYPE (data truncation risk)",      severity: "warning" },
  {
    // ADD COLUMN ... NOT NULL with no DEFAULT is safe only on empty tables
    regex: /ADD\s+COLUMN\b(?!.*\bIF\s+NOT\s+EXISTS\b)[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i,
    label: "ADD COLUMN NOT NULL without DEFAULT (fails on tables with existing rows)",
    severity: "warning",
  },
];

// Approval tag — presence on the line opts it out of error-level blocking
const APPROVED = /--\s*MIGRATION-APPROVED\s*:/i;

// ── Scanner ───────────────────────────────────────────────────────────────────

let errors   = 0;
let warnings  = 0;

for (const filePath of SCAN_TARGETS) {
  if (!existsSync(filePath)) continue;

  const src   = readFileSync(filePath, "utf-8");
  const rel   = relative(REPO_ROOT, filePath);
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const lineNum = i + 1;

    for (const { regex, label, severity } of PATTERNS) {
      if (!regex.test(line)) continue;

      const approved  = APPROVED.test(line);
      const prefix    = severity === "error" && !approved ? "✗ ERROR" : severity === "warning" ? "⚠ WARN " : "✓ APPROVED";
      const indicator = severity === "error" && !approved ? "UNAPPROVED DESTRUCTIVE CHANGE" : severity === "warning" ? "risky SQL" : "approved";

      console.log(`${prefix}  ${rel}:${lineNum}  [${label}]`);
      console.log(`       ${line.trim()}`);

      if (severity === "error" && !approved) {
        errors++;
        console.log(`       → To allow: add  -- MIGRATION-APPROVED: <reason>  at end of this line`);
      } else if (severity === "warning") {
        warnings++;
      }
      console.log();
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

const bar = "═".repeat(70);
console.log(bar);
if (errors === 0 && warnings === 0) {
  console.log("  ✓ No destructive SQL patterns found — migration scan clean.");
} else {
  if (errors > 0)   console.log(`  ✗ ${errors} unapproved destructive change(s) — CI blocked. Add approval comments.`);
  if (warnings > 0) console.log(`  ⚠ ${warnings} warning(s) — review before merging.`);
}
console.log(bar);

process.exit(errors > 0 ? 1 : 0);
