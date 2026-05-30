import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const CALLBACK_URL = "https://grc.colorcodesolutions.com/dashboard";

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

function reset() { setError(""); setCode(""); setEmail(""); setName(""); }

async function handleGoogle() {
setError("");
setGoogleLoading(true);
try {
await authClient.signIn.social({ provider: "google", callbackURL: CALLBACK_URL });
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
await authClient.signUp.email({ name: name.trim(), email, password: crypto.randomUUID(), callbackURL: CALLBACK_URL });
}
const result = await authClient.signIn.magicLink({ email, callbackURL: CALLBACK_URL });
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
const result = await authClient.twoFactor.verifyTotp({ code });
if ((result as any)?.error) { setError((result as any).error.message ?? "Invalid code."); return; }
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
<h2 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h2>
<p className="text-sm text-slate-500 mb-1">We sent a secure sign-in link to</p>
<p className="text-sm font-semibold text-slate-800 mb-4">{email}</p>
<p className="text-xs text-slate-400 mb-5">The link expires in 15 minutes.</p>
<button onClick={() => setView("totp")} className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 mb-3">I will use my authenticator app instead</button>
<button onClick={() => { reset(); setView("magic"); }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Use a different email</button>
</div>
</div>
</div>
);
}

if (view === "totp") {
return (
<div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
<div className="w-full max-w-sm">
<LogoHeader />
<div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
<div className="px-7 pt-7 pb-5 text-center">
<h2 className="text-xl font-bold text-slate-900 mb-1">Authenticator app</h2>
<p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
</div>
<form onSubmit={handleTotp} className="px-7 pb-7 space-y-3">
<input type="text" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full px-3.5 py-3 rounded-lg border border-slate-300 text-center text-2xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="000000" autoFocus autoComplete="one-time-code" />
{error && <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
<button type="submit" disabled={loading || code.length !== 6} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">{loading ? "Verifying..." : "Verify code"}</button>
<button type="button" onClick={() => { reset(); setView("magic"); }} className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50">Back to magic link</button>
</form>
</div>
</div>
</div>
);
}

return (
<div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
<div className="w-full max-w-sm">
<LogoHeader />
<div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
<div className="px-7 pt-7 pb-5">
<h2 className="text-xl font-bold text-slate-900 text-center mb-0.5">Welcome back</h2>
<p className="text-sm text-slate-500 text-center">{tab === "signin" ? "Sign in to your EnterpriseComply account" : "Create your EnterpriseComply account"}</p>
</div>
<div className="px-7 mb-5">
<div className="flex rounded-lg bg-slate-100 p-1 gap-1">
<button type="button" onClick={() => { setTab("signin"); setError(""); }} className={`flex-1 py-2 text-sm font-semibold rounded-md ${tab === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Sign in</button>
<button type="button" onClick={() => { setTab("signup"); setError(""); }} className={`flex-1 py-2 text-sm font-semibold rounded-md ${tab === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Sign up</button>
</div>
</div>
<div className="px-7 mb-4">
<button type="button" onClick={handleGoogle} disabled={googleLoading} className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-2.5">
{googleLoading ? "Redirecting..." : "Continue with Google"}
</button>
</div>
<div className="px-7 mb-4">
<div className="relative flex items-center gap-3">
<div className="flex-1 h-px bg-slate-200" />
<span className="text-xs text-slate-400 font-medium">or continue with email</span>
<div className="flex-1 h-px bg-slate-200" />
</div>
</div>
<form onSubmit={handleMagicLink} className="px-7 pb-4 space-y-3">
{tab === "signup" && (
<div>
<label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
<input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Jane Smith" />
</div>
)}
<div>
<label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="you@company.com" autoComplete="email" autoFocus />
</div>
{error && <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
<button type="submit" disabled={loading} className="w-full py-2.5 px-4 disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2" style={{ background: "#d97706" }}>
{loading ? "Sending..." : "Send magic link →"}
</button>
<p className="text-xs text-center text-slate-400">No password needed. We will email you a secure link.</p>
</form>
<div className="px-7 pb-4">
<div className="relative flex items-center gap-3 mb-4">
<div className="flex-1 h-px bg-slate-200" />
<span className="text-xs text-slate-400">or</span>
<div className="flex-1 h-px bg-slate-200" />
</div>
<button type="button" onClick={() => { setError(""); setView("totp"); }} className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
Use authenticator app instead
</button>
</div>
<div className="mx-7 mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
<p className="text-xs font-semibold text-slate-700 mb-0.5">Authenticator App (2FA) supported</p>
<p className="text-xs text-slate-500">After signing in, you will be prompted for a 6-digit code from Google Authenticator, Authy, or any TOTP app. Enable it in Settings after signing in.</p>
</div>
<div className="px-7 pb-5 flex items-center justify-center gap-4">
<span className="text-xs text-slate-400">Enterprise-grade security</span>
<span className="text-xs text-green-500">14-day free trial</span>
<span className="text-xs text-slate-400">No credit card</span>
</div>
</div>
<p className="text-center text-xs text-slate-400 mt-5">By continuing you agree to our Terms of Service and Privacy Policy.</p>
</div>
</div>
);
}

function LogoHeader() {
return (
<div className="flex flex-col items-center mb-6">
<img src={`${BASE_PATH}/logo.svg`} className="h-11 w-11 mb-3" alt="" />
<h1 className="text-xl font-bold text-slate-900">EnterpriseComply</h1>
<p className="text-sm text-slate-500 mt-0.5">by ColorCode Solutions</p>
</div>
);
}
