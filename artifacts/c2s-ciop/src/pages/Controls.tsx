import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, SectionLabel } from "@/components/ui/PageHeader";

function OwnerAssignment({ orgId, control, onSuccess }: { orgId: number; control: any; onSuccess: () => void }) {
  const [ownerName, setOwnerName] = useState(control.result?.ownerName ?? "");
  const [dueDate, setDueDate] = useState(control.result?.dueDate ? control.result.dueDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const { data: peopleData } = useQuery<{ people: any[] }>({
    queryKey: ["people", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/people`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });
  const people: any[] = peopleData?.people ?? [];

  async function save() {
    setSaving(true);
    await fetch(apiUrl(`/orgs/${orgId}/controls/${control.controlId}/result`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ownerName: ownerName || null, dueDate: dueDate || null }),
    });
    setSaving(false);
    onSuccess();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-slate-800">Owner Assignment</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Owner</label>
          {people.length > 0 ? (
            <select
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {people.map((p: any) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Enter owner name"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

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
  const [ownerPanelId, setOwnerPanelId] = useState<string | null>(null);

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
  const passRate = total > 0 ? Math.round((stats.passing / total) * 100) : 0;

  const FILTERS: [string, string, number][] = [
    ["all", "All controls", total],
    ["passing", "Passing", stats.passing],
    ["failing", "Failing", stats.failing],
    ["not_tested", "Not Tested", stats.notTested],
  ];

  const STAT_CARDS = [
    {
      label: "Total Controls",
      value: total,
      sub: "across all domains",
      valueColor: "text-slate-900",
      topBar: "bg-slate-300",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      iconBg: "bg-slate-50 text-slate-500",
      badge: null,
    },
    {
      label: "Passing",
      value: stats.passing,
      sub: `${passRate}% pass rate`,
      valueColor: stats.passing > 0 ? "text-green-700" : "text-slate-400",
      topBar: "bg-green-500",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      iconBg: stats.passing > 0 ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400",
      badge: stats.passing > 0 ? { label: `${passRate}%`, cls: "bg-green-50 text-green-700 ring-1 ring-green-200" } : null,
    },
    {
      label: "Failing",
      value: stats.failing,
      sub: stats.failing > 0 ? "requires remediation" : "none failing",
      valueColor: stats.failing > 0 ? "text-red-600" : "text-slate-400",
      topBar: stats.failing > 0 ? "bg-red-500" : "bg-slate-200",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      iconBg: stats.failing > 0 ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400",
      badge: stats.failing > 0 ? { label: "Action needed", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" } : null,
    },
    {
      label: "Not Tested",
      value: stats.notTested,
      sub: "pending evaluation",
      valueColor: "text-slate-600",
      topBar: "bg-amber-400",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: stats.notTested > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400",
      badge: null,
    },
  ];

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Controls"
        subtitle="Universal Control Objectives mapped across all active frameworks"
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <div className={`h-[3px] ${s.topBar}`} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>{s.icon}</div>
                {s.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge.cls}`}>{s.badge.label}</span>
                )}
              </div>
              <p className={`text-2xl font-bold leading-none ${s.valueColor}`}>{s.value}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{s.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
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

                              {/* Owner assignment */}
                              {ownerPanelId === c.controlId ? (
                                <OwnerAssignment
                                  orgId={orgId}
                                  control={c}
                                  onSuccess={() => {
                                    setOwnerPanelId(null);
                                    qc.invalidateQueries({ queryKey: ["org-controls"] });
                                  }}
                                />
                              ) : (
                                <div className="flex items-center gap-3">
                                  {c.result?.ownerName && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                      <span className="font-medium">{c.result.ownerName}</span>
                                    </div>
                                  )}
                                  {c.result?.dueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      <span>{new Date(c.result.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setOwnerPanelId(c.controlId)}
                                    className="text-xs text-slate-400 hover:text-blue-600 font-medium"
                                  >
                                    {c.result?.ownerName ? "Edit owner" : "Assign owner"}
                                  </button>
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
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
              <p className="text-slate-500 text-sm">No controls match the current filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
