/**
 * Unit tests for the platform-administrator bootstrap and the elevation rules.
 *
 * No API server and no network. reconcilePlatformAdmins() takes its database
 * handle as an argument precisely so it can be driven by a fake here, and the
 * parser, the reason validator and the TTL clamp are pure.
 *
 * The properties under test are the ones that make env-var bootstrapping safe
 * rather than dangerous:
 *
 *   - the variable is authoritative, so dropping an address REVOKES the grant
 *   - an address with no account grants nothing and never creates a user
 *   - a live elevation dies with the grant that allowed it
 *   - an elevation cannot outlive the hard ceiling, however long is requested
 *
 * Usage:
 *   node --import @swc-node/register/esm-register artifacts/api-server/scripts/platform-admin.test.mjs
 */

import {
  parsePlatformAdminEmails,
  reconcilePlatformAdmins,
  validateReason,
  clampTtl,
  MAX_ELEVATION_MS,
  MIN_REASON_LENGTH,
} from "../src/lib/platform-admin.ts";

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

function throws(label, fn) {
  checks += 1;
  try {
    fn();
    failures += 1;
    console.error(`  FAIL ${label} (expected a throw, got none)`);
  } catch {
    console.log(`  ok   ${label}`);
  }
}

const quietLogger = { log() {}, warn() {}, error() {} };

console.log("\nPLATFORM_ADMIN_EMAILS parser");

check("empty yields nothing", parsePlatformAdminEmails(""), { emails: [], invalid: [] });
check("undefined yields nothing", parsePlatformAdminEmails(undefined), { emails: [], invalid: [] });
check("null yields nothing", parsePlatformAdminEmails(null), { emails: [], invalid: [] });

check("single address", parsePlatformAdminEmails("ops@example.com").emails, [
  "ops@example.com",
]);
check(
  "addresses are lowercased and trimmed",
  parsePlatformAdminEmails("  OPS@Example.COM ").emails,
  ["ops@example.com"],
);
check(
  "several addresses",
  parsePlatformAdminEmails("a@x.com, b@y.co.uk").emails,
  ["a@x.com", "b@y.co.uk"],
);
check("duplicates collapse", parsePlatformAdminEmails("a@x.com,A@X.com").emails, ["a@x.com"]);

check("a bare word is rejected", parsePlatformAdminEmails("root").emails, []);
check("a domainless address is rejected", parsePlatformAdminEmails("root@localhost").emails, []);
check("an address with a space is rejected", parsePlatformAdminEmails("a b@x.com").emails, []);
check("rejections are reported", parsePlatformAdminEmails("root").invalid, [
  "root (not an email address)",
]);
check(
  "one bad address does not discard the good ones",
  parsePlatformAdminEmails("root,ops@example.com").emails,
  ["ops@example.com"],
);

console.log("\nElevation rules");

check("the ceiling is one hour", MAX_ELEVATION_MS, 60 * 60 * 1000);
check("an absent ttl gets the ceiling", clampTtl(undefined), MAX_ELEVATION_MS);
check("a zero ttl gets the ceiling", clampTtl(0), MAX_ELEVATION_MS);
check("a negative ttl gets the ceiling", clampTtl(-5000), MAX_ELEVATION_MS);
check("nonsense gets the ceiling", clampTtl("forever"), MAX_ELEVATION_MS);
check("a shorter ttl is honoured", clampTtl(5 * 60 * 1000), 5 * 60 * 1000);
// The whole point of a hard ceiling is that asking nicely does not raise it.
check("a longer ttl is clamped", clampTtl(30 * 24 * 60 * 60 * 1000), MAX_ELEVATION_MS);
check("Infinity is clamped", clampTtl(Number.POSITIVE_INFINITY), MAX_ELEVATION_MS);

throws("an empty reason is refused", () => validateReason(""));
throws("a whitespace reason is refused", () => validateReason("        "));
throws("a token reason is refused", () => validateReason("fixing"));
throws("a non-string reason is refused", () => validateReason(42));
check(
  "a real reason is accepted and trimmed",
  validateReason("  investigating ticket 4471  "),
  "investigating ticket 4471",
);
check("the minimum is stated once", MIN_REASON_LENGTH, 12);

console.log("\nBootstrap reconciliation");

/**
 * Pull the first bound value out of a drizzle sql template.
 *
 * This is fiddlier than it looks, and getting it wrong is what made the first
 * run of this suite lie. drizzle does not wrap every interpolated value: a
 * plain string is pushed into queryChunks as a bare string, while other values
 * arrive as a Param object carrying a .value. Reading .value unconditionally
 * therefore yields undefined for exactly the case this suite exercises, every
 * user lookup misses, and reconcile looks like it grants nothing and revokes
 * everything. Unwrap until a primitive falls out, and skip StringChunks, whose
 * .value is the array of literal fragments.
 */
function firstStringParam(chunks) {
  for (const chunk of chunks) {
    if (Array.isArray(chunk?.value)) continue;
    let value = chunk;
    while (value !== null && typeof value === "object" && "value" in value) {
      value = value.value;
    }
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * Fake database. Routes on the leading SQL keyword rather than parsing, and
 * records which statements were issued so revocation can be asserted.
 */
function fakeDb({ admins = [], users = [] } = {}) {
  const statements = [];
  return {
    statements,
    async execute(q) {
      // Recover the literal fragments of the drizzle template to route the call.
      const chunks = q?.queryChunks ?? [];
      const text = chunks
        .map((c) => (Array.isArray(c?.value) ? c.value.join("") : " ? "))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      statements.push(text);

      if (text.startsWith("SELECT user_id, email FROM platform_admins")) {
        return { rows: admins.map((a) => ({ user_id: a.userId, email: a.email })) };
      }
      if (text.startsWith("SELECT id, email FROM")) {
        // The parameter is the email. See firstStringParam for why this is not
        // simply a .value read.
        const param = firstStringParam(chunks);
        const hit = users.find((u) => u.email === String(param));
        return { rows: hit ? [{ id: hit.id, email: hit.email }] : [] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
}

function countStatements(statements, prefix) {
  return statements.filter((s) => s.startsWith(prefix)).length;
}

// An address with an account is granted.
{
  const db = fakeDb({ admins: [], users: [{ id: "u1", email: "ops@example.com" }] });
  const r = await reconcilePlatformAdmins(db, "ops@example.com", quietLogger);
  check("a known address is granted", r.granted, ["ops@example.com"]);
  check("one insert is issued", countStatements(db.statements, "INSERT INTO platform_admins"), 1);
}

// Already granted, so nothing is written. Restarts must not churn.
{
  const db = fakeDb({
    admins: [{ userId: "u1", email: "ops@example.com" }],
    users: [{ id: "u1", email: "ops@example.com" }],
  });
  const r = await reconcilePlatformAdmins(db, "ops@example.com", quietLogger);
  check("an existing grant is unchanged", r.unchanged, ["ops@example.com"]);
  check("no insert on a no-op", countStatements(db.statements, "INSERT INTO platform_admins"), 0);
  check("no delete on a no-op", countStatements(db.statements, "DELETE FROM platform_admins"), 0);
}

// The variable is AUTHORITATIVE. This is the property an additive bootstrap
// gets wrong, leaving a permanent grant that outlives its configuration.
{
  const db = fakeDb({
    admins: [{ userId: "u9", email: "old@example.com" }],
    users: [{ id: "u1", email: "ops@example.com" }],
  });
  const r = await reconcilePlatformAdmins(db, "ops@example.com", quietLogger);
  check("a dropped address is revoked", r.revoked, ["old@example.com"]);
  check("the grant is deleted", countStatements(db.statements, "DELETE FROM platform_admins"), 1);
  check(
    "any live elevation is ended with the grant",
    countStatements(db.statements, "UPDATE platform_elevations"),
    1,
  );
}

// Emptying the variable revokes everybody.
{
  const db = fakeDb({
    admins: [{ userId: "u1", email: "a@x.com" }, { userId: "u2", email: "b@x.com" }],
  });
  const r = await reconcilePlatformAdmins(db, "", quietLogger);
  check("emptying the variable revokes all", r.revoked, ["a@x.com", "b@x.com"]);
  check("both grants deleted", countStatements(db.statements, "DELETE FROM platform_admins"), 2);
}

// An address nobody has signed up with grants nothing and creates nothing.
// Email is an identifier, not an authenticator, so this must not be a way in.
{
  const db = fakeDb({ admins: [], users: [] });
  const r = await reconcilePlatformAdmins(db, "ghost@example.com", quietLogger);
  check("an unknown address is reported", r.unknown, ["ghost@example.com"]);
  check("nothing is granted", r.granted, []);
  check("no user is created", countStatements(db.statements, "INSERT INTO \"user\""), 0);
  check("no grant is inserted", countStatements(db.statements, "INSERT INTO platform_admins"), 0);
}

// A malformed entry is skipped without touching existing grants.
{
  const db = fakeDb({ admins: [{ userId: "u1", email: "keep@example.com" }], users: [{ id: "u1", email: "keep@example.com" }] });
  const r = await reconcilePlatformAdmins(db, "keep@example.com,root", quietLogger);
  check("the malformed entry is reported", r.invalid, ["root (not an email address)"]);
  check("the valid grant survives", r.unchanged, ["keep@example.com"]);
  check("nothing is revoked", r.revoked, []);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} platform-admin check(s) failed`);
  process.exit(1);
}
console.log("Platform admin bootstrap and elevation rules behave as specified.\n");
