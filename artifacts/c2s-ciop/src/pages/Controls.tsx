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
  full: { label: "Automated", cls: "bg-green-50 text-green-700 ring-1 ring-green-200" },
  partial: { label: "Partial", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  manual: { label: "Manual", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
};

const FRAMEWORK_COLORS: Record<string, string> = {
  soc2: "bg-green-50 text-green-700 ring-1 ring-green-200",
  iso27001: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  "nist-csf": "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  "nist-800-53": "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  "nist-800-171": "bg-green-50 text-green-700 ring-1 ring-green-200",
  hipaa: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  pci: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  gdpr: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  fedramp: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  cmmc: "bg-green-50 text-green-700 ring-1 ring-green-200",
  ccpa: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
};

interface CascadeImpact {
  frameworkKey: string;
  frameworkName: string;
  isActive: boolean;
  requirements: { controlId: string; name: string; confidence: number }[];
}

function CascadeModal({
  controlName,
  impact,
  totalFrameworks,
  activeFrameworks,
  onClose,
}: {
  controlName: string;
  impact: CascadeImpact[];
  totalFrameworks: number;
  activeFrameworks: number;
  onClose: () => void;
}) {
  const active = impact.filter(f => f.isActive);
  const inactive = impact.filter(f => !f.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">Control Marked Passing</p>
                <p className="text-green-100 text-sm mt-0.5 leading-tight">{controlName}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors mt-0.5">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="bg-white/20 rounded-lg px-3 py-2 text-center">
              <div className="text-white text-xl font-bold leading-none">{activeFrameworks}</div>
              <div className="text-green-100 text-xs mt-0.5">Active frameworks satisfied</div>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-2 text-center">
              <div className="text-white text-xl font-bold leading-none">{totalFrameworks}</div>
              <div className="text-green-100 text-xs mt-0.5">Total frameworks mapped</div>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-2 text-center">
              <div className="text-white text-xl font-bold leading-none">
                {impact.reduce((sum, f) => sum + f.requirements.length, 0)}
              </div>
              <div className="text-green-100 text-xs mt-0.5">Requirements satisfied</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Your active frameworks</p>
              <div className="space-y-2.5">
                {active.map(fw => (
                  <div key={fw.frameworkKey} className="bg-green-50 border border-green-100 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${FRAMEWORK_COLORS[fw.frameworkKey] ?? "bg-slate-100 text-slate-600"}`}>
                        {fw.frameworkKey.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{fw.frameworkName}</span>
                      <span className="ml-auto text-xs text-green-600 font-semibold">{fw.requirements.length} req{fw.requirements.length !== 1 ? "s" : ""} satisfied</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fw.requirements.map(r => (
                        <span key={r.controlId} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-green-200 rounded-lg text-xs font-mono text-slate-700">
                          <svg className="h-3 w-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          {r.controlId}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Additional frameworks this covers (not yet active)</p>
              <div className="space-y-2">
                {inactive.map(fw => (
                  <div key={fw.frameworkKey} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 opacity-75">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${FRAMEWORK_COLORS[fw.frameworkKey] ?? "bg-slate-100 text-slate-600"}`}>
                        {fw.frameworkKey.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-slate-600">{fw.frameworkName}</span>
                      <span className="ml-auto text-xs text-slate-400">{fw.requirements.length} req{fw.requirements.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fw.requirements.slice(0, 6).map(r => (
                        <span key={r.controlId} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded">{r.controlId}</span>
                      ))}
                      {fw.requirements.length > 6 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-xs rounded">+{fw.requirements.length - 6} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impact.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">No framework mappings found for this control.</div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-green-800 hover:bg-green-900 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnerPanel({ orgId, controlId, defaultOwner, defaultDue, onSuccess, onCancel }: {
  orgId: number;
  controlId: string;
  defaultOwner: string;
  defaultDue: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState(defaultOwner);
  const [due, setDue] = useState(defaultDue);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/controls/${controlId}/result`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownerName: owner, dueDate: due || undefined }),
      });
      return res.json();
    },
    onSuccess,
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-slate-800">Assign Owner</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Owner name</label>
          <input
            type="text"
            value={owner}
            onChange={e => setOwner(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900 disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Controls() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("passing");
  const [overrideNote, setOverrideNote] = useState("");
  const [ownerPanelId, setOwnerPanelId] = useState<string | null>(null);
  const [cascadeModal, setCascadeModal] = useState<{ controlId: string; controlName: string; data: { impact: CascadeImpact[]; totalFrameworks: number; activeFrameworks: number } } | null>(null);

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
    onSuccess: async (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["org-controls"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      const controlId = variables.controlId;
      const savedStatus = variables.status;
      const controlName = controls.find(c => c.controlId === controlId)?.name ?? controlId;

      setOverrideId(null);
      setOverrideNote("");

      if (savedStatus === "passing" && orgId) {
        try {
          const res = await fetch(apiUrl(`/orgs/${orgId}/controls/${controlId}/framework-impact`), { credentials: "include" });
          if (res.ok) {
            const impactData = await res.json();
            if (impactData.impact?.length > 0) {
              setCascadeModal({ controlId, controlName, data: impactData });
            }
          }
        } catch {
          // Non-critical - don't block the UI
        }
      }
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
      {cascadeModal && (
        <CascadeModal
          controlName={cascadeModal.controlName}
          impact={cascadeModal.data.impact}
          totalFrameworks={cascadeModal.data.totalFrameworks}
          activeFrameworks={cascadeModal.data.activeFrameworks}
          onClose={() => setCascadeModal(null)}
        />
      )}

      <PageHeader
        title="Controls"
        subtitle="Security controls that satisfy every active framework. Implement once, prove compliance continuously."
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
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3.5">
                                  <p className="text-xs font-bold text-green-700 mb-1 uppercase tracking-wide">Remediation Guidance</p>
                                  <p className="text-sm text-green-900 leading-relaxed">{c.remediationGuidance}</p>
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
                                <OwnerPanel
                                  orgId={orgId}
                                  controlId={c.controlId}
                                  defaultOwner={c.result?.ownerName ?? ""}
                                  defaultDue={c.result?.dueDate ? new Date(c.result.dueDate).toISOString().slice(0, 10) : ""}
                                  onSuccess={() => {
                                    setOwnerPanelId(null);
                                    qc.invalidateQueries({ queryKey: ["org-controls"] });
                                  }}
                                  onCancel={() => setOwnerPanelId(null)}
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
                                    className="text-xs text-slate-400 hover:text-green-800 font-medium"
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
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
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
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
                                    rows={3}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => overrideMutation.mutate({ controlId: c.controlId, status: overrideStatus, notes: overrideNote })}
                                      disabled={overrideMutation.isPending}
                                      className="px-4 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900 disabled:opacity-50 transition-colors"
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
                                  className="text-sm text-green-800 hover:text-green-700 font-semibold"
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
