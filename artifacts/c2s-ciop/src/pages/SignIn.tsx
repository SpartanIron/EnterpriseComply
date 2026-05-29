import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function SignIn() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "signup" && name.trim()) {
        await authClient.signUp.email({
          name: name.trim(),
          email,
          password: crypto.randomUUID(),
          callbackURL: BASE_PATH + "/",
        });
      }
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: BASE_PATH + "/",
      });
      if (result?.error) {
        setError(result.error.message ?? "Could not send magic link. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={`${BASE_PATH}/logo.svg`} className="h-11 w-11 mb-3" alt="" />
          <h1 className="text-xl font-bold text-slate-900">EnterpriseComply</h1>
          <p className="text-sm text-slate-500 mt-0.5">by ColorCode Solutions</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {sent ? (
            <div className="p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-1">
                We sent a secure sign-in link to
              </p>
              <p className="text-sm font-semibold text-slate-800 mb-4">{email}</p>
              <p className="text-xs text-slate-400">The link expires in 10 minutes. No password needed.</p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-7 pt-7 pb-5">
                <h2 className="text-xl font-bold text-slate-900 text-center mb-0.5">Welcome back</h2>
                <p className="text-sm text-slate-500 text-center">
                  {tab === "signin" ? "Sign in to your EnterpriseComply account" : "Create your EnterpriseComply account"}
                </p>
              </div>

              {/* Tabs */}
              <div className="px-7 mb-5">
                <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => { setTab("signin"); setError(""); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                      tab === "signin"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab("signup"); setError(""); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                      tab === "signup"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Sign up
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-3">
                {tab === "signup" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      placeholder="Jane Smith"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    placeholder="you@company.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send magic link
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-slate-400 pt-1">
                  No password needed. We will email you a secure link.
                </p>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Enterprise-grade security
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    14-day free trial
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    No credit card
                  </span>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          By continuing you agree to our{" "}
          <a href="#" className="underline hover:text-slate-600">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
