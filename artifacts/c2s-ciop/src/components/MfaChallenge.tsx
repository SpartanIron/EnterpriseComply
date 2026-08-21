import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/queryClient";

/**
 * Step-up prompt.
 *
 * Org-scoped API routes answer 403 mfa_challenge_required when a session has not
 * presented a code since the user enrolled an authenticator app. apiFetch broadcasts
 * that as an event and this listens once at the top of the tree, so no page has to
 * know anything about MFA.
 *
 * A successful verification reloads rather than replaying whatever failed. By the time
 * the prompt appears several queries have usually failed, and a reload is the honest way
 * back to a consistent screen.
 */
export default function MfaChallenge() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onChallenge() {
      setOpen(true);
    }
    window.addEventListener("ec:mfa-challenge", onChallenge);
    return () => window.removeEventListener("ec:mfa-challenge", onChallenge);
  }, []);

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await apiFetch("/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
      });
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "That code is not valid.");
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-slate-800">Two-factor verification</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter the six digit code from your authenticator app. A backup code works here too.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="123456"
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-lg font-mono tracking-widest text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || code.trim().length === 0}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Verifying..." : "Verify"}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Codes are checked at most five times a minute, so wait a moment if you mistype more than a few times.
        </p>
      </div>
    </div>
  );
}
