// MemberMfaAdmin.tsx — the administrator authenticator reset panel
//
// Lives in its own file rather than inside the 1,000-line Settings page, because a
// destructive security control is the last thing that should be hard to find and
// review.
//
// Why this exists: once org-wide MFA enforcement is on, self-service removal is
// refused, so a member who loses their phone and has spent their backup codes is
// locked out with no route back. The alternative to this panel is somebody editing
// the two_factor table by hand, with no reason recorded and no trace of who did it.
//
// The friction here is deliberate. Retyping the address is the same pattern GitHub
// uses before it deletes a repository, and it is there because the failure mode of a
// misplaced click is stripping the second factor off the wrong account.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";
import { authClient } from "@/lib/auth-client";

interface Member {
  id: string;
  clerkUserId: string;
  email: string;
  role: string;
  mfaEnrolled?: boolean;
}

export default function MemberMfaAdmin() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const session = authClient.useSession();
  const myEmail = String((session.data?.user as { email?: string } | undefined)?.email ?? "");

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const members = useQuery<{ members: Member[] }>({
    queryKey: ["org", orgId, "members"],
    queryFn: () => apiFetch("/orgs/" + orgId + "/members"),
    enabled: !!orgId,
  });

  const reset = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch("/orgs/" + orgId + "/members/" + memberId + "/mfa-reset", {
        method: "POST",
        body: JSON.stringify({ confirmEmail }),
      }),
    onSuccess: (res: { email?: string; mustReenroll?: boolean }) => {
      setDone(
        (res?.email ?? "That member") +
          " must set up an authenticator app again" +
          (res?.mustReenroll ? " before they can use the platform." : "."),
      );
      setError("");
      setOpenFor(null);
      setConfirmEmail("");
      // Both the list and the coverage figure above it are now stale.
      qc.invalidateQueries({ queryKey: ["org", orgId, "members"] });
      qc.invalidateQueries({ queryKey: ["mfa", "policy", orgId] });
    },
    onError: (err: unknown) => {
      setDone("");
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "The reset could not be completed.",
      );
    },
  });

  const rows = members.data?.members ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">Member Authenticators</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Who has an authenticator app, and the recovery path for a member who has lost theirs.
          Every reset is written to the audit log with your name against it. NIST IA-5(1), CMMC
          IA.L2-3.5.5, SOC 2 CC6.1.
        </p>
      </div>

      <div className="p-5">
        {members.isLoading && <p className="text-xs text-slate-500">Loading members...</p>}

        {!members.isLoading && rows.length === 0 && (
          <p className="text-xs text-slate-500">No members to show.</p>
        )}

        <div className="divide-y divide-slate-100">
          {rows.map((m) => {
            const isSelf = m.email.toLowerCase() === myEmail.toLowerCase();
            const enrolled = !!m.mfaEnrolled;
            return (
              <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.email}</p>
                    <p className="text-xs text-slate-500 capitalize">{m.role.replace(/_/g, " ")}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={
                        enrolled
                          ? "text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700"
                          : "text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
                      }
                    >
                      {enrolled ? "Enrolled" : "Not enrolled"}
                    </span>

                    {isSelf ? (
                      // Deliberately not offered. Removing your own second factor through an
                      // admin path would let a stolen session disarm itself without a code;
                      // the self-service control above costs one.
                      <span className="text-xs text-slate-400">You</span>
                    ) : enrolled ? (
                      <button
                        onClick={() => {
                          setOpenFor(openFor === m.id ? null : m.id);
                          setConfirmEmail("");
                          setError("");
                          setDone("");
                        }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        {openFor === m.id ? "Cancel" : "Reset authenticator"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Nothing to reset</span>
                    )}
                  </div>
                </div>

                {openFor === m.id && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs text-red-800 leading-relaxed">
                      This clears the authenticator app and the backup codes for {m.email}, and
                      signs their trusted sessions back down to one factor. They will be asked to
                      set up a new authenticator the next time they sign in. Confirm by typing
                      their email address.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder={m.email}
                        autoComplete="off"
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                      <button
                        onClick={() => reset.mutate(m.id)}
                        disabled={
                          reset.isPending ||
                          confirmEmail.trim().toLowerCase() !== m.email.toLowerCase()
                        }
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {reset.isPending ? "Resetting..." : "Reset"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        {done && <p className="mt-3 text-xs font-semibold text-green-700">{done}</p>}
      </div>
    </div>
  );
}
