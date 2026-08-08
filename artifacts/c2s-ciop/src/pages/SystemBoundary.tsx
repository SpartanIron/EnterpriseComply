import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

// P0-10: MOCK_SYSTEMS removed — it showed 4 hardcoded systems with fake FIPS
// ratings, ATO status, and personnel to every org regardless of actual data.
// Now wired to the real GET /orgs/:orgId/assets API.
//
// The assets API returns: id, name, type, environment, owner, dataClassification,
// scopingTag, description, ipAddress, vendor, dataFlows, createdAt.
// Fields like FIPS C/I/A ratings and ATO expiry are not in the API yet;
// those panels show reference information until a dedicated system-boundary
// endpoint with full authorization data is built.

// FIPS_CATEGORIES and CONTROL_INHERITANCE are reference config (NIST RMF), not fake data.
const FIPS_CATEGORIES = ["Low", "Moderate", "High"];

const CONTROL_INHERITANCE = [
  { type: "common", label: "Common (Inherited)", description: "Controls fully implemented by org-level program; system inherits" },
  { type: "hybrid", label: "Hybrid (Shared)", description: "Controls partially org-level, partially system-specific" },
  { type: "system", label: "System-Specific", description: "Controls implemented entirely by this system" },
];

interface Asset {
  id: number;
  name: string;
  type: string;
  environment: string;
  owner: string | null;
  dataClassification: string;
  scopingTag: string;
  description: string | null;
  ipAddress: string | null;
  vendor: string | null;
  dataFlows: string | null;
  createdAt: string;
}

function ClassificationBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Public: "#22c55e", Internal: "#3b82f6", Confidential: "#f59e0b",
    "Top Secret": "#dc2626", CUI: "#7c3aed",
  };
  const c = colors[level] ?? "#94a3b8";
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: c + "22", color: c }}>{level}</span>;
}
function ScopingBadge({ tag }: { tag: string }) {
  const cfg: Record<string, { color: string }> = {
    "In-Scope": { color: "#ef4444" },
    "Out-of-Scope": { color: "#94a3b8" },
    "Leveraged": { color: "#f59e0b" },
  };
  const c = cfg[tag] ?? { color: "#94a3b8" };
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c.color + "22", color: c.color }}>{tag}</span>;
}

export default function SystemBoundary() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "categorization" | "inheritance">("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: "", type: "Server", environment: "Production", dataClassification: "Confidential", scopingTag: "In-Scope", description: "", owner: "" });

  const { data, isLoading } = useQuery<Asset[]>({
    queryKey: ["assets", orgId],
    queryFn: async () => {
      const res = await apiFetch(`/orgs/${orgId}/assets`);
      return (res as any) ?? [];
    },
    enabled: !!orgId,
  });

  const assets: Asset[] = data ?? [];

  const addMutation = useMutation({
    mutationFn: () => apiFetch(`/orgs/${orgId}/assets`, { method: "POST", body: JSON.stringify(newAsset) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets", orgId] }); setShowAdd(false); setNewAsset({ name: "", type: "Server", environment: "Production", dataClassification: "Confidential", scopingTag: "In-Scope", description: "", owner: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets", orgId] }); setActiveAsset(null); },
  });

  const stats = {
    total: assets.length,
    inScope: assets.filter(a => a.scopingTag === "In-Scope").length,
    production: assets.filter(a => a.environment === "Production").length,
    confidentialPlus: assets.filter(a => ["Confidential", "Top Secret", "CUI"].includes(a.dataClassification)).length,
    leveraged: assets.filter(a => a.scopingTag === "Leveraged").length,
  };

  const detailTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "categorization" as const, label: "FIPS 199 Categorization" },
    { id: "inheritance" as const, label: "Control Inheritance" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Boundary Registry</h1>
          <p className="text-sm text-slate-500 mt-1">NIST RMF system categorization, boundary definition, and asset tracking</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Register System
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Systems", value: stats.total, color: "#2563eb" },
          { label: "In-Scope", value: stats.inScope, color: "#ef4444" },
          { label: "Production", value: stats.production, color: "#f59e0b" },
          { label: "Confidential+", value: stats.confidentialPlus, color: "#7c3aed" },
          { label: "Leveraged", value: stats.leveraged, color: "#22c55e" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: stat.color }}>{isLoading ? "—" : stat.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading assets…</div>
      ) : assets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-13.5 0V11.25A2.25 2.25 0 017.5 9h9a2.25 2.25 0 012.25 2.25v3M4.5 19.5h15" /></svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-2">No systems registered yet</h3>
          <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-6">Register your systems to define the authorization boundary, track FIPS 199 categorization, and document control inheritance for FedRAMP and CMMC.</p>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Register First System
          </button>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Asset list */}
          <div className="w-72 flex-shrink-0 space-y-2">
            {assets.map(asset => (
              <button key={asset.id} onClick={() => { setActiveAsset(asset); setActiveTab("overview"); }} className="w-full text-left p-4 rounded-xl border transition-all" style={{ background: activeAsset?.id === asset.id ? "#eff6ff" : "#fff", borderColor: activeAsset?.id === asset.id ? "#2563eb" : "#e2e8f0" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">{asset.type}</span>
                  <ScopingBadge tag={asset.scopingTag} />
                </div>
                <p className="text-sm font-semibold text-slate-800">{asset.name}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <ClassificationBadge level={asset.dataClassification} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{asset.environment}</p>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {!activeAsset ? (
              <div className="flex flex-col items-center justify-center h-80 text-slate-400">
                <svg className="h-12 w-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-13.5 0V11.25A2.25 2.25 0 017.5 9h9a2.25 2.25 0 012.25 2.25v3M4.5 19.5h15" /></svg>
                <p className="text-sm font-medium">Select a system to view details</p>
              </div>
            ) : (
              <>
                <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">{activeAsset.type} · {activeAsset.environment}</span>
                        <ScopingBadge tag={activeAsset.scopingTag} />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">{activeAsset.name}</h2>
                      {activeAsset.description && <p className="text-sm text-slate-500 mt-1 max-w-xl">{activeAsset.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <ClassificationBadge level={activeAsset.dataClassification} />
                      <button onClick={() => deleteMutation.mutate(activeAsset.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-4">
                    {detailTabs.map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors" style={{ background: activeTab === t.id ? "#2563eb" : "transparent", color: activeTab === t.id ? "#fff" : "#64748b" }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6">
                  {activeTab === "overview" && (
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">System Details</h3>
                        <dl className="space-y-2">
                          {[
                            { label: "Type", value: activeAsset.type },
                            { label: "Environment", value: activeAsset.environment },
                            { label: "Owner", value: activeAsset.owner || "Not assigned" },
                            { label: "Data Classification", value: activeAsset.dataClassification },
                            { label: "Scoping Tag", value: activeAsset.scopingTag },
                            { label: "IP Address", value: activeAsset.ipAddress || "—" },
                            { label: "Vendor / Provider", value: activeAsset.vendor || "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-start gap-2">
                              <dt className="text-xs text-slate-500 w-36 flex-shrink-0 pt-0.5">{label}</dt>
                              <dd className="text-sm font-medium text-slate-800">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      {activeAsset.dataFlows && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">Data Flows</h3>
                          <p className="text-sm text-slate-600 leading-relaxed">{activeAsset.dataFlows}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTab === "categorization" && (
                    <div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                        <p className="text-xs font-semibold text-amber-800 mb-1">FIPS 199 categorization not yet stored</p>
                        <p className="text-xs text-amber-700 leading-relaxed">Confidentiality, Integrity, and Availability impact levels are documented in your SSP. A dedicated system-boundary API with full authorization data will expose these fields here.</p>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Impact Level Reference (FIPS 199)</h3>
                      <div className="space-y-2">
                        {[
                          { level: "Low", desc: "Limited adverse effect on operations, assets, or individuals" },
                          { level: "Moderate", desc: "Serious adverse effect — significant degradation, damage, or harm" },
                          { level: "High", desc: "Severe or catastrophic effect — major capability loss or harm" },
                        ].map(({ level, desc }) => (
                          <div key={level} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-xs font-bold px-2 py-0.5 rounded mt-0.5" style={{ background: level === "Low" ? "#22c55e22" : level === "Moderate" ? "#f59e0b22" : "#ef444422", color: level === "Low" ? "#22c55e" : level === "Moderate" ? "#f59e0b" : "#ef4444" }}>{level}</span>
                            <p className="text-xs text-slate-600">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeTab === "inheritance" && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">Control Inheritance Model (reference)</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {CONTROL_INHERITANCE.map(ci => (
                          <div key={ci.type} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                            <p className="text-sm font-bold text-slate-800">{ci.label}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ci.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add asset modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Register System</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 text-xl">&#x2715;</button>
            </div>
            <div className="space-y-3">
              {[
                { label: "System Name *", field: "name", type: "text", placeholder: "e.g. Core Identity Platform" },
                { label: "Owner", field: "owner", type: "text", placeholder: "e.g. Alice Johnson" },
                { label: "IP Address", field: "ipAddress", type: "text", placeholder: "Optional" },
                { label: "Vendor / Cloud Provider", field: "vendor", type: "text", placeholder: "e.g. AWS, Okta" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input type={type} value={(newAsset as any)[field] ?? ""} onChange={e => setNewAsset(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Type", field: "type", options: ["Server", "Web Application", "Database", "Network Device", "Container", "SaaS", "Mobile", "IoT", "Other"] },
                  { label: "Environment", field: "environment", options: ["Production", "Staging", "Development", "DR / Backup", "Other"] },
                  { label: "Data Classification", field: "dataClassification", options: ["Public", "Internal", "Confidential", "CUI", "Top Secret"] },
                  { label: "Scoping Tag", field: "scopingTag", options: ["In-Scope", "Out-of-Scope", "Leveraged"] },
                ].map(({ label, field, options }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <select value={(newAsset as any)[field]} onChange={e => setNewAsset(p => ({ ...p, [field]: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea value={newAsset.description} onChange={e => setNewAsset(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the system and its purpose" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => newAsset.name ? addMutation.mutate() : undefined} disabled={!newAsset.name || addMutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addMutation.isPending ? "Registering…" : "Register System"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
