import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  critical: { label: "Critical", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", dot: "bg-red-500" },
  high:     { label: "High",     cls: "bg-orange-50 text-orange-700 ring-1 ring-orange-200", dot: "bg-orange-500" },
  medium:   { label: "Medium",   cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-400" },
  low:      { label: "Low",      cls: "bg-green-50 text-green-700 ring-1 ring-green-200", dot: "bg-green-500" },
};
const EFFORT_CONFIG: Record<string, { label: string; cls: string }> = {
  low:    { label: "Low effort",    cls: "text-green-600 bg-green-50 ring-1 ring-green-200" },
  medium: { label: "Medium effort", cls: "text-amber-600 bg-amber-50 ring-1 ring-amber-200" },
  high:   { label: "High effort",   cls: "text-red-600 bg-red-50 ring-1 ring-red-200" },
};
const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical Risk", color: "text-red-600" },
  high:     { label: "High Risk",     color: "text-orange-600" },
  medium:   { label: "Medium Risk",   color: "text-amber-600" },
  low:      { label: "Low Risk",      color: "text-green-600" },
};

export default function GapAnalysis() {
  const [result, setResult] = useState<any>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/gap-analysis`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
  });

  const items: any[] = result?.items ?? [];
  const filtered = filterPriority === "all" ? items : items.filter(i => i.priority === filterPriority);
  const risk = RISK_CONFIG[result?.overallRisk ?? "low"];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Gap Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered remediation roadmap based on your current control failures. Prioritized by risk, effort, and framework impact.
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!orgId || mutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {mutation.isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing with AI...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {result ? "Re-run Analysis" : "Run Gap Analysis"}
            </>
          )}
        </button>
      </div>

      {/* Empty state */}
      {!result && !mutation.isPending && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-base font-bold text-slate-900 mb-2">AI-Powered Remediation Roadmap</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Our AI analyzes your failing controls, cross-references your active frameworks, and produces a prioritized action plan with effort estimates and step-by-step guidance.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500 mb-8">
            {[
              { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", label: "Prioritized by risk" },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "Effort estimates" },
              { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Framework coverage" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
              </div>
            ))}
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={!orgId}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Run Gap Analysis
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {mutation.isPending && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-pulse space-y-4">
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 flex-1 bg-slate-100 rounded-xl" />)}
            </div>
            <div className="h-24 bg-slate-100 rounded-xl" />
          </div>
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse" />)}
        </div>
      )}

      {/* Results */}
      {result && !mutation.isPending && (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Compliance Score", value: `${result.score}%`, color: result.score >= 75 ? "text-green-600" : result.score >= 50 ? "text-amber-600" : "text-red-600" },
              { label: "Overall Risk", value: risk?.label ?? "Unknown", color: risk?.color ?? "text-slate-700" },
              { label: "Controls Failing", value: result.failing, color: "text-red-600" },
              { label: "Not Yet Tested", value: result.notTested, color: "text-amber-600" },
              { label: "Time to Compliance", value: result.estimatedTimeToCompliance, color: "text-blue-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className={`text-lg font-extrabold ${color} leading-tight`}>{value}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Executive summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-blue-900 mb-1">Executive Summary</p>
                <p className="text-sm text-blue-800 leading-relaxed">{result.executiveSummary}</p>
              </div>
            </div>
          </div>

          {/* Quick wins */}
          {result.quickWins?.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-5">
              <p className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Quick Wins
              </p>
              <ul className="space-y-1.5">
                {result.quickWins.map((w: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                    <svg className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filter + list */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900">Remediation Roadmap ({filtered.length} items)</h2>
              <div className="flex gap-1.5">
                {["all", "critical", "high", "medium", "low"].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPriority(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${filterPriority === p ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    {p === "all" ? "All" : p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filtered.map((item: any) => {
                const priority = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.medium;
                const effort = EFFORT_CONFIG[item.effort] ?? EFFORT_CONFIG.medium;
                const isExpanded = expandedId === item.controlId;

                return (
                  <div key={item.controlId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.controlId)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 mt-0.5">
                          {item.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{item.controlId}</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${priority.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                              {priority.label}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${effort.cls}`}>{effort.label}</span>
                            {item.quickWin && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                                Quick Win
                              </span>
                            )}
                            <span className="text-xs text-slate-400">{item.effortDays}d est.</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{item.controlName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.domain}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex gap-1 flex-wrap justify-end">
                            {(item.frameworksBenefited ?? []).slice(0, 3).map((fw: string) => (
                              <span key={fw} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">{fw}</span>
                            ))}
                            {(item.frameworksBenefited ?? []).length > 3 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">+{item.frameworksBenefited.length - 3}</span>
                            )}
                          </div>
                          <svg className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50">
                        <div className="grid md:grid-cols-2 gap-5 mt-3">
                          <div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Impact</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{item.impact}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Action Steps</p>
                            <ol className="space-y-1.5">
                              {(item.actionSteps ?? []).map((step: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <a href="/controls" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Go to Controls
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </a>
                          <a href="/risks" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                            Add to Risk Register
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Long-term actions */}
          {result.longtermActions?.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-bold text-slate-900 mb-3">Long-term Structural Actions</p>
              <ul className="space-y-2">
                {result.longtermActions.map((a: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
