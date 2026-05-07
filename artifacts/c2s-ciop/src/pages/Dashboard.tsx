import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/queryClient";
import { useEffect } from "react";
import { useUser } from "@clerk/react";

const CATEGORY_COLORS: Record<string, { badge: string; label: string }> = {
  commercial: { badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200", label: "Commercial" },
  federal: { badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", label: "Federal" },
  "best-practice": { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: "Best Practice" },
};

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
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
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

  return (
    <div className="p-6 max-w-screen-2xl space-y-6">

      {/* Context row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{org?.name} &middot; live compliance posture</p>
        </div>
        <div className="flex items-center gap-3">
          {connectedIntegrations === 0 && (
            <button
              onClick={() => navigate("/integrations")}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect an integration
            </button>
          )}
          <button
            onClick={() => navigate("/frameworks")}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add framework
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        {/* Score card - accent */}
        <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <ScoreRingSmall score={overall} />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900 leading-none">{overall}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1 leading-tight">Overall Score</p>
            <p className="text-xs text-slate-400 mt-0.5">{frameworks.length} framework{frameworks.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <KpiCard
          label="Passing"
          value={cs.passing}
          total={cs.total}
          color={cs.passing > 0 ? "green" : "neutral"}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <KpiCard
          label="Failing"
          value={cs.failing}
          total={cs.total}
          color={cs.failing > 0 ? "red" : "neutral"}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
            </svg>
          }
        />

        {/* Integrations card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${connectedIntegrations > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${connectedIntegrations > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
              {connectedIntegrations}/12
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 leading-none">{connectedIntegrations}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Integrations</p>
          <p className="text-xs text-slate-400 mt-0.5">of 12 available</p>
        </div>
      </div>

      {/* Framework Compliance */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Framework Compliance</h2>
            {frameworks.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{frameworks.length} active framework{frameworks.length !== 1 ? "s" : ""} tracked</p>
            )}
          </div>
          <button onClick={() => navigate("/frameworks")} className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
            Manage
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {frameworks.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
            <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700 text-sm">No frameworks activated</p>
            <p className="text-slate-400 text-xs mt-1 mb-4">Add SOC 2, FedRAMP, CMMC, or any of 12 frameworks to start tracking compliance.</p>
            <button onClick={() => navigate("/frameworks")} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Add your first framework
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {frameworks.map((fw: any) => <FrameworkCard key={fw.id} fw={fw} onClick={() => navigate("/frameworks")} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: "green" | "red" | "neutral"; icon: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const iconBg = color === "green" ? "bg-green-50 text-green-600" : color === "red" ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400";
  const valueColor = color === "green" ? "text-green-700" : color === "red" ? "text-red-600" : "text-slate-900";
  const barColor = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-500" : "bg-slate-300";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        {total > 0 && (
          <span className="text-xs font-semibold text-slate-400">{pct}%</span>
        )}
      </div>
      <p className={`text-2xl font-bold leading-none ${valueColor}`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
      <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: total > 0 ? `${pct}%` : "0%" }} />
      </div>
    </div>
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
  const scoreColor = !hasActivity ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";
  const barColor = !hasActivity ? "bg-slate-200" : score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 text-sm leading-snug group-hover:text-blue-700 transition-colors truncate">
            {fw.shortName ?? fw.name}
          </p>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 ${cat.badge}`}>
            {cat.label}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold leading-none ${scoreColor}`}>{Math.round(score)}%</p>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{hasActivity ? "compliant" : "not started"}</p>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
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
        <div className="mt-2.5 flex gap-1 h-1">
          {passing > 0 && <div className="bg-green-400 rounded-full h-full" style={{ width: `${(passing / total) * 100}%` }} />}
          {failing > 0 && <div className="bg-red-400 rounded-full h-full" style={{ width: `${(failing / total) * 100}%` }} />}
          {untested > 0 && <div className="bg-slate-200 rounded-full h-full" style={{ width: `${(untested / total) * 100}%` }} />}
        </div>
      )}
    </div>
  );
}
