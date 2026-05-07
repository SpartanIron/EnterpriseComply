import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

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

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-slate-500 mt-1">Third-party vendor risk management — {vendors.length} vendors tracked</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Vendor
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-4xl mb-4">🏢</p>
          <p className="font-semibold text-slate-900 mb-2">No vendors tracked yet</p>
          <p className="text-slate-500 text-sm mb-5">Add your third-party vendors to manage risk and demonstrate due diligence.</p>
          <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Add vendor</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">DPA</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Assessed</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v: any) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{v.name}</p>
                    {v.website && <p className="text-xs text-slate-400">{v.website}</p>}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{v.category}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGE[v.riskLevel] ?? RISK_BADGE.medium}`}>{v.riskLevel}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.hasDataProcessingAgreement ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {v.hasDataProcessingAgreement ? "Signed" : "Missing"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {v.lastAssessedAt ? new Date(v.lastAssessedAt).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add Vendor</h2>
              <button onClick={() => setShowAdd(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Salesforce" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://salesforce.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["saas", "infrastructure", "services", "hardware", "software"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Risk Level</label>
                  <select value={form.riskLevel} onChange={e => setForm({ ...form, riskLevel: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["critical", "high", "medium", "low"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => addMutation.mutate()} disabled={!form.name || addMutation.isPending} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addMutation.isPending ? "Adding..." : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
