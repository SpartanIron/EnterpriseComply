import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/queryClient";
import { useEffect } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  commercial: "bg-blue-100 text-blue-700",
  federal: "bg-purple-100 text-purple-700",
  "best-practice": "bg-slate-100 text-slate-600",
};

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-slate-900">{score}</p>
        <p className="text-xs text-slate-400 font-medium">/ 100</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();

  const { data: orgData, isLoading: orgLoading } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/orgs/me"), { credentials: "include" });
      return res.json();
    },
  });

  const orgId = orgData?.org?.id;

  const { data: dashData, isLoading } = useQuery<any>({
    queryKey: ["dashboard", orgId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/dashboard`), { credentials: "include" });
      return res.json();
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgLoading && orgData?.org == null) navigate("/onboarding");
  }, [orgLoading, orgData, navigate]);

  if (orgLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
        </div>
      </div>
    );
  }

  const org = dashData?.org;
  const frameworks: any[] = dashData?.frameworks ?? [];
  const cs = dashData?.controlSummary ?? { passing: 0, failing: 0, notTested: 0, total: 0 };
  const overall = dashData?.overallScore ?? 0;
  const connectedIntegrations = dashData?.connectedIntegrations ?? 0;

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
        <p className="text-slate-500 mt-1">{org?.name ?? "Your organization"}: live compliance posture</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center shadow-sm">
          <ScoreRing score={overall} />
          <p className="mt-3 text-sm font-semibold text-slate-600">Overall Score</p>
          <p className="text-xs text-slate-400 mt-0.5">{frameworks.length} active framework{frameworks.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="md:col-span-3 grid grid-cols-3 gap-5">
          <StatCard label="Passing Controls" value={cs.passing} total={cs.total} color="green" icon="✓" />
          <StatCard label="Failing Controls" value={cs.failing} total={cs.total} color="red" icon="✗" />
          <StatCard label="Not Tested" value={cs.notTested} total={cs.total} color="slate" icon="?" />
        </div>
      </div>

      {connectedIntegrations === 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-900 text-sm">Connect an integration to start collecting evidence automatically</p>
            <p className="text-blue-600 text-xs mt-0.5">Connect GitHub, AWS, Okta, and more. Your controls start passing automatically.</p>
          </div>
          <button onClick={() => navigate("/integrations")} className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Connect now
          </button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Framework Compliance</h2>
          <button onClick={() => navigate("/frameworks")} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</button>
        </div>
        {frameworks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500 text-sm mb-3">No frameworks activated yet.</p>
            <button onClick={() => navigate("/frameworks")} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Add a framework →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {frameworks.map((fw: any) => <FrameworkCard key={fw.id} fw={fw} onClick={() => navigate("/frameworks")} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: string }) {
  const styles: Record<string, string> = { green: "bg-green-50 text-green-700 border-green-100", red: "bg-red-50 text-red-700 border-red-100", slate: "bg-slate-50 text-slate-600 border-slate-100" };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg text-base font-bold mb-3 border ${styles[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {total > 0 && <p className="text-xs text-slate-400 mt-1">{Math.round((value / total) * 100)}% of {total} total</p>}
    </div>
  );
}

function FrameworkCard({ fw, onClick }: { fw: any; onClick: () => void }) {
  const score = fw.complianceScore ?? 0;
  const passing = fw.passingControls ?? 0;
  const failing = fw.failingControls ?? 0;
  const untested = fw.notTestedControls ?? 0;
  const hasActivity = passing > 0 || failing > 0;

  const scoreColor = !hasActivity ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";
  const barColor = !hasActivity ? "bg-slate-200" : score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 pr-3">
          <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{fw.shortName ?? fw.name}</p>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1.5 ${CATEGORY_COLORS[fw.category] ?? "bg-slate-100 text-slate-600"}`}>
            {fw.category === "best-practice" ? "Best Practice" : fw.category === "federal" ? "Federal" : "Commercial"}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold leading-none ${scoreColor}`}>{Math.round(score)}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{hasActivity ? "compliant" : "not started"}</p>
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <div className="flex gap-3 text-xs">
        <span className={`font-semibold ${passing > 0 ? "text-green-600" : "text-slate-400"}`}>{passing} passing</span>
        <span className="text-slate-200">|</span>
        <span className={`font-semibold ${failing > 0 ? "text-red-500" : "text-slate-400"}`}>{failing} failing</span>
        <span className="text-slate-200">|</span>
        <span className="text-slate-400">{untested} untested</span>
      </div>
    </div>
  );
}
