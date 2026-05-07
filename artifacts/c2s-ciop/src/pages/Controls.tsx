import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, SectionLabel } from "@/components/ui/PageHeader";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  passing: { label: "Passing", color: "text-green-700", bg: "bg-green-50 ring-1 ring-green-200", dot: "bg-green-500" },
  failing: { label: "Failing", color: "text-red-700", bg: "bg-red-50 ring-1 ring-red-200", dot: "bg-red-500" },
  not_tested: { label: "Not Tested", color: "text-slate-500", bg: "bg-slate-100 ring-1 ring-slate-200", dot: "bg-slate-300" },
  warning: { label: "Warning", color: "text-amber-700", bg: "bg-amber-50 ring-1 ring-amber-200", dot: "bg-amber-400" },
};

const AUTO_CONFIG: Record<string, { label: string; cls: string }> = {
  full: { label: "Automated", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  partial: { label: "Partial", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  manual: { label: "Manual", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
};

export default function Controls() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("passing");
  const [overrideNote, setOverrideNote] = useState("");

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ controls: any[] }>({
    queryKey: ["org-controls", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/controls`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ controlId, status, notes }: { controlId: string; status: string; notes: string }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/controls/${controlId}/result`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, remediationNotes: notes }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-controls"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOverrideId(null);
      setOverrideNote("");
    },
  });

  const controls = data?.controls ?? [];
  const domains = [...new Set(controls.map(c => c.domain))].sort();

  const filtered = filter === "all" ? controls
    : filter === "passing" ? controls.filter(c => c.result?.status === "passing")
    : filter === "failing" ? controls.filter(c => c.result?.status === "failing")
    : controls.filter(c => c.result?.status === "not_tested" || !c.result?.status);

  const groupedByDomain = domains.reduce<Record<string, any[]>>((acc, d) => {
    acc[d] = filtered.filter(c => c.domain === d);
    return acc;
  }, {});

  const stats = {
    passing: controls.filter(c => c.result?.status === "passing").length,
    failing: controls.filter(c => c.result?.status === "failing").length,
    notTested: controls.filter(c => !c.result?.status || c.result?.status === "not_tested").length,
  };
  const total = controls.length;

  const FILTERS: [string, string, number][] = [
    ["all", "All controls", total],
    ["passing", "Passing", stats.passing],
    ["failing", "Failing", stats.failing],
    ["not_tested", "Not Tested", stats.notTested],
  ];

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Controls"
        subtitle="Universal Control Objectives mapped across all active frameworks"
      />

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", value: total, colorVal: "text-slate-900", bar: "bg-slate-300" },
          { label: "Passing", value: stats.passing, colorVal: stats.passing > 0 ? "text-green-600" : "text-slate-400", bar: "bg-green-500" },
          { label: "Failing", value: stats.failing, colorVal: stats.failing > 0 ? "text-red-600" : "text-slate-400", bar: "bg-red-500" },
          { label: "Not Tested", value: stats.notTested, colorVal: "text-slate-500", bar: "bg-slate-200" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${s.colorVal}`}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">{s.label}</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${s.bar} rounded-full`} style={{ width: total > 0 ? `${(s.value / total) * 100}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 p-1 bg-slate-100 rounded-xl w-fit">
        {FILTERS.map(([val, label, count]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              filter === val
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${filter === val ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-400"}`}>{count}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-5">
          {domains.map(domain => {
            const domainControls = groupedByDomain[domain];
            if (!domainControls?.length) return null;
            return (
              <div key={domain}>
                <SectionLabel>{domain} ({domainControls.length})</SectionLabel>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {domainControls.map((c: any, idx: number) => {
                    const status = c.result?.status ?? "not_tested";
                    const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_tested;
                    const auto = AUTO_CONFIG[c.automationLevel] ?? AUTO_CONFIG.manual;
                    const isExpanded = expanded === c.controlId;
                    return (
                      <div key={c.controlId} className={idx > 0 ? "border-t border-slate-100" : ""}>
                        <button
                          className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => setExpanded(isExpanded ? null : c.controlId)}
                        >
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2.5">
                              <span className="text-xs font-mono text-slate-400 flex-shrink-0 tabular-nums">{c.controlId}</span>
                              <span className="font-semibold text-slate-800 text-sm truncate">{c.name}</span>
                            </div>
                            {c.result?.integrationKey && (
                              <p className="text-xs text-slate-400 mt-0.5">Tested via {c.result.integrationKey}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`hidden lg:inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${auto.cls}`}>{auto.label}</span>
                            <svg className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 pt-3 bg-slate-50 border-t border-slate-100">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <SectionLabel>Description</SectionLabel>
                                  <p className="text-sm text-slate-700 leading-relaxed">{c.description}</p>
                                </div>
                                <div>
                                  <SectionLabel>Objective</SectionLabel>
                                  <p className="text-sm text-slate-700 leading-relaxed">{c.objective}</p>
                                </div>
                              </div>

                              {c.remediationGuidance && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3.5">
                                  <p className="text-xs font-bold text-blue-700 mb-1 uppercase tracking-wide">Remediation Guidance</p>
                                  <p className="text-sm text-blue-900 leading-relaxed">{c.remediationGuidance}</p>
                                </div>
                              )}

                              {c.result?.result && (
                                <div>
                                  <SectionLabel>Test Result</SectionLabel>
                                  <p className="text-sm text-slate-700">{c.result.result}</p>
                                </div>
                              )}

                              {overrideId === c.controlId ? (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                  <p className="text-sm font-bold text-slate-800">Manual Override</p>
                                  <select
                                    value={overrideStatus}
                                    onChange={e => setOverrideStatus(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  >
                                    <option value="passing">Passing</option>
                                    <option value="failing">Failing</option>
                                    <option value="warning">Warning</option>
                                    <option value="not_tested">Not Tested</option>
                                  </select>
                                  <textarea
                                    value={overrideNote}
                                    onChange={e => setOverrideNote(e.target.value)}
                                    placeholder="Add notes or justification..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => overrideMutation.mutate({ controlId: c.controlId, status: overrideStatus, notes: overrideNote })}
                                      disabled={overrideMutation.isPending}
                                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                      {overrideMutation.isPending ? "Saving..." : "Save Override"}
                                    </button>
                                    <button
                                      onClick={() => setOverrideId(null)}
                                      className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setOverrideId(c.controlId); setOverrideStatus(status); setOverrideNote(c.result?.remediationNotes ?? ""); }}
                                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                                >
                                  Set manual override
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {domains.every(d => !groupedByDomain[d]?.length) && (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
              <p className="text-slate-500 text-sm">No controls match the current filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
