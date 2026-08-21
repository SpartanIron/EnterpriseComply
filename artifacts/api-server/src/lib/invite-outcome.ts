// invite-outcome.ts — one place that decides what a failed invitation redemption means
//
// The accept endpoint used to collapse five different situations into one sentence,
// "This invitation is no longer valid." Somebody who clicks a link that was
// superseded, revoked, already redeemed, or that belongs to an address already on
// the team sees the same red dead end in all four cases — and in three of them the
// correct next step is simply to sign in, not to chase a new invitation.
//
// The classification is a pure function with no database and no framework imports,
// so it can be unit tested directly, and so the API and the invitation page cannot
// drift apart about what a code means.

/** Stable machine-readable outcome. The invitation page switches its copy on this. */
export type InviteOutcomeCode =
  | "already_member"
  | "already_accepted"
  | "superseded"
  | "revoked"
  | "expired"
  | "invalid";

/** What the invitee should do next. Two of these are not failures at all. */
export type InviteNextStep = "sign_in" | "open_newest_email" | "ask_for_new_invite";

export interface InviteOutcome {
  error: InviteOutcomeCode;
  message: string;
  nextStep: InviteNextStep;
  /** HTTP status the controller maps this to. */
  status: 403 | 404 | 409;
}

export interface InviteFacts {
  /** Row status - pending, accepted, revoked or expired - or null when no token matched. */
  status: string | null;
  expiresAt?: string | Date | null;
  /** A newer pending invitation exists for the same address in the same org. */
  hasNewerPending?: boolean;
  /** The invited address is already a member of this org. */
  alreadyMember?: boolean;
  /** Injected so the tests do not depend on wall time. */
  now?: number;
}

function isExpired(facts: InviteFacts): boolean {
  if (!facts.expiresAt) return false;
  const at = new Date(facts.expiresAt).getTime();
  if (!Number.isFinite(at)) return false;
  return at < (facts.now ?? Date.now());
}

/**
 * Decide what to tell the invitee when a link cannot be redeemed.
 *
 * Order matters, and membership is checked first on purpose: it is the one fact
 * that makes the rest of the question moot. If the address is already on the team
 * then the link being stale is irrelevant, and telling that person to ask for a
 * new invitation sends them round a loop they cannot exit. That loop is the dead
 * end this function exists to remove.
 */
export function classifyInvite(facts: InviteFacts): InviteOutcome {
  if (facts.alreadyMember) {
    return {
      error: "already_member",
      message:
        "You already have access to this organization. Sign in with a magic link to continue.",
      nextStep: "sign_in",
      status: 409,
    };
  }

  if (facts.status === null || facts.status === undefined) {
    return {
      error: "invalid",
      message:
        "This invitation link is not valid. It may have been copied incompletely, or a newer invitation may have replaced it.",
      nextStep: "ask_for_new_invite",
      status: 404,
    };
  }

  if (facts.status === "accepted") {
    return {
      error: "already_accepted",
      message: "This invitation has already been used. Sign in with a magic link to continue.",
      nextStep: "sign_in",
      status: 409,
    };
  }

  if (facts.hasNewerPending) {
    return {
      error: "superseded",
      message:
        "A newer invitation was sent to this address. Open the most recent invitation email and use the link in it.",
      nextStep: "open_newest_email",
      status: 403,
    };
  }

  if (facts.status === "revoked") {
    return {
      error: "revoked",
      message: "This invitation was withdrawn by an administrator, so it can no longer be used.",
      nextStep: "ask_for_new_invite",
      status: 403,
    };
  }

  if (facts.status === "expired" || isExpired(facts)) {
    return {
      error: "expired",
      message: "This invitation has expired. Invitation links are valid for seven days.",
      nextStep: "ask_for_new_invite",
      status: 403,
    };
  }

  return {
    error: "invalid",
    message: "This invitation can no longer be used. Ask whoever invited you to send a new one.",
    nextStep: "ask_for_new_invite",
    status: 403,
  };
}
