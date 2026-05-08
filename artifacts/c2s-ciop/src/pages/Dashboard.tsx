import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/queryClient";
import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CATEGORY_COLORS: Record<string, { badge: string; label: string }> = {
  commercial: { badge: "bg-green-50 text-green-700 ring-1 ring-green-200", label: "Commercial" },
  federal: { badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", label: "Federal" },
  "best-practice": { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: "Best Practice" },
};

function HeroScoreRing({ score }: { score: number }) {
  const size = 96;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const hasScore = score > 0;
  const stroke = !hasScore ? "rgba(255,255,255,0.2)" : score >= 75 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${hasScore ? filled : 0} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="relative text-center">
        <p className="text-2xl font-bold text-white leading-none">{score}</p>
        <p className="text-xs text-green-200 font-medium leading-tight mt-0.5">score</p>
      </div>
    </div>
  );
}

function ScoreRingSmall({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const hasScore = score > 0;
  const stroke = !hasScore ? "#e2e8f0" : score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const textColor = !hasScore ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";
  return (
    <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
      <svg width="64" height="64" className="-rotate-90" style={{ position: "absolute" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={stroke} strokeWidth="6"
          strokeDasharray={`${hasScore ? filled : 0} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <span className={`text-sm font-bold relative ${textColor}`}>{score}</span>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useUser();

  const { data: orgData, isLoading: orgLoading } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });

  const orgId = orgData?.org?.id;

  const { data: dashData, isLoading } = useQuery<any>({
    queryKey: ["dashboard", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/dashboard`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgLoading && orgData?.org == null) navigate("/onboarding");
  }, [orgLoading, orgData, navigate]);

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-0">
        <div className="h-32 bg-green-900 animate-pulse" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const org = dashData?.org;
  const frameworks: any[] = dashData?.frameworks ?? [];
  const cs = dashData?.controlSummary ?? { passing: 0, failing: 0, notTested: 0, total: 0 };
  const overall = dashData?.overallScore ?? 0;
  const connectedIntegrations = dashData?.connectedIntegrations ?? 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "";

  const policiesCount = dashData?.policiesCount ?? 0;
  const peopleCount = dashData?.peopleCount ?? 0;

  const gettingStartedSteps = [
    {
      id: "framework",
      label: "Add a compliance framework",
      done: frameworks.length > 0,
      href: "/frameworks",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    },
    {
      id: "integration",
      label: "Connect an integration to collect evidence",
      done: connectedIntegrations > 0,
      href: "/integrations",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    },
    {
      id: "policy",
      label: "Add your first security policy",
      done: policiesCount > 0,
      href: "/policies",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      id: "people",
      label: "Add people to your workforce roster",
      done: peopleCount > 0,
      href: "/people",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      id: "controls",
      label: "Review your control status",
      done: cs.passing > 0,
      href: "/controls",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    },
  ];
  const completedSteps = gettingStartedSteps.filter(s => s.done).length;
  const showChecklist = completedSteps < gettingStartedSteps.length;

  const scoreLabel = overall === 0 ? "Not started" : overall >= 75 ? "On track" : overall >= 50 ? "Needs attention" : "At risk";
  const scoreLabelColor = overall === 0 ? "text-green-200" : overall >= 75 ? "text-green-300" : overall >= 50 ? "text-amber-300" : "text-red-300";

  return (
    <div>
      {/* Hero gradient banner */}
      <div
        className="px-6 py-7 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #14532d 0%, #15803d 50%, #166534 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full opacity-10" style={{ background: "#ffffff" }} />
        <div className="absolute -bottom-16 right-32 h-40 w-40 rounded-full opacity-[0.06]" style={{ background: "#ffffff" }} />
        <div className="absolute top-4 right-1/3 h-20 w-20 rounded-full opacity-[0.05]" style={{ background: "#ffffff" }} />

        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          {/* Left: greeting + status */}
          <div className="flex items-center gap-6">
            <HeroScoreRing score={overall} />
            <div>
              <p className="text-green-200 text-xs font-semibold uppercase tracking-wider mb-1">
                {org?.name ?? "EnterpriseComply"} &middot; Live Posture
              </p>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {greeting}{firstName ? `, ${firstName}` : ""}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`text-sm font-semibold ${scoreLabelColor}`}>{scoreLabel}</span>
                <span className="text-green-500 text-xs">
                  {frameworks.length > 0
                    ? `${frameworks.length} framework${frameworks.length !== 1 ? "s" : ""} active`
                    : "No frameworks yet"}
                </span>
                {cs.total > 0 && (
                  <span className="text-green-500 text-xs">
                    {cs.passing}/{cs.total} controls passing
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {connectedIntegrations === 0 && (
              <button
                onClick={() => navigate("/integrations")}
                className="flex items-center gap-2 px-3.5 py-2 text-white text-sm font-semibold rounded-lg transition-all"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect integration
              </button>
            )}
            <button
              onClick={() => {
                const win = window.open("/report?print=1", "_blank");
                if (win) {
                  win.addEventListener("load", () => {
                    setTimeout(() => win.print(), 1200);
                  });
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-white text-sm font-semibold rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.22)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Board report (PDF)
            </button>
            <button
              onClick={() => navigate("/frameworks")}
              className="flex items-center gap-2 px-3.5 py-2 bg-white text-green-700 text-sm font-semibold rounded-lg hover:bg-green-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add framework
            </button>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="p-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Passing Controls"
            value={cs.passing}
            total={cs.total}
            color={cs.passing > 0 ? "green" : "neutral"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <KpiCard
            label="Failing Controls"
            value={cs.failing}
            total={cs.total}
            color={cs.failing > 0 ? "red" : "neutral"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
          />
          <KpiCard
            label="Not Tested"
            value={cs.notTested}
            total={cs.total}
            color="neutral"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
              </svg>
            }
          />
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-green-700" />
            <div className="flex items-center justify-between mb-3 pt-1">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-green-50 text-green-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                {connectedIntegrations}/12
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 leading-none">{connectedIntegrations}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Integrations Active</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-700 rounded-full transition-all duration-700" style={{ width: `${(connectedIntegrations / 12) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Getting started checklist */}
        {showChecklist && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Getting started</h2>
                <p className="text-xs text-slate-400 mt-0.5">{completedSteps} of {gettingStartedSteps.length} steps complete</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-700 rounded-full transition-all duration-500"
                    style={{ width: `${(completedSteps / gettingStartedSteps.length) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-600">{Math.round((completedSteps / gettingStartedSteps.length) * 100)}%</span>
              </div>
            </div>
            <div className="p-4 space-y-1.5">
              {gettingStartedSteps.map((step, idx) => (
                <button key={step.id} onClick={() => navigate(step.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${step.done ? "border-green-200 bg-green-50/40" : "border-slate-200 hover:border-green-200 hover:bg-green-50/40"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.done ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {step.done
                      ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : idx + 1
                    }
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`flex-shrink-0 ${step.done ? "text-green-400" : "text-slate-400"}`}>{step.icon}</span>
                    <span className={`text-sm font-medium ${step.done ? "text-green-700 line-through opacity-70" : "text-slate-700"}`}>{step.label}</span>
                  </div>
                  {!step.done && (
                    <svg className="h-4 w-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compliance Score Trend */}
        <ScoreTrendChart orgId={orgId} />

        {/* Framework Compliance */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Framework Compliance</h2>
              {frameworks.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{frameworks.length} active framework{frameworks.length !== 1 ? "s" : ""}</p>
              )}
            </div>
            <button onClick={() => navigate("/frameworks")} className="text-sm text-green-800 hover:text-green-700 font-semibold flex items-center gap-1">
              Manage
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {frameworks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
              <div className="h-12 w-12 bg-gradient-to-br from-green-50 to-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 ring-1 ring-slate-200">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="font-bold text-slate-800 text-sm">No frameworks activated</p>
              <p className="text-slate-400 text-xs mt-1 mb-4 max-w-xs mx-auto">Add SOC 2, FedRAMP, CMMC, or any of 12 supported frameworks to start tracking compliance.</p>
              <button onClick={() => navigate("/frameworks")} className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900 transition-colors shadow-sm">
                Add your first framework
              </button>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {frameworks.map((fw: any) => <FrameworkCard key={fw.id} fw={fw} onClick={() => navigate("/frameworks")} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreTrendChart({ orgId }: { orgId: number | undefined }) {
  const { data, isLoading } = useQuery<{ history: any[] }>({
    queryKey: ["score-history", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/score-history`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const history = data?.history ?? [];

  const chartData = history.map(h => ({
    date: new Date(h.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: Math.round(h.overallScore),
    passing: h.passingControls,
    failing: h.failingControls,
  }));

  if (isLoading) {
    return <div className="h-52 bg-white border border-slate-200 rounded-xl shadow-sm animate-pulse" />;
  }

  if (chartData.length === 0) {
    return null;
  }

  const latest = chartData[chartData.length - 1]?.score ?? 0;
  const earliest = chartData[0]?.score ?? 0;
  const delta = latest - earliest;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Compliance Score Trend</h2>
          <p className="text-xs text-slate-400 mt-0.5">90-day history</p>
        </div>
        <div className="flex items-center gap-3">
          {delta !== 0 && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${delta > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {delta > 0 ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              )}
              {Math.abs(delta)}pts over 90d
            </span>
          )}
          <a href="/gap-analysis" className="text-xs font-semibold text-green-800 hover:text-green-700 flex items-center gap-1">
            AI Gap Analysis
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#15803d" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              interval={Math.floor(chartData.length / 6)}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, background: "white" }}
              formatter={(val: any) => [`${val}%`, "Score"]}
              labelStyle={{ color: "#475569", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#15803d"
              strokeWidth={2.5}
              fill="url(#scoreGrad)"
              dot={false}
              activeDot={{ r: 5, fill: "#15803d", strokeWidth: 2, stroke: "white" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KpiCard({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: "green" | "red" | "neutral"; icon: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const iconBg = color === "green" ? "bg-green-50 text-green-600" : color === "red" ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400";
  const valueColor = color === "green" ? "text-green-700" : color === "red" ? "text-red-600" : "text-slate-800";
  const barColor = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-slate-300";
  const topBar = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-slate-300";

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className={`h-[3px] ${topBar}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
          {total > 0 && (
            <span className="text-xs font-bold text-slate-400">{pct}%</span>
          )}
        </div>
        <p className={`text-2xl font-bold leading-none ${valueColor}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: total > 0 ? `${pct}%` : "0%" }} />
        </div>
      </div>
    </div>
  );
}

function FrameworkProgressRing({ score, size = 52, hasActivity }: { score: number; size?: number; hasActivity: boolean }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (hasActivity ? (score / 100) * circ : 0);
  const color = !hasActivity ? "#cbd5e1" : score >= 75 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444";
  const textFill = !hasActivity ? "#94a3b8" : score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontWeight="bold" fill={textFill}>
        {Math.round(score)}%
      </text>
    </svg>
  );
}

function FrameworkCard({ fw, onClick }: { fw: any; onClick: () => void }) {
  const score = fw.complianceScore ?? 0;
  const passing = fw.passingControls ?? 0;
  const failing = fw.failingControls ?? 0;
  const untested = fw.notTestedControls ?? 0;
  const total = passing + failing + untested;
  const hasActivity = passing > 0 || failing > 0;

  const cat = CATEGORY_COLORS[fw.category] ?? { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: fw.category };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 text-sm leading-snug group-hover:text-green-700 transition-colors truncate">
            {fw.shortName ?? fw.name}
          </p>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 ${cat.badge}`}>
            {cat.label}
          </span>
        </div>
        <FrameworkProgressRing score={score} hasActivity={hasActivity} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className={`rounded-lg py-1.5 ${passing > 0 ? "bg-green-50" : "bg-slate-50"}`}>
          <p className={`text-sm font-bold leading-none ${passing > 0 ? "text-green-700" : "text-slate-400"}`}>{passing}</p>
          <p className={`text-xs mt-0.5 ${passing > 0 ? "text-green-600" : "text-slate-400"}`}>Passing</p>
        </div>
        <div className={`rounded-lg py-1.5 ${failing > 0 ? "bg-red-50" : "bg-slate-50"}`}>
          <p className={`text-sm font-bold leading-none ${failing > 0 ? "text-red-600" : "text-slate-400"}`}>{failing}</p>
          <p className={`text-xs mt-0.5 ${failing > 0 ? "text-red-500" : "text-slate-400"}`}>Failing</p>
        </div>
        <div className="bg-slate-50 rounded-lg py-1.5">
          <p className="text-sm font-bold text-slate-500 leading-none">{untested}</p>
          <p className="text-xs text-slate-400 mt-0.5">Untested</p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-2.5 flex gap-0.5 h-1 rounded-full overflow-hidden">
          {passing > 0 && <div className="bg-green-400 rounded-full" style={{ width: `${(passing / total) * 100}%` }} />}
          {failing > 0 && <div className="bg-red-400 rounded-full" style={{ width: `${(failing / total) * 100}%` }} />}
          {untested > 0 && <div className="bg-slate-200 rounded-full" style={{ width: `${(untested / total) * 100}%` }} />}
        </div>
      )}
    </div>
  );
}
