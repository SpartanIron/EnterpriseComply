import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  passing: { label: "Passing", color: "text-green-700", bg: "bg-green-100" },
  failing: { label: "Failing", color: "text-red-700", bg: "bg-red-100" },
  not_tested: { label: "Not Tested", color: "text-slate-600", bg: "bg-slate-100" },
  warning: { label: "Warning", color: "text-amber-700", bg: "bg-amber-100" },
};

const AUTO_CONFIG: Record<string, string> = {
  full: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  manual: "bg-slate-100 text-slate-600",
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

  const filtered = filter === "all"
    ? controls
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

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Controls</h1>
        <p className="text-slate-500 mt-1">Universal Control Objectives mapped to all your active frameworks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Passing", value: stats.passing, color: "green" },
          { label: "Failing", value: stats.failing, color: "red" },
          { label: "Not Tested", value: stats.notTested, color: "slate" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color === "green" ? "text-green-600" : s.color === "red" ? "text-red-600" : "text-slate-600"}`}>{s.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[["all", "All"], ["passing", "Passing"], ["failing", "Failing"], ["not_tested", "Not Tested"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === val ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {domains.map(domain => {
            const domainControls = groupedByDomain[domain];
            if (!domainControls?.length) return null;
            return (
              <div key={domain}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{domain}</h2>
                <div className="space-y-2">
                  {domainControls.map((c: any) => {
                    const status = c.result?.status ?? "not_tested";
                    const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_tested;
                    const isExpanded = expanded === c.controlId;
                    return (
                      <div key={c.controlId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <button
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => setExpanded(isExpanded ? null : c.controlId)}
                        >
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${sc.bg} ${sc.color} flex-shrink-0`}>{sc.label}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-400 flex-shrink-0">{c.controlId}</span>
                              <span className="font-medium text-slate-900 text-sm truncate">{c.name}</span>
                            </div>
                            {c.result?.integrationKey && (
                              <p className="text-xs text-slate-400 mt-0.5">Last tested via {c.result.integrationKey}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${AUTO_CONFIG[c.automationLevel] ?? AUTO_CONFIG.manual}`}>
                              {c.automationLevel}
                            </span>
                            <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50">
                            <div className="pt-4 space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                                <p className="text-sm text-slate-700">{c.description}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Objective</p>
                                <p className="text-sm text-slate-700">{c.objective}</p>
                              </div>
                              {c.remediationGuidance && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-blue-700 mb-1">Remediation Guidance</p>
                                  <p className="text-sm text-blue-900">{c.remediationGuidance}</p>
                                </div>
                              )}
                              {c.result?.result && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Test Result</p>
                                  <p className="text-sm text-slate-700">{c.result.result}</p>
                                </div>
                              )}
                              {overrideId === c.controlId ? (
                                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                                  <p className="text-sm font-semibold text-slate-700">Manual Override</p>
                                  <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                    <option value="passing">Passing</option>
                                    <option value="failing">Failing</option>
                                    <option value="warning">Warning</option>
                                    <option value="not_tested">Not Tested</option>
                                  </select>
                                  <textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="Notes / justification (optional)..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} />
                                  <div className="flex gap-2">
                                    <button onClick={() => overrideMutation.mutate({ controlId: c.controlId, status: overrideStatus, notes: overrideNote })} disabled={overrideMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                      {overrideMutation.isPending ? "Saving..." : "Save"}
                                    </button>
                                    <button onClick={() => setOverrideId(null)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => { setOverrideId(c.controlId); setOverrideStatus(status); setOverrideNote(c.result?.remediationNotes ?? ""); }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                                  Manual override →
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
        </div>
      )}
    </div>
  );
}
