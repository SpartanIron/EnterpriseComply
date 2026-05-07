import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const CATALOG_CATEGORIES: Record<string, string> = {
  commercial: "Commercial",
  federal: "Federal (US Gov)",
  "best-practice": "Best Practice",
};

const CATEGORY_BADGE: Record<string, string> = {
  commercial: "bg-blue-100 text-blue-700",
  federal: "bg-purple-100 text-purple-700",
  "best-practice": "bg-slate-100 text-slate-600",
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

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Frameworks</h1>
          <p className="text-slate-500 mt-1">Manage your active compliance frameworks</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Framework
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : frameworks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-3xl mb-4">🛡</p>
          <p className="font-semibold text-slate-900 mb-2">No frameworks activated</p>
          <p className="text-slate-500 text-sm mb-5">Add your first framework to start tracking compliance.</p>
          <button onClick={() => setShowAdd(true)} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Add a framework →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {frameworks.map((fw: any) => <FrameworkDetailCard key={fw.id} fw={fw} />)}
        </div>
      )}

      {/* Add Framework Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Add Frameworks</h2>
                <button onClick={() => setShowAdd(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 flex-1">
              {available.length === 0 ? (
                <p className="text-center text-slate-500 py-8">All available frameworks are already activated.</p>
              ) : (
                Object.entries(CATALOG_CATEGORIES).map(([cat, label]) => {
                  const catFrameworks = available.filter(f => f.category === cat);
                  if (catFrameworks.length === 0) return null;
                  return (
                    <div key={cat} className="mb-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{label}</p>
                      <div className="space-y-2">
                        {catFrameworks.map((f: any) => (
                          <button
                            key={f.key}
                            onClick={() => activateMutation.mutate([f.key])}
                            disabled={activateMutation.isPending}
                            className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">{f.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <span className="text-xs text-slate-400">{f.controlCount} controls</span>
                              <span className="text-blue-600 font-semibold text-sm group-hover:translate-x-0.5 transition-transform">→</span>
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
  const hasActivity = total > 0 && (passing > 0 || failing > 0);

  const scoreColor = !hasActivity ? "text-slate-400" : score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-600";
  const barColor = !hasActivity ? "bg-slate-200" : score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-100 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 pr-3">
          <p className="font-bold text-slate-900 text-base leading-snug">{fw.name}</p>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-2 ${CATEGORY_BADGE[fw.category] ?? "bg-slate-100 text-slate-600"}`}>
            {CATALOG_CATEGORIES[fw.category] ?? fw.category}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-3xl font-bold leading-none ${scoreColor}`}>{Math.round(score)}%</p>
          <p className="text-xs text-slate-400 mt-1">{hasActivity ? "compliant" : "not started"}</p>
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${Math.max(score, score > 0 ? 2 : 0)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-lg p-2.5 ${passing > 0 ? "bg-green-50" : "bg-slate-50"}`}>
          <p className={`text-lg font-bold ${passing > 0 ? "text-green-700" : "text-slate-400"}`}>{passing}</p>
          <p className={`text-xs font-medium ${passing > 0 ? "text-green-600" : "text-slate-400"}`}>Passing</p>
        </div>
        <div className={`rounded-lg p-2.5 ${failing > 0 ? "bg-red-50" : "bg-slate-50"}`}>
          <p className={`text-lg font-bold ${failing > 0 ? "text-red-600" : "text-slate-400"}`}>{failing}</p>
          <p className={`text-xs font-medium ${failing > 0 ? "text-red-500" : "text-slate-400"}`}>Failing</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-slate-500">{untested}</p>
          <p className="text-xs font-medium text-slate-400">Untested</p>
        </div>
      </div>
    </div>
  );
}
