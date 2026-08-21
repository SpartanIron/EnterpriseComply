/**
 * Unit tests for the two decision tables added with the administrator MFA reset:
 *
 *   classifyInvite()      - what a failed invitation redemption actually means
 *   checkAdminMfaReset()   - who may clear another member authenticator, and when
 *
 * No API server, no database and no network. Both functions are pure precisely so
 * that the rules can be pinned here rather than discovered in production.
 *
 * The properties under test are the ones that were wrong or missing before:
 *
 *   - an address already on the team is told to sign in, never to chase a new link
 *   - a superseded link points at the newest email, not at nothing
 *   - revoked, expired and unknown are three different answers
 *   - nobody can reset their own second factor through the administrator path
 *   - an admin cannot reset an owner; an owner can
 *   - an unenrolled administrator cannot strip a factor off somebody else
 *   - the typed confirmation must match, case and whitespace aside
 *
 * Usage:
 *   node --import @swc-node/register/esm-register artifacts/api-server/scripts/mfa-reset-and-invites.test.mjs
 */

import { classifyInvite } from "../src/lib/invite-outcome.ts";
import { checkAdminMfaReset, normaliseEmail } from "../src/lib/mfa-admin-reset.ts";

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

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);
const FUTURE = new Date(NOW + DAY).toISOString();
const PAST = new Date(NOW - DAY).toISOString();

console.log("\nclassifyInvite - membership outranks everything");

// The reported dead end. A revoked link belonging to somebody who is already a
// member used to read "This invitation is no longer valid", which sent them to ask
// for a replacement they did not need and could not use.
{
  const o = classifyInvite({ status: "revoked", expiresAt: PAST, alreadyMember: true, now: NOW });
  check("an existing member is told to sign in", o.error, "already_member");
  check("and the next step is not a new invitation", o.nextStep, "sign_in");
  check("reported as a conflict, not a not-found", o.status, 409);
}

{
  const o = classifyInvite({
    status: "expired",
    expiresAt: PAST,
    hasNewerPending: true,
    alreadyMember: true,
    now: NOW,
  });
  check("membership wins over a newer pending invitation", o.error, "already_member");
}

console.log("\nclassifyInvite - the four genuine failures stay distinct");

{
  const o = classifyInvite({ status: null, now: NOW });
  check("an unknown token is invalid", o.error, "invalid");
  check("and answers 404", o.status, 404);
}

{
  const o = classifyInvite({ status: "accepted", expiresAt: FUTURE, now: NOW });
  check("a redeemed link says already accepted", o.error, "already_accepted");
  check("and still routes to sign in", o.nextStep, "sign_in");
}

{
  const o = classifyInvite({ status: "revoked", expiresAt: FUTURE, hasNewerPending: true, now: NOW });
  check("a superseded link points at the newest email", o.error, "superseded");
  check("with the matching next step", o.nextStep, "open_newest_email");
}

{
  const o = classifyInvite({ status: "revoked", expiresAt: FUTURE, now: NOW });
  check("a withdrawn link with no successor says revoked", o.error, "revoked");
  check("and asks for a new invitation", o.nextStep, "ask_for_new_invite");
}

{
  const o = classifyInvite({ status: "pending", expiresAt: PAST, now: NOW });
  check("a pending link past its expiry is expired", o.error, "expired");
}

{
  const o = classifyInvite({ status: "expired", expiresAt: FUTURE, now: NOW });
  check("an expired status is trusted even when the timestamp is not", o.error, "expired");
}

// Nothing here may throw on a malformed timestamp: the invitation page is public and
// unauthenticated, so a 500 on this path is a public 500.
{
  const o = classifyInvite({ status: "revoked", expiresAt: "not a date", now: NOW });
  check("an unparseable expiry does not throw", o.error, "revoked");
}

console.log("\ncheckAdminMfaReset - the happy path");

const base = {
  actorUserId: "admin-1",
  actorRole: "admin",
  actorEnrolled: true,
  targetUserId: "member-2",
  targetRole: "analyst",
  targetEmail: "lost@example.com",
  targetEnrolled: true,
  targetInOrg: true,
  confirmEmail: "lost@example.com",
};

check("an enrolled admin resetting an analyst is allowed", checkAdminMfaReset(base), null);
check(
  "the confirmation is compared case and whitespace insensitively",
  checkAdminMfaReset({ ...base, confirmEmail: "  LOST@Example.com " }),
  null,
);
check("an owner may reset an owner", checkAdminMfaReset({ ...base, actorRole: "owner", targetRole: "owner" }), null);

console.log("\ncheckAdminMfaReset - the refusals that matter");

check(
  "nobody resets their own second factor through this path",
  checkAdminMfaReset({ ...base, targetUserId: "admin-1", targetEmail: "lost@example.com" })?.error,
  "self_reset_not_allowed",
);
check(
  "an admin cannot reset an owner",
  checkAdminMfaReset({ ...base, targetRole: "owner" })?.error,
  "owner_reset_requires_owner",
);
check(
  "an unenrolled admin cannot strip somebody else factor",
  checkAdminMfaReset({ ...base, actorEnrolled: false })?.error,
  "actor_mfa_required",
);
check(
  "a compliance manager is not privileged enough",
  checkAdminMfaReset({ ...base, actorRole: "compliance_manager" })?.error,
  "actor_not_privileged",
);
check(
  "a viewer is refused before membership is even looked at",
  checkAdminMfaReset({ ...base, actorRole: "viewer", targetInOrg: false })?.error,
  "actor_not_privileged",
);
check(
  "a target in another org is not found",
  checkAdminMfaReset({ ...base, targetInOrg: false })?.error,
  "target_not_in_org",
);
check(
  "a mistyped confirmation is refused",
  checkAdminMfaReset({ ...base, confirmEmail: "lost@example.co" })?.error,
  "confirmation_mismatch",
);
check(
  "a missing confirmation is refused",
  checkAdminMfaReset({ ...base, confirmEmail: undefined })?.error,
  "confirmation_mismatch",
);
check(
  "an object posted in place of the confirmation is refused, not coerced",
  checkAdminMfaReset({ ...base, confirmEmail: { toString: () => "lost@example.com" } })?.error,
  "confirmation_mismatch",
);
check(
  "there is nothing to reset when the target has no authenticator",
  checkAdminMfaReset({ ...base, targetEnrolled: false })?.error,
  "target_not_enrolled",
);
check(
  "a null role is not privileged",
  checkAdminMfaReset({ ...base, actorRole: null })?.error,
  "actor_not_privileged",
);

console.log("\nnormaliseEmail");
check("trims and lowercases", normaliseEmail("  A@B.COM "), "a@b.com");
check("a non-string becomes empty rather than \"undefined\"", normaliseEmail(undefined), "");
check("a number becomes empty", normaliseEmail(42), "");

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} invite/mfa-reset check(s) failed`);
  process.exit(1);
}
console.log("Invitation outcomes and administrator reset rules behave as specified.");
