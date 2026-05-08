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

const BLANK_FORM = { name: "", website: "", category: "saas", riskLevel: "medium", hasDataProcessingAgreement: false, description: "" };

export default function Vendors() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

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
      setForm({ ...BLANK_FORM });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/vendors/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-vendors"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/orgs/${orgId}/vendors/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-vendors"] });
      setConfirmDelete(null);
    },
  });

  const openEdit = (v: any) => {
    setEditing(v);
    setForm({
      name: v.name ?? "",
      website: v.website ?? "",
      category: v.category ?? "saas",
      riskLevel: v.riskLevel ?? "medium",
      hasDataProcessingAgreement: v.hasDataProcessingAgreement ?? false,
      description: v.description ?? "",
    });
  };

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
          <PrimaryButton onClick={() => { setForm({ ...BLANK_FORM }); setShowAdd(true); }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Vendor
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${vendors.length > 0 ? "text-slate-900" : "text-slate-300"}`}>{vendors.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Vendors</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${(byRisk.critical + byRisk.high) > 0 ? "text-red-600" : vendors.length > 0 ? "text-green-600" : "text-slate-300"}`}>{byRisk.critical + byRisk.high}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">High / Critical Risk</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className={`text-2xl font-bold leading-none ${byRisk.missingDpa > 0 ? "text-amber-500" : vendors.length > 0 ? "text-green-600" : "text-slate-300"}`}>{byRisk.missingDpa}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Missing DPA</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : vendors.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={BuildingIcon}
            title="No vendors tracked yet"
            body="Add your third-party vendors to manage risk and demonstrate due diligence for auditors."
            action={<PrimaryButton onClick={() => setShowAdd(true)}>Add vendor</PrimaryButton>}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "SOC 2 CC9.2", body: "Requires identifying and assessing the risk of vendors who could affect the security and availability of your services." },
              { label: "GDPR / DPA", body: "Data Processing Agreements are legally required for all vendors who process personal data on your behalf. Track DPA status here." },
              { label: "Risk tiers", body: "Categorize vendors as critical, high, medium, or low risk. High-risk vendors typically require annual security assessments and SOC 2 reports." },
            ].map(({ label, body }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md mb-2">{label}</span>
                <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
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
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v: any, idx: number) => {
                const risk = RISK_CONFIG[v.riskLevel] ?? RISK_CONFIG.medium;
                return (
                  <tr key={v.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors group`}>
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
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(v)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setConfirmDelete(v.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vendor name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="Salesforce" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Website</label>
                <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700" placeholder="https://salesforce.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none" placeholder="What does this vendor do?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700">
                    {["saas", "infrastructure", "services", "hardware", "software"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Risk Level</label>
                  <select value={form.riskLevel} onChange={e => setForm(f => ({ ...f, riskLevel: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-700">
                    {["critical", "high", "medium", "low"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.hasDataProcessingAgreement} onChange={e => setForm(f => ({ ...f, hasDataProcessingAgreement: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-green-800" />
                <span className="text-sm text-slate-700">Data Processing Agreement (DPA) signed</span>
              </label>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-2">
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button
                onClick={() => editing ? updateMutation.mutate({ id: editing.id, data: form }) : addMutation.mutate()}
                disabled={!form.name || (editing ? updateMutation.isPending : addMutation.isPending)}
                className="flex-1 py-2 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-900 disabled:opacity-50 transition-colors"
              >
                {(editing ? updateMutation.isPending : addMutation.isPending) ? "Saving..." : editing ? "Save Changes" : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-900 mb-2">Remove vendor?</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently remove this vendor from your registry.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete!)} disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
