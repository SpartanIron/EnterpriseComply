import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const ASSET_TYPES = ["Server", "Workstation", "Cloud Service", "SaaS Application", "Database", "Network Device", "Mobile Device", "Storage", "API / Service", "Physical Security System", "Other"];
const ENVIRONMENTS = ["Production", "Staging", "Development", "DR / Backup", "Corporate IT", "Other"];
const DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Restricted / CUI", "Secret"];
const SCOPING_TAGS = ["In-Scope", "Out-of-Scope", "Partially In-Scope"];

type Asset = {
  id: number;
  name: string;
  type: string;
  environment: string;
  owner: string;
  dataClassification: string;
  scopingTag: string;
  description: string;
  ipAddress?: string;
  vendor?: string;
  dataFlows?: string;
  createdAt: string;
};

export default function AssetInventory() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [filterScope, setFilterScope] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<string>("all");
  const [form, setForm] = useState({
    name: "", type: "Server", environment: "Production",
    owner: "", dataClassification: "Confidential", scopingTag: "In-Scope",
    description: "", ipAddress: "", vendor: "", dataFlows: "",
  });

  const { data, isLoading } = useQuery<{ assets: Asset[] }>({
    queryKey: ["assets", orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/assets`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiFetch(`/orgs/${orgId}/assets`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); setShowModal(false); resetForm(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiFetch(`/orgs/${orgId}/assets/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); setShowModal(false); setEditingAsset(null); resetForm(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  function resetForm() {
    setForm({ name: "", type: "Server", environment: "Production", owner: "", dataClassification: "Confidential", scopingTag: "In-Scope", description: "", ipAddress: "", vendor: "", dataFlows: "" });
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setForm({ name: asset.name, type: asset.type, environment: asset.environment, owner: asset.owner, dataClassification: asset.dataClassification, scopingTag: asset.scopingTag, description: asset.description, ipAddress: asset.ipAddress || "", vendor: asset.vendor || "", dataFlows: asset.dataFlows || "" });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingAsset) { updateMutation.mutate({ id: editingAsset.id, ...form }); }
    else { createMutation.mutate(form); }
  }

  const assets = data?.assets ?? [];
  const filtered = assets.filter(a => {
    if (filterScope !== "all" && a.scopingTag !== filterScope) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterEnv !== "all" && a.environment !== filterEnv) return false;
    return true;
  });

  const inScope = assets.filter(a => a.scopingTag === "In-Scope").length;
  const outScope = assets.filter(a => a.scopingTag === "Out-of-Scope").length;
  const partial = assets.filter(a => a.scopingTag === "Partially In-Scope").length;
  const cuiAssets = assets.filter(a => a.dataClassification === "Restricted / CUI").length;

  const SCOPE_COLORS: Record<string, string> = {
    "In-Scope": "bg-green-100 text-green-700",
    "Out-of-Scope": "bg-slate-100 text-slate-600",
    "Partially In-Scope": "bg-yellow-100 text-yellow-700",
  };
  const CLASS_COLORS: Record<string, string> = {
    "Public": "bg-slate-100 text-slate-500",
    "Internal": "bg-blue-100 text-blue-700",
    "Confidential": "bg-orange-100 text-orange-700",
    "Restricted / CUI": "bg-red-100 text-red-700",
    "Secret": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Asset Inventory & Scope Definition</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define your system boundary for FedRAMP, SOC 2, CMMC, and ISO 27001 assessments. Required for Phase 1 scoping.</p>
        </div>
        <button
          onClick={() => { setEditingAsset(null); resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Asset
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Assets", value: assets.length, color: "text-slate-800" },
          { label: "In-Scope", value: inScope, color: "text-green-700" },
          { label: "Partially In-Scope", value: partial, color: "text-yellow-700" },
          { label: "CUI / Restricted", value: cuiAssets, color: "text-red-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={filterScope} onChange={e => setFilterScope(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="all">All Scope Tags</option>
          {SCOPING_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="all">All Asset Types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterEnv} onChange={e => setFilterEnv(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="all">All Environments</option>
          {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {assets.length} assets</span>
      </div>

      {/* Asset Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading assets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-700">No assets yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add your first asset to define the system boundary for your compliance assessments.</p>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">Add first asset</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Environment</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Data Class</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Scope</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{asset.name}</p>
                    {asset.ipAddress && <p className="text-xs text-slate-400 mt-0.5 font-mono">{asset.ipAddress}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{asset.type}</td>
                  <td className="px-5 py-3.5 text-slate-600">{asset.environment}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CLASS_COLORS[asset.dataClassification] ?? "bg-slate-100 text-slate-600"}`}>
                      {asset.dataClassification}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SCOPE_COLORS[asset.scopingTag] ?? "bg-slate-100 text-slate-600"}`}>
                      {asset.scopingTag}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{asset.owner || "—"}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(asset)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                      <button onClick={() => { if (confirm("Delete this asset?")) deleteMutation.mutate(asset.id); }} className="text-xs text-red-500 hover:text-red-600 font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Scoping explainer */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "FedRAMP / FISMA Scoping", desc: "All systems that store, process, or transmit federal information must be in-scope. Cloud infrastructure, management planes, and boundary devices require authorization.", tag: "FedRAMP" },
          { title: "SOC 2 System Boundary", desc: "Define all infrastructure components that support the Trust Services Criteria. Shared components must be documented in the description of the system (security overview).", tag: "SOC 2" },
          { title: "CMMC / CUI Boundary", desc: "Any asset that stores, processes, or transmits CUI must be in-scope for CMMC Level 2 assessment. CUI boundary definition is reviewed by the C3PAO during the assessment.", tag: "CMMC" },
        ].map(item => (
          <div key={item.tag} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{item.tag}</span>
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editingAsset ? "Edit Asset" : "Add Asset"}</h2>
              <button onClick={() => { setShowModal(false); setEditingAsset(null); resetForm(); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Web Server, AWS RDS Instance" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Environment</label>
                  <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Classification</label>
                  <select value={form.dataClassification} onChange={e => setForm(f => ({ ...f, dataClassification: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {DATA_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scope Tag</label>
                  <select value={form.scopingTag} onChange={e => setForm(f => ({ ...f, scopingTag: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {SCOPING_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">System Owner</label>
                  <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="e.g. John Smith" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IP Address / Hostname</label>
                  <input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="e.g. 10.0.1.5 or prod-db.internal" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Provider</label>
                  <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. AWS, Azure, Palo Alto" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What does this asset do? What data does it store/process?" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Flows</label>
                  <textarea value={form.dataFlows} onChange={e => setForm(f => ({ ...f, dataFlows: e.target.value }))} rows={2} placeholder="Describe how data flows to/from this asset (for data flow diagram documentation)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingAsset(null); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {editingAsset ? "Save Changes" : "Add Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
