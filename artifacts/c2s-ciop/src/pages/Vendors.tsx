import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { PageHeader, EmptyState, PrimaryButton } from "@/components/ui/PageHeader";

const RISK_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  high: { label: "High", cls: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  low: { label: "Low", cls: "bg-green-50 text-green-700 ring-1 ring-green-200" },
};

const BuildingIcon = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export default function Vendors() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", website: "", category: "saas", riskLevel: "medium" });

  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ vendors: any[] }>({
    queryKey: ["org-vendors", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/vendors`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/vendors`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-vendors"] });
      setShowAdd(false);
      setForm({ name: "", website: "", category: "saas", riskLevel: "medium" });
    },
  });

  const vendors = data?.vendors ?? [];
  const byRisk = {
    critical: vendors.filter(v => v.riskLevel === "critical").length,
    high: vendors.filter(v => v.riskLevel === "high").length,
    missingDpa: vendors.filter(v => !v.hasDataProcessingAgreement).length,
  };

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="Vendors"
        subtitle="Third-party vendor risk management"
        actions={
          <PrimaryButton onClick={() => setShowAdd(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </PrimaryButton>
        }
      />

      {vendors.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900 leading-none">{vendors.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total Vendors</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${(byRisk.critical + byRisk.high) > 0 ? "text-red-600" : "text-slate-400"}`}>{byRisk.critical + byRisk.high}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">High / Critical Risk</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${byRisk.missingDpa > 0 ? "text-amber-500" : "text-green-600"}`}>{byRisk.missingDpa}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Missing DPA</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="No vendors tracked yet"
          body="Add your third-party vendors to manage risk and demonstrate due diligence for auditors."
          action={<PrimaryButton onClick={() => setShowAdd(true)}>Add vendor</PrimaryButton>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Level</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">DPA</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Last Assessed</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v: any, idx: number) => {
                const risk = RISK_CONFIG[v.riskLevel] ?? RISK_CONFIG.medium;
                return (
                  <tr key={v.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors`}>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-900">{v.name}</p>
                        {v.website && <p className="text-xs text-slate-400 mt-0.5 truncate">{v.website}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium capitalize">{v.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${risk.cls}`}>{risk.label}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${v.hasDataProcessingAgreement ? "bg-green-50 text-green-700 ring-1 ring-green-200" : "bg-red-50 text-red-600 ring-1 ring-red-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${v.hasDataProcessingAgreement ? "bg-green-500" : "bg-red-500"}`} />
                        {v.hasDataProcessingAgreement ? "Signed" : "Missing"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">{v.lastAssessedAt ? new Date(v.lastAssessedAt).toLocaleDateString() : "Never"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add Vendor</h2>
              <button onClick={() => setShowAdd(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vendor name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Salesforce"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Website</label>
                <input
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://salesforce.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["saas", "infrastructure", "services", "hardware", "software"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Risk Level</label>
                  <select
                    value={form.riskLevel}
                    onChange={e => setForm({ ...form, riskLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["critical", "high", "medium", "low"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.name || addMutation.isPending}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {addMutation.isPending ? "Adding..." : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
