import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/components/ui/PageHeader";

const CATEGORY_CONFIG: Record<string, { badge: string; label: string }> = {
  commercial: { badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200", label: "Commercial" },
  federal: { badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", label: "Federal" },
  "best-practice": { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: "Best Practice" },
};

export default function Frameworks() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

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
    enabled: showAdd,
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : frameworks.length === 0 ? (
        <EmptyState
          icon={ShieldIcon}
          title="No frameworks activated"
          body="Add SOC 2, FedRAMP, CMMC, ISO 27001, or any of 12 supported frameworks to start tracking compliance."
          action={<PrimaryButton onClick={() => setShowAdd(true)}>Add your first framework</PrimaryButton>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {frameworks.map((fw: any) => <FrameworkDetailCard key={fw.id} fw={fw} />)}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Add Frameworks</h2>
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
    </div>
  );
}

function FrameworkDetailCard({ fw }: { fw: any }) {
  const score = fw.complianceScore ?? 0;
  const passing = fw.passingControls ?? 0;
  const failing = fw.failingControls ?? 0;
  const untested = fw.notTestedControls ?? 0;
  const total = passing + failing + untested;
  const hasActivity = passing > 0 || failing > 0;

  const cat = CATEGORY_CONFIG[fw.category] ?? { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: fw.category };
  const scoreColor = !hasActivity ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";
  const barColor = !hasActivity ? "bg-slate-200" : score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-100 transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 text-sm leading-snug">{fw.name}</p>
          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5 ${cat.badge}`}>{cat.label}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold leading-none ${scoreColor}`}>{Math.round(score)}%</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">{hasActivity ? "compliant" : "not started"}</p>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>

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
