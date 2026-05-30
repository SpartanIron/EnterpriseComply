import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type View = "magic" | "totp" | "sent";
type Tab = "signin" | "signup";

export default function SignIn() {
      const [tab, setTab] = useState<Tab>("signin");
      const [view, setView] = useState<View>("magic");
      const [email, setEmail] = useState("");
      const [name, setName] = useState("");
      const [code, setCode] = useState("");
      const [error, setError] = useState("");
      const [loading, setLoading] = useState(false);
      const [googleLoading, setGoogleLoading] = useState(false);
      const [backupMode, setBackupMode] = useState(false);

  function reset() {
          setError("");
          setCode("");
          setEmail("");
          setName("");
  }

  async function handleGoogle() {
          setError("");
          setGoogleLoading(true);
          try {
                    await authClient.signIn.social({
                                provider: "google",
                                callbackURL: BASE_PATH + "/",
                    });
          } catch {
                    setError("Google sign-in failed. Please try again.");
                    setGoogleLoading(false);
          }
  }

  async function handleMagicLink(e: React.FormEvent) {
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
                                setView("sent");
                    }
          } catch {
                    setError("Something went wrong. Please try again.");
          } finally {
                    setLoading(false);
          }
  }

  async function handleTotp(e: React.FormEvent) {
          e.preventDefault();
          setError("");
          setLoading(true);
          try {
                    let result;
                    if (backupMode) {
                                result = await (authClient.twoFactor as any).verifyBackupCode?.({ code: code.replace(/-/g, "").toUpperCase() });
                                if (!result || (result as any)?.error) {
                                              setError((result as any)?.error?.message ?? "Invalid backup code.");
                                              return;
                                }
                    } else {
                                result = await authClient.twoFactor.verifyTotp({ code });
                                if ((result as any)?.error) {
                                              setError((result as any).error.message ?? "Invalid code. Check your authenticator app and try again.");
                                              return;
                                }
                    }
          } catch {
                    setError("Invalid or expired code. Please try again.");
          } finally {
                    setLoading(false);
          }
  }

  if (view === "sent") {
          return (
                    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
                                <div className="w-full max-w-sm">
                                          <LogoHeader />
                                          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
                                                      <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                                                                    <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                    </svg>svg>
                                                      </div>div>
                                                      <h2 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h2>h2>
                                                      <p className="text-sm text-slate-500 leading-relaxed mb-1">We sent a secure sign-in link to</p>p>
                                                      <p className="text-sm font-semibold text-slate-800 mb-4">{email}</p>p>
                                                      <p className="text-xs text-slate-400 mb-5">The link expires in 15 minutes. No password needed.</p>p>
                                                      <button
                                                                        onClick={() => setView("totp")}
                                                                        className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors mb-3"
                                                                      >
                                                                    I&apos;ll use my authenticator app instead
                                                      </button>button>
                                                      <button
                                                                        onClick={() => { reset(); setView("magic"); }}
                                                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                                      >
                                                                    Use a different email
                                                      </button>button>
                                          </div>div>
                                </div>div>
                    </div>div>
                  );
  }
    
      if (view === "totp") {
              return (
                        <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
                                <div className="w-full max-w-sm">
                                          <LogoHeader />
                                          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                                                      <div className="px-7 pt-7 pb-5 text-center">
                                                                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                                                                                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                                        </svg>svg>
                                                                    </div>div>
                                                                    <h2 className="text-xl font-bold text-slate-900 mb-1">Authenticator app</h2>h2>
                                                                    <p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app to complete sign-in.</p>p>
                                                          {email && (
                                            <p className="text-xs text-slate-400 text-center mt-1">
                                                              Signing in as <strong className="text-slate-600">{email}</strong>strong>
                                            </p>p>
                                                                    )}
                                                      </div>div>
                                          
                                                      <form onSubmit={handleTotp} className="px-7 pb-7 space-y-3">
                                                                    <div>
                                                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{backupMode ? "Backup code" : "6-digit code"}</label>label>
                                                                                    <input
                                                                                                          type="text"
                                                                                                          inputMode="numeric"
                                                                                                          pattern={backupMode ? "[A-Za-z0-9-]{9}" : "\\d{6}"}
                                                                                                          maxLength={backupMode ? 9 : 6}
                                                                                                          required
                                                                                                          value={code}
                                                                                                          onChange={(e) => setCode(backupMode ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                                                                          className="w-full px-3.5 py-3 rounded-lg border border-slate-300 text-center text-2xl font-mono tracking-[0.5em] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                                                                                          placeholder="000000"
                                                                                                          autoFocus
                                                                                                          autoComplete={backupMode ? "off" : "one-time-code"}
                                                                                                        />
                                                                    </div>div>
                                                      
                                                          {error && (
                                            <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                                {error}
                                            </div>div>
                                                                    )}
                                                      
                                                                    <button
                                                                                        type="submit"
                                                                                        disabled={loading || (backupMode ? code.replace(/-/g, "").length !== 8 : code.length !== 6)}
                                                                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
                                                                                      >
                                                                        {loading ? "Verifying..." : "Verify code"}
                                                                    </button>button>
                                                      
                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => { setBackupMode(!backupMode); setCode(""); setError(""); }}
                                                                                        className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                                                                                      >
                                                                        {backupMode ? "Back to authenticator app" : "Use backup code instead"}
                                                                    </button>button>
                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => { reset(); setBackupMode(false); setView("magic"); }}
                                                                                        className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                                                                                      >
                                                                                    Back to magic link
                                                                    </button>button>
                                                      </form>form>
                                          
                                                      <div className="px-7 pb-5 text-center">
                                                                    <p className="text-xs text-slate-400">
                                                                                    Codes refresh every 30 seconds. Make sure your device clock is accurate.
                                                                    </p>p>
                                                      </div>div>
                                          </div>div>
                                </div>div>
                        </div>div>
                      );
      }
    
      return (
              <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
                    <div className="w-full max-w-sm">
                            <LogoHeader />
                            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                                      <div className="px-7 pt-7 pb-5">
                                                  <h2 className="text-xl font-bold text-slate-900 text-center mb-0.5">Welcome back</h2>h2>
                                                  <p className="text-sm text-slate-500 text-center">
                                                      {tab === "signin" ? "Sign in to your EnterpriseComply account" : "Create your EnterpriseComply account"}
                                                  </p>p>
                                      </div>div>
                            
                                      <div className="px-7 mb-5">
                                                  <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setTab("signin"); setError(""); }}
                                                                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                                                                  >
                                                                                Sign in
                                                                </button>button>
                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setTab("signup"); setError(""); }}
                                                                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                                                                  >
                                                                                Sign up
                                                                </button>button>
                                                  </div>div>
                                      </div>div>
                            
                                      <div className="px-7 mb-4">
                                                  <button
                                                                    type="button"
                                                                    onClick={handleGoogle}
                                                                    disabled={googleLoading}
                                                                    className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 transition-colors flex items-center justify-center gap-2.5"
                                                                  >
                                                      {googleLoading ? (
                                                                                      <>
                                                                                                        <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                                                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                                                            </svg>svg>
                                                                                                        Redirecting...
                                                                                          </>>
                                                                                    ) : (
                                                                                      <>
                                                                                                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                                                                                                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                                                                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                                                                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                                                                                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                                                                            </svg>svg>
                                                                                                        Continue with Google
                                                                                          </>>
                                                                                    )}
                                                  </button>button>
                                      </div>div>
                            
                                      <div className="px-7 mb-4">
                                                  <div className="relative flex items-center gap-3">
                                                                <div className="flex-1 h-px bg-slate-200" />
                                                                <span className="text-xs text-slate-400 font-medium flex-shrink-0">or continue with email</span>span>
                                                                <div className="flex-1 h-px bg-slate-200" />
                                                  </div>div>
                                      </div>div>
                            
                                      <form onSubmit={handleMagicLink} className="px-7 pb-4 space-y-3">
                                          {tab === "signup" && (
                                <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>label>
                                                <input
                                                                      type="text"
                                                                      required
                                                                      value={name}
                                                                      onChange={e => setName(e.target.value)}
                                                                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                                                                      placeholder="Jane Smith"
                                                                      autoComplete="name"
                                                                    />
                                </div>div>
                                                  )}
                                      
                                                  <div>
                                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>label>
                                                                <input
                                                                                    type="email"
                                                                                    required
                                                                                    value={email}
                                                                                    onChange={e => setEmail(e.target.value)}
                                                                                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                                                                                    placeholder="you@company.com"
                                                                                    autoComplete="email"
                                                                                    autoFocus
                                                                                  />
                                                  </div>div>
                                      
                                          {error && (
                                <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {error}
                                </div>div>
                                                  )}
                                      
                                                  <button
                                                                    type="submit"
                                                                    disabled={loading}
                                                                    className="w-full py-2.5 px-4 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                                                                    style={{ background: loading ? "#b45309" : "#d97706" }}
                                                                  >
                                                      {loading ? (
                                                                                      <>
                                                                                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                                                            </svg>svg>
                                                                                                        Sending...
                                                                                          </>>
                                                                                    ) : (
                                                                                      <>
                                                                                                        Send magic link
                                                                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                                                                            </svg>svg>
                                                                                          </>>
                                                                                    )}
                                                  </button>button>
                                      
                                                  <p className="text-xs text-center text-slate-400 pt-0.5">
                                                                No password needed. We will email you a secure link.
                                                  </p>p>
                                      </form>form>
                            
                                      <div className="px-7 pb-4">
                                                  <div className="relative flex items-center gap-3 mb-4">
                                                                <div className="flex-1 h-px bg-slate-200" />
                                                                <span className="text-xs text-slate-400 font-medium flex-shrink-0">or</span>span>
                                                                <div className="flex-1 h-px bg-slate-200" />
                                                  </div>div>
                                                  <button
                                                                    type="button"
                                                                    onClick={() => { setError(""); setView("totp"); }}
                                                                    className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2"
                                                                  >
                                                                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                </svg>svg>
                                                                Use authenticator app instead
                                                  </button>button>
                                      </div>div>
                            
                                      <div className="mx-7 mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                  <div className="flex items-start gap-3">
                                                                <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                                                <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                                                </svg>svg>
                                                                </div>div>
                                                                <div>
                                                                                <p className="text-xs font-semibold text-slate-700 mb-0.5">Authenticator App (2FA) supported</p>p>
                                                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                                                                  After signing in, you will be prompted for a 6-digit code from Google Authenticator, Authy, or any TOTP app. Enable it in{" "}
                                                                                                  <span className="font-medium text-slate-600">Settings {"→"} Security</span>span> after signing in.
                                                                                </p>p>
                                                                </div>div>
                                                  </div>div>
                                      </div>div>
                            
                                      <div className="px-7 pb-5 flex items-center justify-center gap-4">
                                                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                                </svg>svg>
                                                                Enterprise-grade security
                                                  </span>span>
                                                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>svg>
                                                                14-day free trial
                                                  </span>span>
                                                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>svg>
                                                                No credit card
                                                  </span>span>
                                      </div>div>
                            </div>div>
                    
                            <p className="text-center text-xs text-slate-400 mt-5">
                                      By continuing you agree to our{" "}
                                      <a href="#" className="underline hover:text-slate-600">Terms of Service</a>a>
                                {" "}and{" "}
                                      <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>a>.
                            </p>p>
                    </div>div>
              </div>div>
            );
}

function LogoHeader() {
      return (
              <div className="flex flex-col items-center mb-6">
                    <img src={`${BASE_PATH}/logo.svg`} className="h-11 w-11 mb-3" alt="" />
                    <h1 className="text-xl font-bold text-slate-900">EnterpriseComply</h1>h1>
                    <p className="text-sm text-slate-500 mt-0.5">by ColorCode Solutions</p>p>
              </div>div>
            );
}</></></></></div>
