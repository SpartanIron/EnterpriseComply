import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/components/ui/PageHeader";

const CATEGORY_CONFIG: Record<string, { badge: string; label: string; accent: string }> = {
  commercial: { badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200", label: "Commercial", accent: "#2563eb" },
  federal: { badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", label: "Federal", accent: "#7c3aed" },
  "best-practice": { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: "Best Practice", accent: "#64748b" },
};

function ProgressRing({ score, size = 64, hasActivity }: { score: number; size?: number; hasActivity: boolean }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (hasActivity ? (score / 100) * circ : 0);
  const color = !hasActivity ? "#cbd5e1" : score >= 75 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444";
  const textFill = !hasActivity ? "#94a3b8" : score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={13} fontWeight="bold" fill={textFill}>
        {Math.round(score)}%
      </text>
      {!hasActivity && (
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#94a3b8">
          not started
        </text>
      )}
    </svg>
  );
}

export default function Frameworks() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ key: string; name: string } | null>(null);

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data: fwData, isLoading } = useQuery<{ frameworks: any[] }>({
    queryKey: ["org-frameworks", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/frameworks`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const { data: catalogData } = useQuery<{ frameworks: any[] }>({
    queryKey: ["framework-catalog"],
    queryFn: async () => (await fetch(apiUrl("/frameworks/catalog"), { credentials: "include" })).json(),
  });

  const activateMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/frameworks`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ frameworkKeys: keys }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-frameworks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowAdd(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/frameworks/${key}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-frameworks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setConfirmRemove(null);
    },
  });

  const frameworks = fwData?.frameworks ?? [];
  const catalog = catalogData?.frameworks ?? [];
  const activeKeys = new Set(frameworks.map(f => f.frameworkKey));
  const available = catalog.filter(f => !activeKeys.has(f.key));

  const CATALOG_CATS: Record<string, string> = {
    commercial: "Commercial",
    federal: "Federal (US Gov)",
    "best-practice": "Best Practice",
  };

  const ShieldIcon = (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Frameworks"
        subtitle="Manage your active compliance frameworks"
        actions={
          <PrimaryButton onClick={() => setShowAdd(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Framework
          </PrimaryButton>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : frameworks.length === 0 ? (
        <>
          <EmptyState
            icon={ShieldIcon}
            title="No frameworks activated"
            body="Add SOC 2, FedRAMP, CMMC, ISO 27001, or any of 12 supported frameworks to start tracking compliance."
            action={<PrimaryButton onClick={() => setShowAdd(true)}>Add your first framework</PrimaryButton>}
          />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: "shield", title: "Universal Control Objectives", body: "Add a framework and your 41 UCO controls automatically map to it. Implement once, satisfy all simultaneously." },
              { icon: "chart", title: "Real-time Compliance Score", body: "Track your compliance posture with live scoring. Connect integrations to run automated tests against your controls." },
              { icon: "check", title: "Audit-ready Evidence", body: "Every passing control generates evidence. Share your Trust Center URL with auditors instead of filling spreadsheets." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                  {icon === "shield" && <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                  {icon === "chart" && <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                  {icon === "check" && <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <p className="font-semibold text-slate-800 text-sm mb-1">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {frameworks.map((fw: any) => (
              <FrameworkDetailCard
                key={fw.id}
                fw={fw}
                onRemove={() => setConfirmRemove({ key: fw.frameworkKey, name: fw.name })}
              />
            ))}
          </div>
          {available.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Available to add ({available.length})</p>
                  <p className="text-xs text-slate-400 mt-0.5">Adding any of these reuses your existing UCO control work - no duplicate effort</p>
                </div>
                <PrimaryButton onClick={() => setShowAdd(true)}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Framework
                </PrimaryButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {available.slice(0, 6).map((f: any) => {
                  const cat = CATEGORY_CONFIG[f.category] ?? { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", accent: "#64748b" };
                  return (
                    <button
                      key={f.key}
                      onClick={() => activateMutation.mutate([f.key])}
                      disabled={activateMutation.isPending}
                      className="bg-white border border-dashed border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group disabled:opacity-60"
                    >
                      <div className="h-[2px] -mt-4 -mx-4 mb-3 rounded-t-xl" style={{ background: cat.accent }} />
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-700 text-sm group-hover:text-blue-700 transition-colors truncate">{f.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">{CATALOG_CATS[f.category] ?? f.category}</p>
                        </div>
                        <svg className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Framework Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Add Framework</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a framework to start tracking compliance</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 flex-1">
              {available.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-8">All available frameworks are already activated.</p>
              ) : (
                Object.entries(CATALOG_CATS).map(([cat, label]) => {
                  const catFws = available.filter(f => f.category === cat);
                  if (catFws.length === 0) return null;
                  return (
                    <div key={cat} className="mb-5">
                      <SectionLabel>{label}</SectionLabel>
                      <div className="space-y-1.5">
                        {catFws.map((f: any) => (
                          <button
                            key={f.key}
                            onClick={() => activateMutation.mutate([f.key])}
                            disabled={activateMutation.isPending}
                            className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group disabled:opacity-60"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{f.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.description}</p>
                            </div>
                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                              <span className="text-xs text-slate-400 font-medium">{f.controlCount} controls</span>
                              <svg className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Remove framework?</h3>
                <p className="text-xs text-slate-400 mt-0.5">{confirmRemove.name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              This will remove <span className="font-semibold text-slate-700">{confirmRemove.name}</span> from your active frameworks. Your compliance data and evidence will not be deleted - you can re-add this framework at any time.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate(confirmRemove.key)}
                disabled={removeMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removeMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FrameworkDetailCard({ fw, onRemove }: { fw: any; onRemove: () => void }) {
  const score = fw.complianceScore ?? 0;
  const passing = fw.passingControls ?? 0;
  const failing = fw.failingControls ?? 0;
  const untested = fw.notTestedControls ?? 0;
  const total = passing + failing + untested;
  const hasActivity = passing > 0 || failing > 0;

  const cat = CATEGORY_CONFIG[fw.category] ?? { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: fw.category, accent: "#64748b" };
  const statusLabel = !hasActivity ? "Not started" : score >= 75 ? "On track" : score >= 50 ? "Needs attention" : "At risk";
  const statusColor = !hasActivity ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const statusBg = !hasActivity ? "bg-slate-50" : score >= 75 ? "bg-green-50" : score >= 50 ? "bg-amber-50" : "bg-red-50";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group overflow-hidden">
      {/* Colored top accent */}
      <div className="h-[3px]" style={{ background: cat.accent }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${cat.badge}`}>{cat.label}</span>
            </div>
            <p className="font-bold text-slate-900 text-base leading-snug">{fw.name}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-md ${statusBg} ${statusColor}`}>
              {!hasActivity ? (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 inline-block" />
              ) : score >= 75 ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
              )}
              {statusLabel}
            </span>
          </div>
          <div className="flex items-start gap-2 flex-shrink-0">
            <ProgressRing score={score} size={64} hasActivity={hasActivity} />
            <button
              onClick={onRemove}
              title="Remove framework"
              className="mt-0.5 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Passing" value={passing} activeColor="bg-green-50" activeText="text-green-700" activeSub="text-green-600" active={passing > 0} />
          <Stat label="Failing" value={failing} activeColor="bg-red-50" activeText="text-red-600" activeSub="text-red-500" active={failing > 0} />
          <Stat label="Untested" value={untested} activeColor="bg-slate-50" activeText="text-slate-600" activeSub="text-slate-400" active={true} neutral />
        </div>

        {total > 0 && (
          <div className="mt-3 flex gap-0.5 h-1.5 rounded-full overflow-hidden">
            {passing > 0 && <div className="bg-green-400" style={{ width: `${(passing / total) * 100}%` }} />}
            {failing > 0 && <div className="bg-red-400" style={{ width: `${(failing / total) * 100}%` }} />}
            {untested > 0 && <div className="bg-slate-200" style={{ width: `${(untested / total) * 100}%` }} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, activeColor, activeText, activeSub, active, neutral }: {
  label: string; value: number; activeColor: string; activeText: string; activeSub: string; active: boolean; neutral?: boolean;
}) {
  const bg = (active && !neutral) || neutral ? activeColor : "bg-slate-50";
  const textCls = (active && !neutral) ? activeText : "text-slate-400";
  const subCls = (active && !neutral) ? activeSub : "text-slate-400";
  return (
    <div className={`rounded-lg p-2.5 text-center ${bg}`}>
      <p className={`text-base font-bold leading-none ${textCls}`}>{value}</p>
      <p className={`text-xs font-medium mt-0.5 ${subCls}`}>{label}</p>
    </div>
  );
}
