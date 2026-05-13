import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const EFFORT_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-red-200",
  high: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  medium: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  low: "bg-green-100 text-green-700 ring-1 ring-green-200",
};

const DOMAIN_COLORS: Record<string, string> = {
  "Access Control": "bg-blue-50 border-blue-200",
  "Authentication & Identity": "bg-violet-50 border-violet-200",
  "Configuration Management": "bg-cyan-50 border-cyan-200",
  "Data Protection": "bg-teal-50 border-teal-200",
  "Incident Response": "bg-red-50 border-red-200",
  "Vulnerability Management": "bg-orange-50 border-orange-200",
  "Network Security": "bg-indigo-50 border-indigo-200",
};

function priorityFromDomain(domain: string, failing: boolean): string {
  if (!failing) return "low";
  const high = ["Authentication & Identity", "Access Control", "Vulnerability Management", "Incident Response"];
  const medium = ["Data Protection", "Configuration Management", "Network Security"];
  if (high.includes(domain)) return "high";
  if (medium.includes(domain)) return "medium";
  return "low";
}

const COLUMNS = [
  { id: "not_tested", label: "To Do", desc: "Not yet tested", color: "bg-slate-100 text-slate-600", border: "border-slate-200" },
  { id: "failing",    label: "Failing", desc: "Requires remediation", color: "bg-red-100 text-red-700", border: "border-red-200" },
  { id: "passing",    label: "Passing", desc: "Evidence collected", color: "bg-green-100 text-green-700", border: "border-green-200" },
];

export default function Remediation() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [filterDomain, setFilterDomain] = useState("all");
  const [ownerPanelId, setOwnerPanelId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerDue, setOwnerDue] = useState("");

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

  const moveMutation = useMutation({
    mutationFn: async ({ controlId, status }: { controlId: string; status: string }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/controls/${controlId}/result`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-controls"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

    const ownerMutation = useMutation({
    mutationFn: async ({ controlId, ownerName, dueDate }: { controlId: string; ownerName: string; dueDate: string }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/controls/${controlId}/result`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownerName, dueDate: dueDate || undefined }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-controls"] });
      setOwnerPanelId(null);
      setOwnerName("");
      setOwnerDue("");
    },
  });

const controls: any[] = data?.controls ?? [];
  const domains = ["all", ...new Set(controls.map(c => c.domain))].sort();

  const filtered = filterDomain === "all" ? controls : controls.filter(c => c.domain === filterDomain);

  const byStatus = (status: string) =>
    filtered.filter(c => c.status === status || (status === "not_tested" && c.status === "not_tested"))
      .sort((a, b) => {
        const pa = priorityFromDomain(a.domain, a.status === "failing");
        const pb = priorityFromDomain(b.domain, b.status === "failing");
        const order = ["high", "medium", "low", "critical"];
        return order.indexOf(pa) - order.indexOf(pb);
      });

  const stats = {
    total: controls.length,
    failing: controls.filter(c => c.status === "failing").length,
    passing: controls.filter(c => c.status === "passing").length,
    notTested: controls.filter(c => c.status === "not_tested").length,
  };

  return (
    <div className="p-6 max-w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Remediation Board</h1>
          <p className="text-sm text-slate-500 mt-1">Track and move controls from failing to passing. Drag or use the action menu on each card.</p>
        </div>
        <a href="/gap-analysis" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Run AI Gap Analysis
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Controls", value: stats.total, color: "text-slate-900" },
          { label: "Failing", value: stats.failing, color: "text-red-600" },
          { label: "Passing", value: stats.passing, color: "text-green-600" },
          { label: "Not Tested", value: stats.notTested, color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Domain filter */}
      <div className="flex gap-2 flex-wrap">
        {domains.map(d => (
          <button key={d} onClick={() => setFilterDomain(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterDomain === d ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {d === "all" ? "All domains" : d}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-8 bg-slate-200 rounded-lg animate-pulse" />
              {[...Array(3)].map((_, j) => <div key={j} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map(col => {
            const cards = byStatus(col.id);
            return (
              <div key={col.id} className={`rounded-xl border ${col.border} bg-white/50 overflow-hidden`}>
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${col.color}`}>{cards.length}</span>
                      <span className="text-sm font-bold text-slate-800">{col.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{col.desc}</p>
                  </div>
                </div>

                <div className="p-3 space-y-2.5 min-h-32">
                  {cards.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">No controls here</div>
                  )}
                  {cards.map((c: any) => {
                    const priority = priorityFromDomain(c.domain, c.status === "failing");
                    const domainColor = DOMAIN_COLORS[c.domain] ?? "bg-slate-50 border-slate-200";
                    const priorCls = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low;

                    return (
                      <div key={c.controlId}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => setSelected(c)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{c.controlId}</span>
                            {c.status === "failing" && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorCls}`}>{priority}</span>
                            )}
                          </div>
                          {/* Move buttons */}
                          <div className="flex gap-1 flex-shrink-0">
                            {c.status !== "passing" && (
                              <button
                                onClick={e => { e.stopPropagation(); moveMutation.mutate({ controlId: c.controlId, status: "passing" }); }}
                                className="h-6 w-6 rounded flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                title="Mark passing"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                            )}
                            {c.status === "passing" && (
                              <button
                                onClick={e => { e.stopPropagation(); moveMutation.mutate({ controlId: c.controlId, status: "failing" }); }}
                                className="h-6 w-6 rounded flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                title="Mark failing"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 leading-snug mb-1.5">{c.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded border ${domainColor} font-medium`}>{c.domain}</span>
                          {c.automationLevel && (
                            <span className="text-xs text-slate-400">{c.automationLevel === "full" ? "Automated" : c.automationLevel === "partial" ? "Partial" : "Manual"}</span>
                          )}
                          {c.result?.ownerName && (
                            <span className="text-xs text-slate-500 font-medium">{c.result.ownerName}</span>
                          )}
                        </div>
                        {c.status === "failing" && c.result?.failureReason && (
                          <p className="text-xs text-red-600 mt-2 line-clamp-2">{c.result.failureReason}</p>
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

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selected.controlId}</span>
                <h2 className="text-base font-bold text-slate-900 mt-1">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Domain", value: selected.domain },
                  { label: "Status", value: selected.status === "passing" ? "Passing" : selected.status === "failing" ? "Failing" : "Not Tested" },
                  { label: "Automation", value: selected.automationLevel === "full" ? "Automated" : selected.automationLevel === "partial" ? "Partial" : "Manual" },
                  { label: "Owner", value: selected.result?.ownerName ?? "Unassigned" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>
              </div>
              {selected.remediationGuidance && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Remediation Guidance</p>
                  <p className="text-sm text-blue-900 leading-relaxed">{selected.remediationGuidance}</p>
                </div>
              )}
              {selected.result?.failureReason && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Failure Reason</p>
                  <p className="text-sm text-red-900">{selected.result.failureReason}</p>
                </div>
              )}
                              {/* Owner / SLA Assignment */}
                {ownerPanelId === selected.controlId ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 mb-4">
                    <p className="text-sm font-bold text-slate-800">Assign Owner &amp; SLA</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Owner name</label>
                        <input
                          type="text"
                          value={ownerName}
                          onChange={e => setOwnerName(e.target.value)}
                          placeholder="Jane Smith"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
                        <input
                          type="date"
                          value={ownerDue}
                          onChange={e => setOwnerDue(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => ownerMutation.mutate({ controlId: selected.controlId, ownerName, dueDate: ownerDue })}
                        disabled={ownerMutation.isPending}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {ownerMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => setOwnerPanelId(null)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mb-4">
                    {selected.result?.ownerName && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="font-medium">{selected.result.ownerName}</span>
                      </div>
                    )}
                    {selected.result?.dueDate && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>{new Date(selected.result.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { setOwnerPanelId(selected.controlId); setOwnerName(selected.result?.ownerName ?? ""); setOwnerDue(selected.result?.dueDate ? new Date(selected.result.dueDate).toISOString().slice(0, 10) : ""); }}
                      className="text-xs text-slate-400 hover:text-blue-600 font-medium"
                    >
                      {selected.result?.ownerName ? "Edit owner" : "Assign owner"}
                    </button>
                  </div>
                )}
<div className="flex gap-2 pt-2">
                <button
                  onClick={() => { moveMutation.mutate({ controlId: selected.controlId, status: "passing" }); setSelected(null); }}
                  className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                >
                  Mark Passing
                </button>
                <button
                  onClick={() => { moveMutation.mutate({ controlId: selected.controlId, status: "failing" }); setSelected(null); }}
                  className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50"
                >
                  Mark Failing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
