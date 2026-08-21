// AcceptInvite.tsx — public landing page for team invitation links
//
// The invite email points here with the org id and the token in the query string.
// The token is the credential, so it is posted to the API immediately and then
// stripped from the address bar so it does not linger in browser history or in a
// referrer header.
//
// Deliberately outside RequireAuth: an invitee has no account yet, which is the
// entire reason the invitation exists.
//
// This page used to have two endings, "ready" and a red "could not be accepted",
// and that collapsed four unrelated situations into one dead end. The worst of them
// showed a red error to somebody who already had access and only needed to sign in,
// then told them to ask for another invitation - which, once redeemed, would send
// them back to the same screen. The API now returns a code per case; this page
// renders the matching next step, and only calls it an error when it is one.

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/queryClient";

type Phase = "working" | "done" | "resolved" | "failed";

/** Codes that are not failures. The token is spent and the person is already in. */
const SIGN_IN_CODES = ["already_member", "already_accepted"];

const BUTTON =
  "inline-block px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700";

export default function AcceptInvite() {
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get("org");
    const token = params.get("token");

    if (!orgId || !token) {
      setPhase("failed");
      setMessage("This invitation link is incomplete. Ask your administrator to resend it.");
      return;
    }

    let cancelled = false;
    apiFetch("/orgs/" + orgId + "/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((res: { email?: string }) => {
        if (cancelled) return;
        setEmail(res?.email ?? "");
        setPhase("done");
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const apiCode = err instanceof ApiError ? err.code : null;
        setCode(apiCode);
        setMessage(
          err instanceof Error ? err.message : "This invitation could not be accepted.",
        );

        // Already a member, or the link was already redeemed. Nothing is wrong, and
        // the token has done its job, so it is cleared from the address bar exactly
        // as the success path clears it.
        if (apiCode !== null && SIGN_IN_CODES.indexOf(apiCode) !== -1) {
          window.history.replaceState({}, "", window.location.pathname);
          setPhase("resolved");
          return;
        }

        setPhase("failed");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const heading =
    code === "superseded"
      ? "Use your most recent invitation"
      : code === "expired"
        ? "This invitation has expired"
        : code === "revoked"
          ? "This invitation was withdrawn"
          : "This invitation could not be accepted";

  const footnote =
    code === "superseded"
      ? "Invitations are single use, so sending a new one retires the old link. The most recent email is the one that works."
      : code === "revoked"
        ? "An administrator can send you a fresh invitation whenever you need one."
        : "Invitation links expire after seven days and can only be used once. Ask whoever invited you to send a new one.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-lg font-bold text-blue-700 mb-6">EnterpriseComply</div>

        {phase === "working" && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Accepting your invitation</h1>
            <p className="text-sm text-slate-500">One moment while we set up your access.</p>
          </>
        )}

        {phase === "done" && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Your access is ready</h1>
            <p className="text-sm text-slate-600 mb-6">
              {email ? email + " has been added to the team." : "You have been added to the team."}{" "}
              Sign in with a magic link to finish setting up your account.
            </p>
            <a href="/sign-in" className={BUTTON}>
              Continue to sign in
            </a>
          </>
        )}

        {phase === "resolved" && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">You already have access</h1>
            <p className="text-sm text-slate-600 mb-6">{message}</p>
            <a href="/sign-in" className={BUTTON}>
              Continue to sign in
            </a>
            <p className="mt-4 text-xs text-slate-500">
              This link had already been used, which is why it did nothing this time. There is
              nothing else for you to do, and no need to ask for another invitation.
            </p>
          </>
        )}

        {phase === "failed" && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">{heading}</h1>
            <p className="text-sm text-red-600 mb-6">{message}</p>
            <p className="text-xs text-slate-500">{footnote}</p>
          </>
        )}
      </div>
    </div>
  );
}
