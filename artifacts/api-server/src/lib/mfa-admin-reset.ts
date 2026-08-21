// mfa-admin-reset.ts — who may clear another member's authenticator, and when
//
// Resetting somebody else's second factor is privileged and destructive: between
// the reset and their re-enrolment that account is protected by one factor. The
// rules therefore live here, as pure functions, so they are the single written
// description of who may do this to whom, and so they can be unit tested without
// a database, a session or a running server.
//
// The path exists because the alternative is worse. Once an organisation turns on
// MFA enforcement, a member who loses their phone and has spent their backup codes
// cannot remove their own authenticator - self-service removal is refused while the
// policy is on, by design. Without an administrator reset the only remaining fix is
// a hand-edited database row, which is exactly the kind of unlogged, unreviewable
// change this product exists to eliminate.

/** Stable machine-readable denial. The UI shows the message; it switches on the code. */
export type ResetDenialCode =
  | "actor_not_privileged"
  | "target_not_in_org"
  | "self_reset_not_allowed"
  | "owner_reset_requires_owner"
  | "actor_mfa_required"
  | "confirmation_mismatch"
  | "target_not_enrolled";

export interface ResetDenial {
  error: ResetDenialCode;
  message: string;
  status: 400 | 403 | 404;
}

export interface ResetRequest {
  actorUserId: string;
  actorRole: string | null | undefined;
  /** Whether the actor has an authenticator app of their own. */
  actorEnrolled: boolean;
  targetUserId: string;
  targetRole: string | null | undefined;
  targetEmail: string;
  /** Whether the target currently has an authenticator app to clear. */
  targetEnrolled: boolean;
  /** Whether the target is a member of the same organisation as the actor. */
  targetInOrg: boolean;
  /** The address the actor typed to confirm. Untrusted input. */
  confirmEmail: unknown;
}

/** Only these two roles may reset an authenticator. Deliberately not derived from
 *  ROLE_HIERARCHY: a future role that happens to sort above admin should not
 *  silently inherit the ability to strip second factors off other people. */
export const RESET_CAPABLE_ROLES: readonly string[] = ["owner", "admin"];

export function normaliseEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Return the reason the reset must be refused, or null when it may proceed.
 *
 * Returning a value rather than throwing keeps this importable from a plain test
 * file with no Nest dependency; the service turns a denial into the matching HTTP
 * exception.
 *
 * The order is chosen so that an unprivileged caller learns nothing about the org:
 * privilege is checked before membership, so a viewer cannot use this endpoint to
 * enumerate which member ids exist.
 */
export function checkAdminMfaReset(req: ResetRequest): ResetDenial | null {
  if (!RESET_CAPABLE_ROLES.includes(String(req.actorRole ?? ""))) {
    return {
      error: "actor_not_privileged",
      message: "Only an owner or an admin can reset a member's authenticator app.",
      status: 403,
    };
  }

  if (!req.targetInOrg) {
    return {
      error: "target_not_in_org",
      message: "That member is not part of this organization.",
      status: 404,
    };
  }

  if (req.actorUserId === req.targetUserId) {
    return {
      error: "self_reset_not_allowed",
      message:
        "Use Remove authenticator app on your own Security page instead. That path costs a valid code, so a stolen session cannot strip its own second factor.",
      status: 403,
    };
  }

  if (String(req.targetRole ?? "") === "owner" && String(req.actorRole ?? "") !== "owner") {
    return {
      error: "owner_reset_requires_owner",
      message: "Only another owner can reset an owner's authenticator app.",
      status: 403,
    };
  }

  if (!req.actorEnrolled) {
    return {
      error: "actor_mfa_required",
      message:
        "Set up your own authenticator app first. Resetting somebody else's second factor from an account that has none would be the weakest link in the chain.",
      status: 403,
    };
  }

  if (normaliseEmail(req.confirmEmail) !== normaliseEmail(req.targetEmail)) {
    return {
      error: "confirmation_mismatch",
      message: "Type the member's email address exactly to confirm the reset.",
      status: 400,
    };
  }

  if (!req.targetEnrolled) {
    return {
      error: "target_not_enrolled",
      message: "That member has no authenticator app set up, so there is nothing to reset.",
      status: 400,
    };
  }

  return null;
}
