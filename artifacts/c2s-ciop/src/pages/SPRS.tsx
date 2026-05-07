import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const READINESS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high: { label: "High Readiness", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  medium: { label: "Medium Readiness", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
  low: { label: "Low Readiness", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  critical: { label: "Critical - Immediate Action Required", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

export default function SPRS() {
  const { orgId } = useOrg();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["sprs", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/sprs`),
    enabled: !!orgId,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-screen-xl">
        <div className="h-8 w-64 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const score = data?.score ?? -203;
  const readiness = data?.readinessLevel ?? "critical";
  const rc = READINESS_CONFIG[readiness];
  const scorePercent = Math.max(0, Math.min(100, ((score + 203) / 313) * 100));

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SPRS Score Calculator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Supplier Performance Risk System - NIST SP 800-171 / CMMC Level 2</p>
        </div>
        <a href="https://www.nist.gov/system/files/documents/2021/11/01/NIST%20SP%20800-171%20DoD%20Assessment%20Methodology%20Version%201.2.1%20September%202020.pdf"
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline">DoD Methodology PDF</a>
      </div>

      <div className={`border rounded-xl p-6 mb-6 ${rc.bg} ${rc.border}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-600">Your SPRS Score</p>
            <p className={`text-6xl font-bold mt-1 ${rc.color}`}>{score > 0 ? `+${score}` : score}</p>
            <p className={`text-sm font-medium mt-1 ${rc.color}`}>{rc.label}</p>
          </div>
          <div className="text-right text-sm text-slate-500 space-y-1">
            <p>Target: <span className="font-bold text-green-700">+110</span></p>
            <p>Industry avg: <span className="font-bold text-red-600">-12</span></p>
            <p>Minimum: <span className="font-bold text-slate-700">-203</span></p>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 border border-slate-200 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all ${readiness === "high" ? "bg-green-500" : readiness === "medium" ? "bg-yellow-500" : readiness === "low" ? "bg-orange-500" : "bg-red-500"}`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>-203 (Min)</span><span>0</span><span>+110 (Max)</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Controls Met</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{data?.met ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">of {data?.totalControls ?? 110} total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Controls Not Met</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{data?.notMet ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">need remediation</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Not Yet Assessed</p>
          <p className="text-3xl font-bold text-slate-400 mt-1">{data?.notReviewed ?? 0}</p>
          <p className="text-sm text-slate-400 mt-0.5">need testing</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Top Gaps by Point Value</h2>
          <p className="text-xs text-slate-400 mt-0.5">Fixing these controls has the highest impact on your SPRS score</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.topGaps ?? []).map((gap: any, idx: number) => (
            <div key={gap.nistId} className="flex items-center px-5 py-3 hover:bg-slate-50">
              <span className="w-6 text-xs text-slate-400 font-medium">#{idx + 1}</span>
              <span className="w-28 text-sm font-mono font-medium text-slate-700">{gap.nistId}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full mx-4">
                <div className="h-2 bg-red-400 rounded-full" style={{ width: `${(gap.weight / 5) * 100}%` }} />
              </div>
              <span className="text-sm font-bold text-red-600 w-16 text-right">-{gap.weight} pts</span>
            </div>
          ))}
          {(data?.topGaps ?? []).length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              {data?.notMet === 0 ? "All tested controls are passing. Excellent CMMC readiness!" : "No gap data available yet. Run control tests first."}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700 mb-1">How SPRS Scoring Works</p>
        <p>The DoD SPRS score starts at -203 and increases as you implement the 110 NIST SP 800-171 controls. Each control is weighted 1, 3, or 5 points based on criticality. A perfect score of +110 means all 110 controls are implemented. CMMC Level 2 requires demonstrating all 110 controls during a C3PAO assessment (Phase 2, 2026+).</p>
      </div>
    </div>
  );
}
